import "server-only";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import type {
  CardPaymentProvider,
  CheckoutSession,
  CreateCheckoutInput,
  GatewayPaymentStatus,
} from "./types";

/**
 * Mastercard Payment Gateway Services (MPGS) Hosted Checkout — the gateway used by Lebanese
 * acquirers such as Areeba, BLOM and Bank Audi. Cards are entered on the gateway's page, so no
 * card data touches our servers.
 * Docs: https://ap-gateway.mastercard.com/api/documentation/integrationGuidelines/hostedCheckout/integrationModelHostedCheckout.html
 */
function authHeader() {
  const e = env();
  return `Basic ${Buffer.from(`merchant.${e.MPGS_MERCHANT_ID}:${e.MPGS_API_PASSWORD}`).toString("base64")}`;
}

async function mpgs<T>(path: string, method: "GET" | "POST" | "PUT", body?: unknown): Promise<T> {
  const e = env();
  const res = await fetch(`${e.MPGS_API_BASE_URL}/merchant/${e.MPGS_MERCHANT_ID}${path}`, {
    method,
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await res.json().catch(() => ({}))) as T & {
    result?: string;
    error?: { explanation?: string };
  };
  if (!res.ok || json.result === "ERROR") {
    throw new Error(`MPGS ${res.status}: ${json.error?.explanation ?? "request failed"}`);
  }
  return json;
}

interface InitiateCheckoutResponse {
  session: { id: string };
  successIndicator?: string;
}

interface OrderResponse {
  result: string;
  status?:
    "CAPTURED" | "AUTHORIZED" | "FAILED" | "CANCELLED" | "REFUNDED" | "INITIATED" | "PARTIALLY_REFUNDED";
  id: string;
  transaction?: { id: string; result: string }[];
}

export const mpgsProvider: CardPaymentProvider = {
  name: "mpgs",
  isConfigured() {
    const e = env();
    return e.PAYMENT_CARD_PROVIDER === "mpgs" && Boolean(e.MPGS_MERCHANT_ID && e.MPGS_API_PASSWORD);
  },

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    const res = await mpgs<InitiateCheckoutResponse>("/session", "POST", {
      apiOperation: "INITIATE_CHECKOUT",
      checkoutMode: "PAYMENT_LINK",
      interaction: {
        operation: "PURCHASE",
        merchant: { name: "NailSwap", url: env().NEXT_PUBLIC_APP_URL },
        returnUrl: input.returnUrl,
        cancelUrl: input.cancelUrl,
        displayControl: { billingAddress: "HIDE", customerEmail: "OPTIONAL" },
      },
      order: {
        id: input.paymentId,
        amount: input.amount.toFixed(2),
        currency: input.currency,
        description: input.description.slice(0, 127),
        reference: `${input.purpose}:${input.salonId}`,
      },
      customer:
        input.customer?.email || input.customer?.phone
          ? { email: input.customer.email, phone: input.customer.phone }
          : undefined,
    });
    // With PAYMENT_LINK checkout mode the gateway returns a hosted URL; otherwise use the
    // session id with the Hosted Checkout JS. We construct the payment page URL from the session.
    const base = env().MPGS_API_BASE_URL.replace(/\/api\/rest\/version\/\d+$/, "");
    return { sessionId: res.session.id, redirectUrl: `${base}/checkout/pay/${res.session.id}` };
  },

  async verify(paymentId: string) {
    const order = await mpgs<OrderResponse>(`/order/${encodeURIComponent(paymentId)}`, "GET");
    const map: Record<NonNullable<OrderResponse["status"]>, GatewayPaymentStatus> = {
      CAPTURED: "paid",
      AUTHORIZED: "paid",
      REFUNDED: "refunded",
      PARTIALLY_REFUNDED: "refunded",
      FAILED: "failed",
      CANCELLED: "failed",
      INITIATED: "pending",
    };
    const status = order.status ? map[order.status] : "pending";
    return { status, providerRef: order.transaction?.at(-1)?.id ?? order.id, raw: order };
  },

  verifyWebhook(headers: Headers) {
    // MPGS webhook notifications carry the merchant-configured secret in X-Notification-Secret.
    const secret = env().MPGS_WEBHOOK_SECRET;
    const given = headers.get("x-notification-secret");
    if (!secret || !given) return false;
    const a = Buffer.from(secret);
    const b = Buffer.from(given);
    return a.length === b.length && timingSafeEqual(a, b);
  },
};
