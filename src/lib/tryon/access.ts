import "server-only";
import { errors } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClaims } from "@/lib/supabase/server";
import { getAnonId } from "./anon";
import type { TryonJob } from "@/lib/supabase/types";

export type JobAccess = "owner" | "salon" | "admin";

/**
 * Loads a try-on job and checks the caller may see it: the signed-in owner, the anonymous
 * owner (cookie), a member of the salon it belongs to, or a platform admin.
 */
export async function loadJobForCaller(
  jobId: string,
  opts: { ownerOnly?: boolean } = {},
): Promise<{ job: TryonJob; access: JobAccess; userId: string | null }> {
  const admin = createAdminClient();
  const { data: job } = await admin.from("tryon_jobs").select("*").eq("id", jobId).maybeSingle();
  if (!job) throw errors.notFound("Job");
  const [claims, anonId] = await Promise.all([getClaims(), getAnonId(false)]);

  if (claims.userId && job.user_id === claims.userId) return { job, access: "owner", userId: claims.userId };
  if (!job.user_id && anonId && job.anon_id === anonId)
    return { job, access: "owner", userId: claims.userId };
  if (opts.ownerOnly) throw errors.forbidden("Not your try-on");
  if (claims.isPlatformAdmin) return { job, access: "admin", userId: claims.userId };
  if (claims.userId && job.salon_id && claims.salonRoles[job.salon_id])
    return { job, access: "salon", userId: claims.userId };
  throw errors.forbidden("Not your try-on");
}
