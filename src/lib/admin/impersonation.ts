import "server-only";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/** httpOnly cookie set by POST /api/admin/impersonation: `<session_id>:<salon_id>`. */
export const IMPERSONATION_COOKIE = "ns_impersonate";

/**
 * Returns the salon a platform admin is currently impersonating (valid, unexpired session),
 * or null. Dashboard pages call this to choose the salon for an admin viewer.
 */
export async function getImpersonatedSalonId(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(IMPERSONATION_COOKIE)?.value;
  if (!raw) return null;
  const [sessionId, salonId] = raw.split(":");
  if (!sessionId || !salonId) return null;
  const { data } = await createAdminClient()
    .from("impersonation_sessions")
    .select("salon_id, ended_at, expires_at")
    .eq("id", sessionId)
    .maybeSingle();
  if (!data || data.ended_at || new Date(data.expires_at) < new Date() || data.salon_id !== salonId)
    return null;
  return salonId;
}
