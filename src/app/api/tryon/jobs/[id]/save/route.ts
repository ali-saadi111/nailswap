import type { NextRequest } from "next/server";
import { z } from "zod";
import { errors, handle, json, parseJson, requireUser } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKETS, signedUrl } from "@/lib/storage";
import { loadJobForCaller } from "@/lib/tryon/access";

const schema = z.object({
  /** Which variation to save (0-based). */
  index: z.number().int().min(0).max(3).default(0),
  title: z.string().trim().max(80).optional(),
});

/**
 * POST /api/tryon/jobs/:id/save — saves a result to the signed-in user's looks.
 * An anonymous job is claimed by the user on first save so it survives the 30-day purge.
 */
export const POST = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const auth = await requireUser();
  const { id } = await ctx.params;
  const body = await parseJson(req, schema);
  const { job } = await loadJobForCaller(id, { ownerOnly: true });
  if (job.status !== "succeeded") throw errors.conflict("job_not_ready", "The try-on has not finished yet");
  const imagePath = job.result_paths[body.index];
  if (!imagePath) throw errors.badRequest("invalid_index");

  const admin = createAdminClient();
  if (!job.user_id) await admin.from("tryon_jobs").update({ user_id: auth.userId }).eq("id", job.id);
  const { data: look, error } = await admin
    .from("saved_looks")
    .insert({
      user_id: auth.userId,
      job_id: job.id,
      salon_id: job.salon_id,
      design_id: job.design_id,
      polish_id: job.polish_id,
      image_path: imagePath,
      title: body.title ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return json({ ...look, imageUrl: await signedUrl(BUCKETS.tryon, look.image_path) }, { status: 201 });
});
