import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * WhatsApp Business Cloud API client.
 * https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 */
const GRAPH = "https://graph.facebook.com/v21.0";

export function whatsappConfigured() {
  const e = env();
  return Boolean(e.WHATSAPP_PHONE_NUMBER_ID && e.WHATSAPP_ACCESS_TOKEN);
}

export class WhatsAppError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "WhatsAppError";
  }
}

async function send(payload: Record<string, unknown>): Promise<{ id: string }> {
  const e = env();
  const res = await fetch(`${GRAPH}/${e.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${e.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...payload }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as {
    messages?: { id: string }[];
    error?: { message: string; code: number; error_subcode?: number };
  };
  if (!res.ok || !json.messages?.[0]) {
    const code = json.error?.code;
    // 131026: not a WhatsApp user → fall back to SMS (not retryable). 4/80007/130429: rate limits → retry.
    const retryable =
      res.status === 429 || res.status >= 500 || code === 4 || code === 80007 || code === 130429;
    throw new WhatsAppError(json.error?.message ?? `WhatsApp ${res.status}`, code, retryable);
  }
  return { id: json.messages[0].id };
}

/** Sends an approved template message. `params` fill {{1}}..{{n}} in the body. */
export async function sendTemplate(
  toE164Digits: string,
  templateName: string,
  languageCode: string,
  params: string[],
) {
  return send({
    to: toE164Digits,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }],
    },
  });
}

/** Free-form text (only allowed inside the 24h customer service window). */
export async function sendText(toE164Digits: string, body: string, previewUrl = true) {
  return send({ to: toE164Digits, type: "text", text: { body, preview_url: previewUrl } });
}

/** Image with caption (e.g. the try-on result attached to a confirmation). */
export async function sendImage(toE164Digits: string, imageUrl: string, caption?: string) {
  return send({ to: toE164Digits, type: "image", image: { link: imageUrl, caption } });
}

/** Maps app locale → WhatsApp template language code. */
export function whatsappLanguage(locale: "en" | "ar" | "fr") {
  return { en: "en", ar: "ar", fr: "fr" }[locale];
}

/** Verifies X-Hub-Signature-256 on webhook payloads. */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null) {
  const secret = env().WHATSAPP_APP_SECRET;
  if (!secret) return false;
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const given = signatureHeader.slice("sha256=".length);
  if (expected.length !== given.length) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(given, "hex"));
}

/** Builds a wa.me deep link with a prefilled message. */
export function waMeLink(phoneDigits: string, text: string) {
  return `https://wa.me/${phoneDigits.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}
