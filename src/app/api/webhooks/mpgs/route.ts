import type { NextRequest } from "next/server";
import { errors, handle, json } from "@/lib/api";
import { getCardProvider } from "@/lib/payments";
import { verifyAndSettle } from "@/lib/billing/checkout";
import { log } from "@/lib/logger";

/**
 * POST /api/webhooks/mpgs — MPGS transaction notifications. Authenticity is checked with the
 * merchant notification secret, then the order is re-verified with the gateway before settling.
 */
export const POST = handle(async (req: NextRequest) => {
  const provider = getCardProvider();
  if (!provider) throw errors.unavailable("card_unavailable");
  const raw = await req.text();
  if (!provider.verifyWebhook(req.headers, raw)) throw errors.unauthorized("Invalid notification secret");
  let body: { order?: { id?: string }; orderId?: string } = {};
  try {
    body = JSON.parse(raw);
  } catch {
    throw errors.badRequest("invalid_json");
  }
  const paymentId = body.order?.id ?? body.orderId;
  if (!paymentId || !/^[0-9a-f-]{36}$/i.test(paymentId)) return json({ ok: true, ignored: true });
  const result = await verifyAndSettle(paymentId);
  log.info("mpgs webhook", { paymentId, status: result.status });
  return json({ ok: true, status: result.status });
});
