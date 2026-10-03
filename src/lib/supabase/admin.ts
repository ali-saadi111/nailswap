import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { env } from "@/lib/env";

let adminClient: ReturnType<typeof createSupabaseClient<Database>> | null = null;

/**
 * Service-role client. Bypasses RLS — use only in trusted server code paths
 * (job workers, webhooks, cron, storage signing) after authorization has been checked.
 */
export function createAdminClient() {
  if (adminClient) return adminClient;
  const e = env();
  adminClient = createSupabaseClient<Database>(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}
