import { after, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { errors, handle, json, parseForm, requestLocale } from "@/lib/api";
import { clientIp, enforceLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES, normaliseUpload } from "@/lib/images";
import { BUCKETS, uploadObject } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClaims } from "@/lib/supabase/server";
import { getAnonId } from "@/lib/tryon/anon";
import { buildCacheKey } from "@/lib/tryon/cache";
import { buildNailMask, handsSchema, validateHands } from "@/lib/tryon/mask";
import { PUBLIC_JOB_FIELDS, jobPrefix, toJobView, tryOnParamsSchema } from "@/lib/tryon/jobs";
import { processJob } from "@/lib/tryon/worker";
import { parseDescription } from "@/lib/ai/prompt";
import type { TryOnParams } from "@/lib/ai/types";
import { log } from "@/lib/logger";

// after() shares this route's budget: allow moderation, model queue time and result storage.
export const maxDuration = 300;

const metaSchema = z.object({
  salonId: z.string().uuid().optional(),
  designId: z.string().uuid().optional(),
  polishId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  consent: z.literal("true"),
  turnstileToken: z.string().optional(),
  locale: z.string().optional(),
});

function field(form: FormData, name: string) {
  const v = form.get(name);
  return typeof v === "string" && v.length ? v : undefined;
}

function jsonField<T>(form: FormData, name: string, schema: z.ZodType<T>, required: boolean): T | undefined {
  const raw = field(form, name);
  if (!raw) {
    if (required) throw errors.badRequest(`${name}_required`, `Missing ${name}`);
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw errors.badRequest(`invalid_${name}`, `${name} must be JSON`);
  }
  return schema.parse(parsed);
}

/**
 * POST /api/tryon/upload — multipart/form-data
 *   file          hand photo (jpeg/png/webp/heic, ≤ 12 MB)
 *   hands         JSON: MediaPipe hands detected client-side on this photo
 *                 [{ landmarks: [{x,y,z}×21], handedness: "Left"|"Right", score }]
 *   params        JSON: { mode, shape?, length?, color?, finish?, art?, variations?, seed? }
 *   salonId?, designId?, polishId?, sessionId?   context
 *   consent       "true" (privacy consent checkbox)
 *   turnstileToken?, locale?
 *
 * Normalises the photo (EXIF/GPS stripped), validates the hand, rasterises the nail mask,
 * serves an identical previous generation from cache for free, otherwise queues the AI job and
 * starts processing immediately. Returns the job; subscribe to Realtime on tryon_jobs.id or poll
 * GET /api/tryon/jobs/:id.
 */
