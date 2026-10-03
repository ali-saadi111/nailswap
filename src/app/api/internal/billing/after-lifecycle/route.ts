import type { NextRequest } from "next/server";
import { handle, json, requireInternal } from "@/lib/api";
import { afterBillingLifecycle } from "@/lib/billing/lifecycle";

export const maxDuration = 300;

/** POST /api/internal/billing/after-lifecycle — cron (daily, after run_billing_lifecycle()): invoice PDFs + emails, quota warnings. */
export const POST = handle(async (req: NextRequest) => {
  requireInternal(req);
  return json(await afterBillingLifecycle());
});

export const GET = POST;
