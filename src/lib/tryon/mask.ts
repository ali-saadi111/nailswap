import "server-only";
import { z } from "zod";
import {
  estimateNails,
  validateHandForTryOn,
  type Landmarks,
  type NailEstimate,
} from "@/lib/ar/nail-geometry";
import { rasterizeMask } from "@/lib/images";
import type { NailLength, NailShape } from "@/lib/ai/types";

/**
 * Server-side nail mask construction.
 *
 * MediaPipe's HandLandmarker only runs in browsers (it needs `document`/WebGL), so the client
 * detects the hand on the chosen photo with the same model the AR mode uses and sends the
 * 21-point landmarks along with the upload. The server validates them and rasterises the
 * per-nail polygons into the inpainting mask.
 */
const pointSchema = z.object({
  x: z.number().min(-0.5).max(1.5),
  y: z.number().min(-0.5).max(1.5),
  z: z.number().optional(),
});

export const detectedHandSchema = z.object({
  landmarks: z.array(pointSchema).length(21),
  handedness: z.enum(["Left", "Right"]).default("Right"),
  score: z.number().min(0).max(1).default(1),
});

export const handsSchema = z.array(detectedHandSchema).min(1).max(2);

export type DetectedHandInput = z.infer<typeof detectedHandSchema>;

export type HandValidation =
  | { ok: true; hand: DetectedHandInput; nails: NailEstimate[] }
  | { ok: false; reason: "not_hand" | "nails_not_visible" | "too_small" };

/** Validates the client-detected hands and picks the best one for the mask. */
export function validateHands(hands: DetectedHandInput[], width: number, height: number): HandValidation {
  const aspect = width / height;
  const result = validateHandForTryOn(hands, aspect);
  if (!result.ok) return result;
  const best = hands.reduce((a, b) => (a.score >= b.score ? a : b));
  return { ok: true, hand: best, nails: result.nails };
}

export interface MaskBuild {
  png: Buffer;
  polygons: Array<Array<[number, number]>>;
  nails: NailEstimate[];
}

/**
 * Builds the white-on-black mask for every visible nail. Longer requested lengths extend the
 * polygons past the fingertip so the model has room to grow the nail; a small feather keeps
 * the blend natural.
 */
export async function buildNailMask(
  landmarks: Landmarks,
  width: number,
  height: number,
  opts: { shape?: NailShape | null; length?: NailLength | null } = {},
): Promise<MaskBuild> {
  const nails = estimateNails(landmarks, { aspect: width / height, shape: opts.shape, length: opts.length });
  const polygons = nails.filter((n) => n.confidence >= 0.4).map((n) => n.polygon);
  const feather = Math.max(2, Math.round(Math.min(width, height) * 0.004));
  const png = await rasterizeMask(width, height, polygons, feather);
  return { png, polygons, nails };
}
