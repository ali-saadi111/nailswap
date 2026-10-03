import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import sharp from "sharp";
import { aiConfigured, edit, editConfigured, inpaint, moderate, type AttemptLog } from "@/lib/ai/tryon";
import { buildEditPrompt, buildPrompt } from "@/lib/ai/prompt";
import { AiProviderError, type TryOnParams } from "@/lib/ai/types";
import {
  BUCKETS,
  downloadObject,
  importRemoteImage,
  publicMediaUrl,
  signedUrl,
  type Bucket,
} from "@/lib/storage";
import { log, errorMessage } from "@/lib/logger";
import { env } from "@/lib/env";
import { jobPrefix } from "./jobs";
import type { TryonJob } from "@/lib/supabase/types";

/**
 * AI try-on worker. One job at a time, idempotent: claiming flips `queued → moderating` with a
 * conditional update, so concurrent invocations (route `after()`, cron requeue) never process the
 * same job twice.
 *
 * Pipeline: claim → moderate (NSFW) → reserve credit → generate → store results.
 * Generate prefers the reference-guided edit models (hand photo + design photo, no mask). The legacy
 * pipeline (mask rasterised at upload time + Flux Fill inpainting) remains as the fallback.
 */
const MAX_ATTEMPTS = 3;
/** Jobs stuck in an intermediate state longer than this are re-queued by the cron. */
export const STUCK_AFTER_MS = 5 * 60 * 1000;

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Reads an image from storage and returns it as a JPEG data URI. Providers receive the bytes
 * directly, so this works when storage is not publicly reachable (local Supabase, private buckets).
 */
