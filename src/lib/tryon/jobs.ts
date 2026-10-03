import "server-only";
import { z } from "zod";
import { BUCKETS, signedUrl, signedUrls } from "@/lib/storage";
import type { TryonJob } from "@/lib/supabase/types";
import type { TryOnParams } from "@/lib/ai/types";

/** Request-time parameters accepted from the client (validated, then normalised). */
export const tryOnParamsSchema = z.object({
  mode: z.enum(["catalog", "describe", "shape_length", "polish"]),
  shape: z.enum(["square", "squoval", "round", "almond", "coffin", "stiletto"]).optional(),
  length: z.enum(["short", "medium", "long"]).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  finish: z.enum(["glossy", "matte", "chrome", "cat_eye", "glitter", "shimmer", "french_tip"]).optional(),
  art: z.string().max(400).optional(),
  variations: z.coerce.number().int().min(1).max(4).default(1),
  seed: z.coerce.number().int().min(0).max(2_147_483_647).optional(),
});

export type TryOnParamsInput = z.infer<typeof tryOnParamsSchema>;

/** Storage prefix for a job's files: users/<uid>/<job> or anon/<anonId>/<job>. */
export function jobPrefix(job: { id: string; user_id: string | null; anon_id: string | null }) {
  return job.user_id ? `users/${job.user_id}/${job.id}` : `anon/${job.anon_id ?? "unknown"}/${job.id}`;
}

export const PUBLIC_JOB_FIELDS =
  "id, salon_id, status, progress, design_id, polish_id, params, variations, provider, result_paths, error_code, cost_usd, duration_ms, locale, expires_at, is_saved, created_at, updated_at" as const;

export type PublicJob = Pick<
  TryonJob,
  | "id"
  | "salon_id"
  | "status"
  | "progress"
  | "design_id"
  | "polish_id"
  | "params"
  | "variations"
  | "provider"
  | "result_paths"
  | "error_code"
  | "cost_usd"
  | "duration_ms"
  | "locale"
  | "expires_at"
  | "is_saved"
  | "created_at"
  | "updated_at"
>;

export interface JobView {
  id: string;
  salonId: string | null;
  status: TryonJob["status"];
  progress: number;
  designId: string | null;
  polishId: string | null;
  params: TryOnParams;
  variations: number;
  provider: TryonJob["provider"];
  cached: boolean;
  errorCode: string | null;
  /** Signed URLs (1h) for the generated images, in order. Empty until succeeded. */
  results: string[];
  /** Signed URL of the (EXIF-stripped) input photo for before/after display. */
  inputUrl: string | null;
  expiresAt: string;
  isSaved: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Serialises a job row for API responses, signing storage paths. */
export async function toJobView(
  job: PublicJob & { input_path?: string | null },
  opts: { includeInput?: boolean } = {},
): Promise<JobView> {
  const params = (job.params ?? {}) as Partial<TryOnParams>;
  const results =
    job.status === "succeeded" && job.result_paths.length
      ? await signedUrls(BUCKETS.tryon, job.result_paths)
      : [];
  const inputUrl =
    opts.includeInput && job.input_path ? await signedUrl(BUCKETS.tryon, job.input_path) : null;
  return {
    id: job.id,
    salonId: job.salon_id,
    status: job.status,
    progress: job.progress,
    designId: job.design_id,
    polishId: job.polish_id,
    params: {
      mode: params.mode ?? "describe",
      shape: params.shape,
      length: params.length,
      color: params.color,
      finish: params.finish,
      art: params.art,
      variations: params.variations ?? job.variations,
      seed: params.seed,
    },
    variations: job.variations,
    provider: job.provider,
    cached: job.provider === "cache",
    errorCode: job.error_code,
    results,
    inputUrl,
    expiresAt: job.expires_at,
    isSaved: job.is_saved,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
  };
}
