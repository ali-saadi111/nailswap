import type { NextRequest } from "next/server";
import { handle, json, requireInternal } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKETS, removeObjects } from "@/lib/storage";
import { log } from "@/lib/logger";

export const maxDuration = 120;

/**
 * POST /api/internal/tryon/purge — cron (hourly): deletes hand photos and results of expired,
 * unsaved jobs (30 days) and clears their storage paths. Rows are kept for analytics.
 */
export const POST = handle(async (req: NextRequest) => {
  requireInternal(req);
  const admin = createAdminClient();
  const { data: expired } = await admin
    .from("tryon_jobs")
    .select("id, input_path, mask_path, result_paths")
    .eq("is_saved", false)
    .lt("expires_at", new Date().toISOString())
    .neq("input_path", "")
    .limit(200);
  let objects = 0;
  for (const job of expired ?? []) {
    const paths = [job.input_path, job.mask_path, ...job.result_paths].filter((p): p is string => Boolean(p));
    try {
      await removeObjects(BUCKETS.tryon, paths);
      objects += paths.length;
      await admin
        .from("tryon_jobs")
        .update({ input_path: "", mask_path: null, result_paths: [] })
        .eq("id", job.id);
    } catch (err) {
      log.warn("purge failed", { jobId: job.id, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return json({ jobs: expired?.length ?? 0, objects });
});

export const GET = POST;
