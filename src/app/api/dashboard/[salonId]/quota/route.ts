import type { NextRequest } from "next/server";
import { handle, json, ok, requireSalonRole } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { TOPUP_PACKS } from "@/lib/payments";

export const dynamic = "force-dynamic";

/** GET /api/dashboard/:salonId/quota — AI try-on quota for the current billing period. */
export const GET = handle(async (_req: NextRequest, ctx: { params: Promise<{ salonId: string }> }) => {
  const { salonId } = await ctx.params;
  await requireSalonRole(salonId, "staff");
  const rows = ok(await createAdminClient().rpc("salon_ai_quota", { p_salon_id: salonId })) ?? [];
  const q = rows[0];
  if (!q) return json({ quota: null });
  const pct = q.quota > 0 ? Math.min(1, q.used / q.quota) : 1;
  return json({
    planCode: q.plan_code,
    subscriptionStatus: q.subscription_status,
    quota: q.quota,
    used: q.used,
    topupCredits: q.topup_credits,
    remaining: q.remaining,
    usedPct: Math.round(pct * 100),
    warning: pct >= 0.8,
    exhausted: q.remaining <= 0,
    periodStart: q.period_start,
    periodEnd: q.period_end,
    packs: TOPUP_PACKS,
  });
});
