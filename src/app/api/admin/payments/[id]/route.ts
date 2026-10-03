import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle, json, parseJson, requireAdmin } from "@/lib/api";
import { settlePayment } from "@/lib/billing/checkout";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp } from "@/lib/rate-limit";

const schema = z.object({
  status: z.enum(["paid", "failed", "refunded"]),
  referenceNote: z.string().trim().max(200).optional(),
});

/** POST /api/admin/payments/:id — confirm a manual (cash/Whish/OMT/transfer) payment or mark it failed. */
export const POST = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const auth = await requireAdmin();
  const { id } = await ctx.params;
  const body = await parseJson(req, schema);
  const payment = await settlePayment(id, body.status, {
    markedBy: auth.userId,
    referenceNote: body.referenceNote,
  });
  await createAdminClient()
    .from("admin_audit_log")
    .insert({
      admin_id: auth.userId,
      action: "settle_payment",
      target_type: "payment",
      target_id: id,
      payload: {
        status: body.status,
        note: body.referenceNote ?? null,
        salon_id: payment.salon_id,
        amount: payment.amount,
      },
      ip: clientIp(req.headers),
    });
  return json({ payment });
});