async function imageDataUri(bucket: Bucket, path: string, maxSide: number) {
  const raw = await downloadObject(bucket, path);
  const jpeg = await sharp(raw)
    .rotate()
    .resize(maxSide, maxSide, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

async function setStatus(
  admin: Admin,
  jobId: string,
  patch: Partial<
    Pick<
      TryonJob,
      | "status"
      | "progress"
      | "error_code"
      | "error_message"
      | "provider"
      | "provider_model"
      | "provider_job_id"
      | "result_paths"
      | "cost_usd"
      | "duration_ms"
      | "prompt"
    >
  >,
) {
  const { error } = await admin.from("tryon_jobs").update(patch).eq("id", jobId);
  if (error) throw new Error(`tryon_jobs update failed: ${error.message}`);
}

async function logCost(
  admin: Admin,
  job: TryonJob,
  rows: Array<{
    provider: "fal" | "replicate";
    model: string;
    operation: string;
    cost_usd: number;
    duration_ms: number;
    success: boolean;
  }>,
) {
  if (!rows.length) return;
  const { error } = await admin
    .from("ai_cost_log")
    .insert(rows.map((r) => ({ ...r, salon_id: job.salon_id, job_id: job.id })));
  if (error) log.warn("ai_cost_log insert failed", { error: error.message });
}

async function track(
  admin: Admin,
  job: TryonJob,
  kind: "tryon_ai_success" | "tryon_ai_failed",
  payload: Record<string, unknown> = {},
) {
  await admin.from("analytics_events").insert({
    salon_id: job.salon_id,
    kind,
    design_id: job.design_id,
    polish_id: job.polish_id,
    user_id: job.user_id,
    anon_id: job.anon_id,
    payload: { job_id: job.id, ...payload },
  });
}

export type ProcessOutcome = "processed" | "skipped" | "failed" | "rejected";

/** Runs the pipeline for one job. Safe to call repeatedly. */
export async function processJob(jobId: string): Promise<ProcessOutcome> {
  const admin = createAdminClient();

  // Claim
  const { data: job, error: claimErr } = await admin
    .from("tryon_jobs")
    .update({ status: "moderating", progress: 5 })
    .eq("id", jobId)
    .eq("status", "queued")
    .select("*")
    .maybeSingle();
  if (claimErr) throw new Error(`claim failed: ${claimErr.message}`);
  if (!job) return "skipped";

  const started = Date.now();
  const attempts: AttemptLog[] = [];
  const costRows: Parameters<typeof logCost>[2] = [];

  try {
    if (!aiConfigured()) {
      await setStatus(admin, job.id, {
        status: "failed",
        error_code: "ai_not_configured",
        error_message: "No AI provider is configured (set FAL_KEY or REPLICATE_API_TOKEN).",
      });
      await track(admin, job, "tryon_ai_failed", { error_code: "ai_not_configured" });
      return "failed";
    }
    const useEdit = editConfigured();
    if (!useEdit && !job.mask_path) {
      await setStatus(admin, job.id, {
        status: "failed",
        error_code: "mask_missing",
        error_message: "Job has no nail mask.",
      });
      return "failed";
    }

    const handImage = await imageDataUri(BUCKETS.tryon, job.input_path, 2048);

    // 1. Moderation (before spending on generation)
    const mod = await moderate(await imageDataUri(BUCKETS.tryon, job.input_path, 1024));
    if (mod.durationMs > 0) {
      costRows.push({
        provider: "fal",
        model: env().FAL_MODERATION_MODEL,
        operation: "moderation",
        cost_usd: mod.costUsd,
        duration_ms: mod.durationMs,
        success: mod.allowed || mod.reason === "nsfw",
      });
    }
    if (!mod.allowed) {
      await setStatus(admin, job.id, {
        status: mod.reason === "nsfw" ? "rejected" : "failed",
        progress: 100,
        error_code: mod.reason === "nsfw" ? "inappropriate" : "moderation_error",
        error_message: mod.reason === "nsfw" ? "Image failed moderation" : "Moderation service unavailable",
        duration_ms: Date.now() - started,
      });
      await logCost(admin, job, costRows);
      await track(admin, job, "tryon_ai_failed", { error_code: mod.reason });
      return mod.reason === "nsfw" ? "rejected" : "failed";
    }

    // 2. Quota (salon-scoped; platform-level jobs without a salon are only rate limited)
    if (job.salon_id) {
      const { error: quotaErr } = await admin.rpc("reserve_ai_credit", {
        p_salon_id: job.salon_id,
        p_job_id: job.id,
      });
      if (quotaErr) {
        const code =
          quotaErr.code === "P0004"
            ? "quota_exhausted"
            : quotaErr.code === "P0003"
              ? "subscription_inactive"
              : "quota_error";
        await setStatus(admin, job.id, {
          status: "failed",
          progress: 100,
          error_code: code,
          error_message: quotaErr.message,
          duration_ms: Date.now() - started,
        });
        await logCost(admin, job, costRows);
        await track(admin, job, "tryon_ai_failed", { error_code: code });
        return "failed";
      }
    }

    // 3. Generate
    await setStatus(admin, job.id, { status: "generating", progress: 35 });
    const params = job.params as unknown as TryOnParams;
    let designPrompt: string | null = null;
    let coverPath: string | null = null;
    if (job.design_id) {
      const { data: design } = await admin
        .from("designs")
        .select("prompt_text, cover_path")
        .eq("id", job.design_id)
        .maybeSingle();
      designPrompt = design?.prompt_text ?? null;
      coverPath = design?.cover_path ?? null;
    }

    let gen: Awaited<ReturnType<typeof edit>>;
    if (useEdit) {
      // A missing/broken cover must not fail the job — fall back to the text description.
      const referenceImage = coverPath
        ? await imageDataUri(BUCKETS.publicMedia, coverPath, 1536).catch(() => undefined)
        : undefined;
      const prompt = buildEditPrompt(params, designPrompt, Boolean(referenceImage));
      await setStatus(admin, job.id, { prompt });
      gen = await edit({ handImage, referenceImage, prompt, numImages: job.variations, seed: params.seed });
    } else {
      const { prompt, negativePrompt } = buildPrompt(params, designPrompt);
      await setStatus(admin, job.id, { prompt });
      const { data: dims } = await admin.from("tryon_jobs").select("params").eq("id", job.id).single();
      const meta = (dims?.params ?? {}) as { _width?: number; _height?: number };
      gen = await inpaint({
        imageUrl: await signedUrl(BUCKETS.tryon, job.input_path, 1800),
        maskUrl: await signedUrl(BUCKETS.tryon, job.mask_path!, 1800),
        referenceImageUrl: publicMediaUrl(coverPath) ?? undefined,
        prompt,
        negativePrompt,
        numImages: job.variations,
        seed: params.seed,
        width: meta._width ?? 1024,
        height: meta._height ?? 1024,
      });
    }
    attempts.push(...gen.attempts);
    for (const a of gen.attempts) {
      costRows.push({
        provider: a.provider,
        model: a.model ?? gen.result.model,
        operation: useEdit ? "edit" : "inpaint",
        cost_usd: a.ok ? gen.result.costUsd : 0,
        duration_ms: a.durationMs,
        success: a.ok,
      });
    }

    // 4. Store results in our bucket (provider URLs expire)
    await setStatus(admin, job.id, { progress: 80 });
    const prefix = jobPrefix(job);
    const paths: string[] = [];
    for (let i = 0; i < gen.result.imageUrls.length; i++) {
      const p = `${prefix}/result-${i + 1}.jpg`;
      await importRemoteImage(gen.result.imageUrls[i], BUCKETS.tryon, p);
      paths.push(p);
    }

    await setStatus(admin, job.id, {
      status: "succeeded",
      progress: 100,
      provider: gen.result.provider,
      provider_model: gen.result.model,
      provider_job_id: gen.result.providerJobId ?? null,
      result_paths: paths,
      cost_usd: gen.result.costUsd,
      duration_ms: Date.now() - started,
      error_code: null,
      error_message: null,
    });
    await logCost(admin, job, costRows);
    if (job.design_id) await admin.rpc("increment_design_tryon", { p_design_id: job.design_id });
    await track(admin, job, "tryon_ai_success", {
      provider: gen.result.provider,
      variations: paths.length,
      cost_usd: gen.result.costUsd,
    });
    log.info("tryon job succeeded", {
      jobId: job.id,
      provider: gen.result.provider,
      ms: Date.now() - started,
    });
    return "processed";
  } catch (err) {
    const message = errorMessage(err);
    const retryable = !(err instanceof AiProviderError) || err.retryable;
    const nextAttempts = (job.attempts ?? 0) + 1;
    const giveUp = !retryable || nextAttempts >= MAX_ATTEMPTS;
    log.error("tryon job failed", { jobId: job.id, message, attempts: nextAttempts, giveUp });
    await admin
      .from("tryon_jobs")
      .update({
        status: giveUp ? "failed" : "queued",
        progress: giveUp ? 100 : 0,
        attempts: nextAttempts,
        error_code: giveUp ? "generation_failed" : null,
        error_message: message.slice(0, 500),
        duration_ms: Date.now() - started,
      })
      .eq("id", job.id);
    await logCost(admin, job, costRows);
    if (giveUp) await track(admin, job, "tryon_ai_failed", { error: message.slice(0, 200) });
    return "failed";
  }
}

/** Processes up to `limit` queued jobs (oldest first). Used by the cron requeue endpoint. */
export async function processQueued(limit = 5): Promise<{ processed: number; outcomes: ProcessOutcome[] }> {
  const admin = createAdminClient();
  const { data: jobs } = await admin
    .from("tryon_jobs")
    .select("id")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(limit);
  const outcomes: ProcessOutcome[] = [];
  for (const j of jobs ?? []) outcomes.push(await processJob(j.id));
  return { processed: outcomes.filter((o) => o !== "skipped").length, outcomes };
}

/** Re-queues jobs stuck in an intermediate state for longer than STUCK_AFTER_MS. */
export async function requeueStuck(): Promise<number> {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - STUCK_AFTER_MS).toISOString();
  const { data: stuck } = await admin
    .from("tryon_jobs")
    .select("id, attempts")
    .in("status", ["moderating", "validating", "masking", "generating"])
    .lt("updated_at", cutoff);
  let n = 0;
  for (const j of stuck ?? []) {
    const attempts = (j.attempts ?? 0) + 1;
    const giveUp = attempts >= MAX_ATTEMPTS;
    await admin
      .from("tryon_jobs")
      .update({
        status: giveUp ? "failed" : "queued",
        progress: giveUp ? 100 : 0,
        attempts,
        error_code: giveUp ? "timeout" : null,
        error_message: giveUp ? "Generation timed out" : "Requeued after timeout",
      })
      .eq("id", j.id);
    n++;
  }
  return n;
}
