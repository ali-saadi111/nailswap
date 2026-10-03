import "server-only";
import { env } from "@/lib/env";

/** Twilio Programmable SMS — used as the fallback when WhatsApp delivery is not possible. */
export function smsConfigured() {
  const e = env();
  return Boolean(e.TWILIO_ACCOUNT_SID && e.TWILIO_AUTH_TOKEN && e.TWILIO_FROM_NUMBER);
}

export class SmsError extends Error {
  constructor(
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "SmsError";
  }
}

export async function sendSms(toE164Digits: string, body: string): Promise<{ id: string }> {
  const e = env();
  const auth = Buffer.from(`${e.TWILIO_ACCOUNT_SID}:${e.TWILIO_AUTH_TOKEN}`).toString("base64");
  const params = new URLSearchParams({ To: `+${toE164Digits}`, From: e.TWILIO_FROM_NUMBER!, Body: body });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${e.TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
      signal: AbortSignal.timeout(15_000),
    },
  );
  const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string; code?: number };
  if (!res.ok || !json.sid) {
    throw new SmsError(json.message ?? `Twilio ${res.status}`, res.status === 429 || res.status >= 500);
  }
  return { id: json.sid };
}
