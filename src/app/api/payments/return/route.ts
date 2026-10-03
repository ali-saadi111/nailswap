import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { absoluteUrl, handle, parseQuery, requestLocale } from "@/lib/api";
import { verifyAndSettle } from "@/lib/billing/checkout";
import { log, errorMessage } from "@/lib/logger";

export const dynamic = "force-dynamic";

const schema = z.object({ paymentId: z.string().uuid(), locale: z.string().optional() });

/**
 * GET /api/payments/return?paymentId= — the gateway sends the payer back here. The payment is
 * verified server-to-server (never trusting the redirect) and the user lands on the billing page
 * with `?status=paid|pending|failed`.
 */
export const GET = handle(async (req: NextRequest) => {
  const q = parseQuery(req, schema);
  const locale = requestLocale(req, q.locale);
  let status = "pending";
  try {
    const result = await verifyAndSettle(q.paymentId);
    status = result.status;
  } catch (err) {
    log.error("payment return verification failed", { paymentId: q.paymentId, error: errorMessage(err) });
    status = "failed";
  }
  return NextResponse.redirect(
    absoluteUrl(`/${locale}/dashboard/billing?status=${status}&paymentId=${q.paymentId}`),
    { status: 303 },
  );
});
