import "server-only";
import { env } from "@/lib/env";
import { falProvider } from "./providers/fal";
import { replicateProvider } from "./providers/replicate";
import {
  AiProviderError,
  type AiProvider,
  type EditRequest,
  type InpaintRequest,
  type InpaintResult,
  type ModerationResult,
} from "./types";

/**
 * Single server-side entry point for every paid AI call.
 * - Primary → secondary failover with per-call timeouts and retries.
 * - Never import provider modules elsewhere; API keys stay in this layer.
 */
export type { EditRequest, InpaintRequest, InpaintResult, ModerationResult } from "./types";

function providers(): AiProvider[] {
  return [falProvider, replicateProvider].filter((p) => p.isConfigured());
}

export function aiConfigured() {
  return providers().length > 0;
}

async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fn(ctrl.signal);
  } finally {
    clearTimeout(timer);
  }
}

export interface AttemptLog {
  provider: AiProvider["name"];
  /** Model used for this attempt (edit pipeline tries several). */
  model?: string;
  ok: boolean;
  durationMs: number;
  error?: string;
}

/**
 * Runs inpainting with retries on the primary then fails over to the secondary provider.
 * Returns the result and the attempt log (persisted to ai_cost_log by the worker).
 */
export async function inpaint(
  req: InpaintRequest,
): Promise<{ result: InpaintResult; attempts: AttemptLog[] }> {
  const e = env();
  const list = providers();
  if (!list.length) throw new AiProviderError("No AI provider configured", "fal", false);
  const attempts: AttemptLog[] = [];
  let lastErr: unknown;

  for (const provider of list) {
    for (let i = 0; i <= e.AI_PROVIDER_RETRIES; i++) {
      const started = Date.now();
      try {
        const result = await withTimeout((signal) => provider.inpaint(req, signal), e.AI_PROVIDER_TIMEOUT_MS);
        attempts.push({ provider: provider.name, ok: true, durationMs: Date.now() - started });
        return { result, attempts };
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        attempts.push({ provider: provider.name, ok: false, durationMs: Date.now() - started, error: msg });
        const retryable = err instanceof AiProviderError ? err.retryable : true;
        if (!retryable) break; // non-retryable on this provider → fail over immediately
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Inpainting failed");
}

/** True when the reference-guided edit pipeline can run (an edit-capable provider is configured). */
export function editConfigured() {
  return env().AI_TRYON_PIPELINE === "edit" && providers().some((p) => p.edit);
}

/**
 * Reference-guided try-on: primary edit model with retries, then the fallback model.
 * Throws when every model failed; the worker then decides whether to retry the job.
 */
export async function edit(req: EditRequest): Promise<{ result: InpaintResult; attempts: AttemptLog[] }> {
  const e = env();
  const provider = providers().find((p) => p.edit);
  if (!provider?.edit) throw new AiProviderError("No edit-capable AI provider configured", "fal", false);
  const models = [...new Set([e.FAL_EDIT_MODEL, e.FAL_EDIT_FALLBACK_MODEL].filter(Boolean))];
  const attempts: AttemptLog[] = [];
  let lastErr: unknown;

  for (const model of models) {
    for (let i = 0; i <= e.AI_PROVIDER_RETRIES; i++) {
      const started = Date.now();
      try {
        const result = await withTimeout(
          (signal) => provider.edit!(req, model, signal),
          e.AI_EDIT_TIMEOUT_MS,
        );
        attempts.push({ provider: provider.name, model, ok: true, durationMs: Date.now() - started });
        return { result, attempts };
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        attempts.push({
          provider: provider.name,
          model,
          ok: false,
          durationMs: Date.now() - started,
          error: msg,
        });
        const retryable = err instanceof AiProviderError ? err.retryable : true;
        if (!retryable) break; // e.g. 422 bad input on this model → try the next model
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Edit failed");
}

/** Image moderation before any generation call. Uses the first provider that supports it. */
export async function moderate(imageUrl: string): Promise<ModerationResult> {
  const e = env();
  const provider = providers().find((p) => p.moderate);
  if (!provider?.moderate) {
    // No moderation endpoint configured: allow, cost 0. The hand-validation step still applies.
    return { allowed: true, costUsd: 0, durationMs: 0 };
  }
  return withTimeout(
    (signal) => provider.moderate!(imageUrl, signal),
    Math.min(e.AI_PROVIDER_TIMEOUT_MS, 20_000),
  );
}
