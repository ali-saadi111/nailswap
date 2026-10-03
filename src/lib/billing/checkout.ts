import "server-only";
import { addMonths } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { absoluteUrl, errors } from "@/lib/api";
import {
  MANUAL_METHODS,
  MANUAL_PAYMENT_INSTRUCTIONS,
  TOPUP_PACKS,
  getCardProvider,
  type ManualMethod,
  type TopupPackId,
} from "@/lib/payments";
import { log } from "@/lib/logger";
import type { AppLocale, PlanCode } from "@/lib/supabase/types";
import type { Json } from "@/lib/supabase/database.types";

export type CheckoutMethod = "card" | ManualMethod;

export interface CheckoutInput {
  salonId: string;
  locale: AppLocale;
  purpose: "subscription" | "topup";
  plan?: Exclude<PlanCode, "trial">;
  packId?: TopupPackId;
  method: CheckoutMethod;
  referenceNote?: string;
}

export type CheckoutResult =
  | {
      kind: "redirect";
      redirectUrl: string;
      paymentId: string;
      invoiceId: string;
      amount: number;
      currency: string;
    }
  | {
      kind: "manual";
      paymentId: string;
      invoiceId: string;
      invoiceNumber: string;
      amount: number;
      currency: string;
      method: ManualMethod;
      instructions: string;
    };

/**
 * Creates the invoice + pending payment for a plan purchase or a credit top-up and either
 * returns a hosted-checkout redirect (card) or the manual payment instructions.
 * Settlement happens in `settlePayment()` (webhook / return URL / admin confirmation); the
 * `on_payment_paid` trigger then activates the subscription or grants the credits.
 */
export async function startCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  const admin = createAdminClient();
  const { data: salon } = await admin
    .from("salons")
    .select("id, name, email, phone")
    .eq("id", input.salonId)
    .maybeSingle();
  if (!salon) throw errors.notFound("Salon");

  let amount: number;
  let description: string;
  let lineItems: Record<string, unknown>[];
  let periodStart: Date | null = null;
  let periodEnd: Date | null = null;
  let metadata: Record<string, unknown> = {};

  if (input.purpose === "subscription") {
    if (!input.plan) throw errors.badRequest("plan_required");
    const { data: plan } = await admin
      .from("plans")
      .select("*")
      .eq("code", input.plan)
      .eq("is_active", true)
      .maybeSingle();
    if (!plan) throw errors.notFound("Plan");
    const { data: sub } = await admin
      .from("subscriptions")
      .select("*")
      .eq("salon_id", input.salonId)
      .maybeSingle();
    const now = new Date();
    const renewingSamePlan =
      sub &&
      sub.plan_code === input.plan &&
      sub.status === "active" &&
      new Date(sub.current_period_end) > now;
    periodStart = renewingSamePlan ? new Date(sub.current_period_end) : now;
    periodEnd = addMonths(periodStart, 1);
    amount = Number(plan.price_usd);
    description = `${plan.name} plan (monthly) — ${salon.name}`;
    lineItems = [{ plan_code: plan.code, description: `${plan.name} plan (monthly)`, amount }];
    metadata = { plan_code: plan.code };
  } else {
    const pack = TOPUP_PACKS.find((p) => p.id === input.packId);
    if (!pack) throw errors.badRequest("pack_required");
    amount = pack.priceUsd;
    description = `${pack.credits} AI try-on credits — ${salon.name}`;
    lineItems = [{ credits: pack.credits, description: `${pack.credits} AI try-on credits`, amount }];
    metadata = { credits: pack.credits, pack_id: pack.id };
  }

  const { data: invoice, error: invErr } = await admin
    .from("invoices")
    .insert({
      salon_id: input.salonId,
      subscription_id:
        input.purpose === "subscription"
          ? ((await admin.from("subscriptions").select("id").eq("salon_id", input.salonId).maybeSingle()).data
              ?.id ?? null)
          : null,
      status: "open",
      currency: "USD",
      subtotal: amount,
      tax: 0,
      total: amount,
      line_items: lineItems as NonNullable<Json>,
      period_start: periodStart?.toISOString() ?? null,
      period_end: periodEnd?.toISOString() ?? null,
    })
    .select("*")
    .single();
  if (invErr || !invoice) throw new Error(`invoice insert failed: ${invErr?.message}`);

  const isCard = input.method === "card";
  const { data: payment, error: payErr } = await admin
    .from("payments")
    .insert({
      salon_id: input.salonId,
      invoice_id: invoice.id,
      purpose: input.purpose,
      amount,
      currency: "USD",
      method: isCard ? "card" : input.method,
      provider: isCard ? (getCardProvider()?.name ?? "none") : "manual",
      status: "pending",
      reference_note: input.referenceNote ?? null,
      metadata: metadata as NonNullable<Json>,
    })
    .select("*")
    .single();
  if (payErr || !payment) throw new Error(`payment insert failed: ${payErr?.message}`);

  if (isCard) {
    const provider = getCardProvider();
    if (!provider)
      throw errors.unavailable("card_unavailable", "Card payments are not enabled. Use a manual method.");
    const session = await provider.createCheckout({
      paymentId: payment.id,
      amount,
      currency: "USD",
      description,
      purpose: input.purpose,
      salonId: input.salonId,
      returnUrl: absoluteUrl(`/api/payments/return?paymentId=${payment.id}&locale=${input.locale}`),
      cancelUrl: absoluteUrl(`/${input.locale}/dashboard/billing?status=cancelled&paymentId=${payment.id}`),
      customer: { email: salon.email ?? undefined, phone: salon.phone ?? undefined, name: salon.name },
    });
    await admin.from("payments").update({ provider_session_id: session.sessionId }).eq("id", payment.id);
    return {
      kind: "redirect",
      redirectUrl: session.redirectUrl,
      paymentId: payment.id,
      invoiceId: invoice.id,
      amount,
      currency: "USD",
    };
  }

  if (!MANUAL_METHODS.includes(input.method as ManualMethod)) throw errors.badRequest("invalid_method");
  const method = input.method as ManualMethod;
  return {
    kind: "manual",
    paymentId: payment.id,
    invoiceId: invoice.id,
    invoiceNumber: invoice.number,
    amount,
    currency: "USD",
    method,
    instructions: MANUAL_PAYMENT_INSTRUCTIONS[method][input.locale],
  };
}

