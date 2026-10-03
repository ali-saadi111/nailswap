import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, errors, handle, json, parseJson, requestLocale, userClient } from "@/lib/api";
import { clientIp, enforceLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { formatPhoneE164, normalizePhone } from "@/lib/utils";

const schema = z.object({
  phone: z.string().min(6).max(20),
  turnstileToken: z.string().optional(),
  locale: z.string().optional(),
});

/**
 * POST /api/auth/otp/send — sends a one-time code by SMS (Supabase Auth phone OTP).
 * Rate limited per IP and per phone; protected by Turnstile when configured.
 */
export const POST = handle(async (req: NextRequest) => {
  const body = await parseJson(req, schema);
  const ip = clientIp(req.headers);
  const digits = normalizePhone(body.phone);
  if (!/^\d{10,15}$/.test(digits)) throw errors.unprocessable("invalid_phone", "Enter a valid phone number");

  await enforceLimit("otp_ip", ip);
  await enforceLimit("otp_phone", digits);
  if (!(await verifyTurnstile(body.turnstileToken, ip)))
    throw errors.forbidden("Turnstile verification failed");

  const supabase = await userClient();
  const locale = requestLocale(req, body.locale);
  const { error } = await supabase.auth.signInWithOtp({
    phone: formatPhoneE164(digits),
    options: { channel: "sms", data: { locale } },
  });
  if (error) {
    if (error.status === 429)
      throw errors.conflict("otp_too_soon", "Please wait before requesting another code");
    throw new ApiError(error.status ?? 500, "otp_send_failed", error.message);
  }
  return json({ ok: true, phone: digits });
});
