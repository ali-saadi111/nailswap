import "server-only";
import { env } from "@/lib/env";

/**
 * Verifies a Cloudflare Turnstile token. When no secret is configured (local dev / CI)
 * verification is skipped so the flows remain testable.
 */
export async function verifyTurnstile(token: string | null | undefined, ip?: string): Promise<boolean> {
  const secret = env().TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip && ip !== "unknown") body.set("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5000),
    });
    const json = (await res.json()) as { success: boolean };
    return json.success === true;
  } catch {
    return false;
  }
}
