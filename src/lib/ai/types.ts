import type { Database } from "@/lib/supabase/database.types";

export type NailShape = Database["public"]["Enums"]["nail_shape"];
export type NailLength = Database["public"]["Enums"]["nail_length"];
export type PolishFinish = Database["public"]["Enums"]["polish_finish"];
export type AiProviderName = "fal" | "replicate";

/** Normalised generation parameters stored on tryon_jobs.params. */
export interface TryOnParams {
  mode: "catalog" | "describe" | "shape_length" | "polish";
  shape?: NailShape;
  length?: NailLength;
  /** Base color hex (#rrggbb). */
  color?: string;
  finish?: PolishFinish;
  /** Free-text art / design description from the client or the design's prompt_text. */
  art?: string;
  /** Number of variations (1–4). */
  variations: number;
  /** Seed for reproducibility; omitted → random. */
  seed?: number;
  /** Set by reserve_ai_credit(). */
  used_topup?: boolean;
}

export interface InpaintRequest {
  /** Publicly fetchable (signed) URL of the original photo. */
  imageUrl: string;
  /** Signed URL of the white-on-black nail mask (same dimensions). */
  maskUrl: string;
  /** Signed URL of the design reference image, if any. */
  referenceImageUrl?: string;
  prompt: string;
  negativePrompt: string;
  numImages: number;
  seed?: number;
  width: number;
  height: number;
}

/** Reference-guided edit: the model sees the hand photo (and the design photo) and an instruction. */
export interface EditRequest {
  /** The client's hand photo — URL or base64 data URI. */
  handImage: string;
  /** The design reference photo — URL or base64 data URI. */
  referenceImage?: string;
  prompt: string;
  numImages: number;
  seed?: number;
}

export interface InpaintResult {
  provider: AiProviderName;
  model: string;
  /** Provider-hosted result URLs; downloaded and re-stored in our bucket by the worker. */
  imageUrls: string[];
  costUsd: number;
  durationMs: number;
  providerJobId?: string;
  seed?: number;
}

export interface ModerationResult {
  allowed: boolean;
  reason?: "nsfw" | "not_hand" | "error";
  score?: number;
  costUsd: number;
  durationMs: number;
}

export interface AiProvider {
  name: AiProviderName;
  inpaint(req: InpaintRequest, signal: AbortSignal): Promise<InpaintResult>;
  /** Reference-guided edit with one model; providers without edit support omit it. */
  edit?(req: EditRequest, model: string, signal: AbortSignal): Promise<InpaintResult>;
  moderate?(imageUrl: string, signal: AbortSignal): Promise<ModerationResult>;
  isConfigured(): boolean;
}

export class AiProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: AiProviderName,
    public readonly retryable: boolean,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}