/**
 * Marks a payment paid/failed/refunded. Idempotent: an already-paid payment is left untouched.
 * The database trigger settles the invoice, activates the subscription or grants credits.
 */
export async function settlePayment(
  paymentId: string,
  status: "paid" | "failed" | "refunded",
  opts: {
    providerRef?: string | null;
    raw?: unknown;
    markedBy?: string | null;
    referenceNote?: string | null;
  } = {},
) {
  const admin = createAdminClient();
  const { data: payment } = await admin.from("payments").select("*").eq("id", paymentId).maybeSingle();
  if (!payment) throw errors.notFound("Payment");
  if (payment.status === "paid" && status === "paid") return payment;
  const { data, error } = await admin
    .from("payments")
    .update({
      status,
      provider_ref: opts.providerRef ?? payment.provider_ref,
      marked_by: opts.markedBy ?? payment.marked_by,
      reference_note: opts.referenceNote ?? payment.reference_note,
      metadata: {
        ...(payment.metadata as Record<string, unknown>),
        ...(opts.raw ? { gateway: opts.raw } : {}),
      } as NonNullable<Json>,
    })
    .eq("id", paymentId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  log.info("payment settled", { paymentId, status, purpose: payment.purpose, salonId: payment.salon_id });
  return data;
}

/** Verifies a card payment with the gateway and settles it. */
export async function verifyAndSettle(paymentId: string) {
  const provider = getCardProvider();
  if (!provider) throw errors.unavailable("card_unavailable");
  const result = await provider.verify(paymentId);
  if (result.status === "pending") return { status: "pending" as const };
  const payment = await settlePayment(paymentId, result.status, {
    providerRef: result.providerRef,
    raw: result.raw,
  });
  return { status: result.status, payment };
}
