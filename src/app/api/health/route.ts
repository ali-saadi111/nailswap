import { handle, json } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { aiConfigured } from "@/lib/ai/tryon";
import { whatsappConfigured } from "@/lib/notifications/whatsapp";
import { smsConfigured } from "@/lib/notifications/sms";
import { emailConfigured } from "@/lib/notifications/email";
import { getCardProvider } from "@/lib/payments";

export const dynamic = "force-dynamic";

/** GET /api/health — liveness + which integrations are configured (no secrets). */
export const GET = handle(async () => {
  let database = "ok";
  try {
    const { error } = await createAdminClient().from("plans").select("code").limit(1);
    if (error) database = `error: ${error.message}`;
  } catch (err) {
    database = `error: ${err instanceof Error ? err.message : String(err)}`;
  }
  return json({
    ok: database === "ok",
    time: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
    database,
    integrations: {
      ai: aiConfigured(),
      whatsapp: whatsappConfigured(),
      sms: smsConfigured(),
      email: emailConfigured(),
      card: getCardProvider()?.name ?? null,
    },
  });
});
