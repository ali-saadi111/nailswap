import type { NextRequest } from "next/server";
import { handle, json, ok, requireInternal } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { afterBillingLifecycle } from "@/lib/billing/lifecycle";

export const maxDuration = 300;

/**
 * POST /api/internal/billing/lifecycle — runs the whole daily billing pass in one call
 * (for Vercel Cron when pg_cron is not used): run_billing_lifecycle() then the after-step.
 */
export const POST = handle(async (req: NextRequest) => {
  requireInternal(req);
  const changed = ok(await createAdminClient().rpc("run_billing_lifecycle"));
  const after = await afterBillingLifecycle();
  return json({ subscriptionsChanged: changed, ...after });
});

export const GET = POST;
