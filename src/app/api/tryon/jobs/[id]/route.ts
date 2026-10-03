import type { NextRequest } from "next/server";
import { handle, json, noContent } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKETS, removeObjects } from "@/lib/storage";
import { loadJobForCaller } from "@/lib/tryon/access";
import { toJobView } from "@/lib/tryon/jobs";

export const dynamic = "force-dynamic";

/** GET /api/tryon/jobs/:id — status, progress and signed result URLs. */
export const GET = handle(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const { job } = await loadJobForCaller(id);
  return json(await toJobView(job, { includeInput: true }));
});

/** DELETE /api/tryon/jobs/:id — owner deletes the photo and results immediately. */
export const DELETE = handle(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const { job } = await loadJobForCaller(id, { ownerOnly: true });
  const paths = [job.input_path, job.mask_path, ...job.result_paths].filter((p): p is string => Boolean(p));
  await removeObjects(BUCKETS.tryon, paths);
  await createAdminClient().from("tryon_jobs").delete().eq("id", job.id);
  return noContent();
});