export const POST = handle(async (req: NextRequest) => {
  const ip = clientIp(req.headers);
  await enforceLimit("upload_ip", ip);
  await enforceLimit("tryon_ip", ip);

  const form = await parseForm(req);
  const meta = metaSchema.parse({
    salonId: field(form, "salonId"),
    designId: field(form, "designId"),
    polishId: field(form, "polishId"),
    sessionId: field(form, "sessionId"),
    consent: field(form, "consent"),
    turnstileToken: field(form, "turnstileToken"),
    locale: field(form, "locale"),
  });
  if (!(await verifyTurnstile(meta.turnstileToken, ip)))
    throw errors.forbidden("Turnstile verification failed");
  if (meta.salonId) await enforceLimit("tryon_salon", meta.salonId);

  const file = form.get("file");
  if (!(file instanceof File)) throw errors.badRequest("file_required", "Attach the photo as `file`");
  if (file.size > MAX_UPLOAD_BYTES) throw errors.tooLarge("Image is too large (max 12 MB)");
  if (file.type && !ALLOWED_IMAGE_TYPES.has(file.type))
    throw errors.unprocessable("unsupported", "Use JPG, PNG, WebP or HEIC");

  const hands = jsonField(form, "hands", handsSchema, true)!;
  const input = jsonField(form, "params", tryOnParamsSchema, true)!;
  const locale = requestLocale(req, meta.locale);

  const admin = createAdminClient();
  const [claims, anonId] = await Promise.all([getClaims(), getAnonId(true)]);

  // Resolve catalog context and fill params from the design / polish.
  const params: TryOnParams = { ...input, variations: input.variations };
  let designSalonId: string | null = null;
  if (meta.designId) {
    const { data: design } = await admin
      .from("designs")
      .select("id, salon_id, shape, length, prompt_text, is_visible")
      .eq("id", meta.designId)
      .maybeSingle();
    if (!design || !design.is_visible) throw errors.notFound("Design");
    designSalonId = design.salon_id;
    params.shape = params.shape ?? design.shape ?? undefined;
    params.length = params.length ?? design.length ?? undefined;
    if (design.prompt_text && !params.art) {
      const parsed = parseDescription(design.prompt_text);
      params.color = params.color ?? parsed.color;
      params.finish = params.finish ?? parsed.finish;
    }
  }
  if (meta.polishId) {
    const { data: polish } = await admin
      .from("polishes")
      .select("hex_color, finish, salon_id")
      .eq("id", meta.polishId)
      .maybeSingle();
    if (!polish) throw errors.notFound("Polish");
    params.color = params.color ?? polish.hex_color;
    params.finish = params.finish ?? polish.finish;
  }
  if (params.mode === "describe" && params.art) {
    const parsed = parseDescription(params.art);
    params.shape = params.shape ?? parsed.shape;
    params.length = params.length ?? parsed.length;
    params.color = params.color ?? parsed.color;
    params.finish = params.finish ?? parsed.finish;
  }
  const salonId = meta.salonId ?? designSalonId;
  if (meta.salonId && designSalonId && meta.salonId !== designSalonId)
    throw errors.badRequest("design_salon_mismatch");

  // Normalise + validate + mask
  const image = await normaliseUpload(Buffer.from(await file.arrayBuffer()));
  const validation = validateHands(hands, image.width, image.height);
  if (!validation.ok) throw errors.unprocessable(validation.reason, undefined, { reason: validation.reason });
  const mask = await buildNailMask(validation.hand.landmarks, image.width, image.height, {
    shape: params.shape,
    length: params.length,
  });

  const jobId = randomUUID();
  const owner = { id: jobId, user_id: claims.userId, anon_id: claims.userId ? null : anonId };
  const prefix = jobPrefix(owner);
  const inputPath = `${prefix}/input.jpg`;
  const maskPath = `${prefix}/mask.png`;
  await Promise.all([
    uploadObject(BUCKETS.tryon, inputPath, image.buffer, "image/jpeg"),
    uploadObject(BUCKETS.tryon, maskPath, mask.png, "image/png"),
  ]);

  const cacheKey = buildCacheKey(image.hash, meta.designId ?? null, params);
  const storedParams = {
    ...params,
    _width: image.width,
    _height: image.height,
    _nails: mask.polygons.length,
  };

  // Cache hit: copy the previous results into this job's folder (independent lifetime), zero cost.
  const { data: cached } = await admin
    .from("tryon_jobs")
    .select("id, result_paths, provider_model, prompt")
    .eq("cache_key", cacheKey)
    .eq("status", "succeeded")
    .gt("expires_at", new Date().toISOString())
    .not("result_paths", "eq", "{}")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let resultPaths: string[] = [];
  if (cached) {
    for (let i = 0; i < cached.result_paths.length; i++) {
      const dest = `${prefix}/result-${i + 1}.jpg`;
      const { error } = await admin.storage.from(BUCKETS.tryon).copy(cached.result_paths[i], dest);
      if (error) {
        log.warn("cache copy failed", { from: cached.result_paths[i], error: error.message });
        resultPaths = [];
        break;
      }
      resultPaths.push(dest);
    }
  }
  const cacheHit = resultPaths.length > 0;

  const { data: job, error } = await admin
    .from("tryon_jobs")
    .insert({
      id: jobId,
      salon_id: salonId,
      user_id: owner.user_id,
      anon_id: owner.anon_id,
      session_id: meta.sessionId ?? null,
      status: cacheHit ? "succeeded" : "queued",
      progress: cacheHit ? 100 : 0,
      input_path: inputPath,
      input_hash: image.hash,
      mask_path: maskPath,
      design_id: meta.designId ?? null,
      polish_id: meta.polishId ?? null,
      params: storedParams,
      prompt: cacheHit ? cached!.prompt : null,
      variations: params.variations,
      cache_key: cacheKey,
      cached_from_job_id: cacheHit ? cached!.id : null,
      provider: cacheHit ? "cache" : null,
      provider_model: cacheHit ? cached!.provider_model : null,
      result_paths: resultPaths,
      cost_usd: 0,
      locale,
    })
    .select(`${PUBLIC_JOB_FIELDS}, input_path`)
    .single();
  if (error || !job) throw error ?? new Error("job insert failed");

  await admin.from("analytics_events").insert({
    salon_id: salonId,
    kind: cacheHit ? "tryon_ai_success" : "tryon_ai_request",
    design_id: meta.designId ?? null,
    polish_id: meta.polishId ?? null,
    user_id: claims.userId,
    anon_id: anonId,
    payload: { job_id: jobId, mode: params.mode, cached: cacheHit },
  });
  if (!cacheHit) {
    after(async () => {
      try {
        await processJob(jobId);
      } catch (err) {
        log.error("processJob threw", { jobId, error: err instanceof Error ? err.message : String(err) });
      }
    });
  }

  return json(await toJobView(job, { includeInput: true }), { status: 201 });
});
