import { createHash } from "node:crypto";
import type { TryOnParams } from "@/lib/ai/types";
import { DEFAULT_EDIT_MODEL } from "@/lib/ai/edit-input";

/**
 * Deterministic cache key for a generation: same input image (by content hash), same design and
 * the same normalised params → identical result, served for free.
 */
export function buildCacheKey(inputHash: string, designId: string | null, params: TryOnParams) {
  const normalised = {
    // Invalidate results after changing the model, resolution or manicure instructions.
    promptVersion: 2,
    pipeline: process.env.AI_TRYON_PIPELINE ?? "edit",
    model: process.env.FAL_EDIT_MODEL ?? DEFAULT_EDIT_MODEL,
    fallback: process.env.FAL_EDIT_FALLBACK_MODEL ?? "",
    resolution: process.env.FAL_EDIT_RESOLUTION ?? "1K",
    inpaintModel: process.env.FAL_INPAINT_MODEL ?? "fal-ai/flux-pro/v1/fill",
    mode: params.mode,
    shape: params.shape ?? null,
    length: params.length ?? null,
    color: params.color?.toUpperCase() ?? null,
    finish: params.finish ?? null,
    art: (params.art ?? "").trim().toLowerCase().replace(/\s+/g, " ") || null,
    variations: params.variations,
    seed: params.seed ?? null,
  };
  return createHash("sha256")
    .update(`${inputHash}|${designId ?? ""}|${JSON.stringify(normalised)}`)
    .digest("hex");
}
