export type PaymentPurpose = "subscription" | "topup" | "deposit";
export type ManualMethod = "cash" | "whish" | "omt" | "bank_transfer";

export interface CreateCheckoutInput {
  /** Our payments.id (used as the gateway order id). */
  paymentId: string;
  amount: number;
  currency: string;
  description: string;
  purpose: PaymentPurpose;
  salonId: string;
  /** Where the gateway returns the payer after completion. */
  returnUrl: string;
  cancelUrl: string;
  customer?: { email?: string; phone?: string; name?: string };
}

export interface CheckoutSession {
  /** Hosted checkout URL to redirect the payer to. */
  redirectUrl: string;
  /** Gateway session/order identifier stored on payments.provider_session_id. */
  sessionId: string;
}

export type GatewayPaymentStatus = "paid" | "pending" | "failed" | "refunded";

export interface CardPaymentProvider {
  readonly name: string;
  isConfigured(): boolean;
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>;
  /** Server-to-server verification of a payment after the return redirect or a webhook. */
  verify(paymentId: string): Promise<{ status: GatewayPaymentStatus; providerRef?: string; raw: unknown }>;
  /** Validates webhook authenticity. */
  verifyWebhook(headers: Headers, rawBody: string): boolean;
}
