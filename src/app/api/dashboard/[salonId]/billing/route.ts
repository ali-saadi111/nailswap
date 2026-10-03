import type { NextRequest } from "next/server";
import { handle, json, ok, requireSalonRole, userClient } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { MANUAL_METHODS, TOPUP_PACKS, getCardProvider } from "@/lib/payments";

export const dynamic = "force-dynamic";

/** GET /api/dashboard/:salonId/billing — subscription, plans, quota, invoices, payments, options. */
export const GET = handle(async (_req: NextRequest, ctx: { params: Promise<{ salonId: string }> }) => {
  const { salonId } = await ctx.params;
  await requireSalonRole(salonId, "manager");
  const supabase = await userClient();
  const admin = createAdminClient();
  const [{ data: subscription }, { data: plans }, quotaRows, { data: invoices }, { data: payments }] =
    await Promise.all([
      supabase.from("subscriptions").select("*, plans(*)").eq("salon_id", salonId).maybeSingle(),
      supabase.from("plans").select("*").eq("is_active", true).order("price_usd"),
      admin.rpc("salon_ai_quota", { p_salon_id: salonId }),
      supabase
        .from("invoices")
        .select(
          "id, number, status, currency, total, line_items, period_start, period_end, due_at, paid_at, pdf_path, created_at",
        )
        .eq("salon_id", salonId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("payments")
        .select(
          "id, invoice_id, purpose, amount, currency, method, provider, status, reference_note, created_at",
        )
        .eq("salon_id", salonId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
  const quota = (ok(quotaRows) ?? [])[0] ?? null;
  return json({
    subscription,
    plans,
    quota,
    invoices: (invoices ?? []).map((i) => ({
      ...i,
      pdfUrl: `/api/dashboard/${salonId}/invoices/${i.id}/pdf`,
    })),
    payments: payments ?? [],
    options: {
      card: getCardProvider()?.name ?? null,
      manualMethods: MANUAL_METHODS,
      topupPacks: TOPUP_PACKS,
    },
  });
});
