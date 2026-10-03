import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle, json, parseJson, requestLocale, requireSalonRole } from "@/lib/api";
import { startCheckout } from "@/lib/billing/checkout";

const schema = z.discriminatedUnion("purpose", [
  z.object({
    purpose: z.literal("subscription"),
    plan: z.enum(["basic", "pro"]),
    method: z.enum(["card", "cash", "whish", "omt", "bank_transfer"]),
    referenceNote: z.string().trim().max(120).optional(),
    locale: z.enum(["en"]).optional(),
  }),
  z.object({
    purpose: z.literal("topup"),
    packId: z.enum(["pack_50", "pack_200", "pack_500"]),
    method: z.enum(["card", "cash", "whish", "omt", "bank_transfer"]),
    referenceNote: z.string().trim().max(120).optional(),
    locale: z.enum(["en"]).optional(),
  }),
]);

/**
 * POST /api/dashboard/:salonId/billing/checkout — owner buys a plan or a credit pack.
 * Card → `{ kind: "redirect", redirectUrl }` (MPGS hosted checkout).
 * Manual → `{ kind: "manual", instructions, invoiceNumber }`; an admin confirms the payment.
 */
export const POST = handle(async (req: NextRequest, ctx: { params: Promise<{ salonId: string }> }) => {
  const { salonId } = await ctx.params;
  await requireSalonRole(salonId, "owner");
  const body = await parseJson(req, schema);
  const result = await startCheckout({
    salonId,
    locale: requestLocale(req, body.locale),
    purpose: body.purpose,
    plan: body.purpose === "subscription" ? body.plan : undefined,
    packId: body.purpose === "topup" ? body.packId : undefined,
    method: body.method,
    referenceNote: body.referenceNote,
  });
  return json(result, { status: 201 });
});
