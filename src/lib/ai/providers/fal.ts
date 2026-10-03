import "server-only";
import { env } from "@/lib/env";
import { buildEditInput, estimateEditCost } from "../edit-input";
import {
  AiProviderError,
  type AiProvider,
  type EditRequest,
  type InpaintRequest,
  type InpaintResult,
  type ModerationResult,
} from "../types";

/**
 * fal.ai provider. Uses the queue API (submit → poll → result) so long generations survive
 * connection hiccups. Docs: https://fal.ai/docs/model-endpoints/queue
 */
const QUEUE_BASE = "https://queue.fal.run";

interface FalQueueSubmit {
  request_id: string;
  status_url: string;
  response_url: string;
}
interface FalQueueStatus {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED";
  queue_position?: number;
}
interface FalImage {
  url: string;
  width?: number;
  height?: number;
}

async function falFetch<T>(url: string, init: RequestInit, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    ...init,
    signal,
    headers: {
      Authorization: `Key ${env().FAL_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const retryable = res.status === 429 || res.status >= 500;
    throw new AiProviderError(`fal ${res.status}: ${text.slice(0, 300)}`, "fal", retryable, res.status);
  }
  return (await res.json()) as T;
}

async function runQueued<TOut>(
  model: string,
  input: Record<string, unknown>,
  signal: AbortSignal,
): Promise<{ out: TOut; requestId: string }> {
  const submit = await falFetch<FalQueueSubmit>(
    `${QUEUE_BASE}/${model}`,
    { method: "POST", body: JSON.stringify(input) },
    signal,
  );
  let delay = 700;
  for (;;) {
    if (signal.aborted) throw new AiProviderError("fal timeout", "fal", true);
    const st = await falFetch<FalQueueStatus>(submit.status_url, { method: "GET" }, signal);
    if (st.status === "COMPLETED") break;
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.4, 3000);
  }
  const out = await falFetch<TOut>(submit.response_url, { method: "GET" }, signal);
  return { out, requestId: submit.request_id };
}

export const falProvider: AiProvider = {
  name: "fal",
  isConfigured: () => Boolean(env().FAL_KEY),

  async inpaint(req: InpaintRequest, signal): Promise<InpaintResult> {
    const e = env();
    const started = Date.now();
    const model = e.FAL_INPAINT_MODEL;
    // Flux Fill (fal-ai/flux-pro/v1/fill) input schema; reference image is passed via
    // image_prompt when supported by the chosen model (Flux Fill accepts it as extra guidance).
    const input: Record<string, unknown> = {
      prompt: req.prompt,
      image_url: req.imageUrl,
      mask_url: req.maskUrl,
      num_images: req.numImages,
      safety_tolerance: "2",
      output_format: "jpeg",
      ...(req.seed !== undefined ? { seed: req.seed } : {}),
      ...(req.referenceImageUrl ? { image_prompt: req.referenceImageUrl, image_prompt_strength: 0.35 } : {}),
    };
    const { out, requestId } = await runQueued<{ images: FalImage[]; seed?: number }>(model, input, signal);
    if (!out.images?.length) throw new AiProviderError("fal returned no images", "fal", true);
    return {
      provider: "fal",
      model,
      imageUrls: out.images.map((i) => i.url),
      costUsd: e.AI_COST_FAL_USD * req.numImages,
      durationMs: Date.now() - started,
      providerJobId: requestId,
      seed: out.seed,
    };
  },

  async edit(req: EditRequest, model: string, signal): Promise<InpaintResult> {
    const e = env();
    const started = Date.now();
    let input: Record<string, unknown>;
    try {
      input = buildEditInput(model, req, e.FAL_EDIT_RESOLUTION);
    } catch {
      throw new AiProviderError("Unsupported edit model configuration", "fal", false);
    }
    const { out, requestId } = await runQueued<{ images: FalImage[]; seed?: number }>(model, input, signal);
    if (!out.images?.length) throw new AiProviderError("fal returned no images", "fal", true);
    return {
      provider: "fal",
      model,
      imageUrls: out.images.map((i) => i.url),
      costUsd: estimateEditCost(model, e.FAL_EDIT_RESOLUTION, out.images.length, e.AI_COST_FAL_EDIT_USD),
      durationMs: Date.now() - started,
      providerJobId: requestId,
      seed: out.seed,
    };
  },

  async moderate(imageUrl, signal): Promise<ModerationResult> {
    const e = env();
    const started = Date.now();
    try {
      const { out } = await runQueued<{ nsfw_probability: number }>(
        e.FAL_MODERATION_MODEL,
        { image_url: imageUrl },
        signal,
      );
      const score = out.nsfw_probability;
      if (!Number.isFinite(score) || score < 0 || score > 1) {
        return { allowed: false, reason: "error", costUsd: 0.001, durationMs: Date.now() - started };
      }
      return {
        allowed: score < 0.6,
        reason: score >= 0.6 ? "nsfw" : undefined,
        score,
        costUsd: 0.001,
        durationMs: Date.now() - started,
      };
    } catch (err) {
      if (err instanceof AiProviderError && !err.retryable) throw err;
      return { allowed: false, reason: "error", costUsd: 0, durationMs: Date.now() - started };
    }
  },
};
