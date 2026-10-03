import "server-only";
import { env } from "@/lib/env";
import { AiProviderError, type AiProvider, type InpaintRequest, type InpaintResult } from "../types";

/**
 * Replicate provider (secondary / failover). Uses the predictions API with `Prefer: wait`
 * for up to 60s and falls back to polling. Docs: https://replicate.com/docs/reference/http
 */
const BASE = "https://api.replicate.com/v1";

interface Prediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string | string[] | null;
  error?: string | null;
  metrics?: { predict_time?: number };
  urls?: { get: string };
}

async function rFetch<T>(url: string, init: RequestInit, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    ...init,
    signal,
    headers: {
      Authorization: `Bearer ${env().REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const retryable = res.status === 429 || res.status >= 500;
    throw new AiProviderError(
      `replicate ${res.status}: ${text.slice(0, 300)}`,
      "replicate",
      retryable,
      res.status,
    );
  }
  return (await res.json()) as T;
}

export const replicateProvider: AiProvider = {
  name: "replicate",
  isConfigured: () => Boolean(env().REPLICATE_API_TOKEN),

  async inpaint(req: InpaintRequest, signal): Promise<InpaintResult> {
    const e = env();
    const started = Date.now();
    const model = e.REPLICATE_INPAINT_MODEL; // owner/name — official models use /models/{owner}/{name}/predictions
    const input: Record<string, unknown> = {
      prompt: req.prompt,
      image: req.imageUrl,
      mask: req.maskUrl,
      steps: 40,
      guidance: 45,
      output_format: "jpg",
      safety_tolerance: 2,
      ...(req.seed !== undefined ? { seed: req.seed } : {}),
    };
    const urls: string[] = [];
    let lastId: string | undefined;
    // Flux Fill Pro returns one image per prediction; run N predictions in parallel.
    const runs = Array.from({ length: req.numImages }, async (_, i) => {
      let p = await rFetch<Prediction>(
        `${BASE}/models/${model}/predictions`,
        {
          method: "POST",
          headers: { Prefer: "wait=60" },
          body: JSON.stringify({
            input: { ...input, ...(req.seed !== undefined ? { seed: req.seed + i } : {}) },
          }),
        },
        signal,
      );
      let delay = 1000;
      while (p.status === "starting" || p.status === "processing") {
        await new Promise((r) => setTimeout(r, delay));
        delay = Math.min(delay * 1.3, 3000);
        if (signal.aborted) throw new AiProviderError("replicate timeout", "replicate", true);
        p = await rFetch<Prediction>(p.urls?.get ?? `${BASE}/predictions/${p.id}`, { method: "GET" }, signal);
      }
      if (p.status !== "succeeded")
        throw new AiProviderError(`replicate ${p.status}: ${p.error ?? ""}`, "replicate", true);
      lastId = p.id;
      const out = Array.isArray(p.output) ? p.output : p.output ? [p.output] : [];
      urls.push(...out);
    });
    await Promise.all(runs);
    if (!urls.length) throw new AiProviderError("replicate returned no images", "replicate", true);
    return {
      provider: "replicate",
      model,
      imageUrls: urls,
      costUsd: e.AI_COST_REPLICATE_USD * req.numImages,
      durationMs: Date.now() - started,
      providerJobId: lastId,
      seed: req.seed,
    };
  },
};
