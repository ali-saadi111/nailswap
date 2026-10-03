import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { errors, handle, json } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSignature } from "@/lib/notifications/whatsapp";
import { log } from "@/lib/logger";

/** GET /api/webhooks/whatsapp — Meta verification challenge. */
export const GET = handle(async (req: NextRequest) => {
  const p = req.nextUrl.searchParams;
  if (p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === env().WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  }
  throw errors.forbidden("Verification failed");
});

interface StatusUpdate {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  errors?: Array<{ code: number; title: string }>;
}
interface InboundMessage {
  from: string;
  id: string;
  type: string;
  text?: { body: string };
}

/**
 * POST /api/webhooks/whatsapp — delivery status updates (→ notifications.delivered_at / failed)
 * and inbound messages (logged; replies are handled by the salon over WhatsApp directly).
 */
export const POST = handle(async (req: NextRequest) => {
  const raw = await req.text();
  if (!verifyWebhookSignature(raw, req.headers.get("x-hub-signature-256")))
    throw errors.unauthorized("Bad signature");
  const body = JSON.parse(raw) as {
    entry?: Array<{
      changes?: Array<{ value?: { statuses?: StatusUpdate[]; messages?: InboundMessage[] } }>;
    }>;
  };
  const admin = createAdminClient();
  let statuses = 0;
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const s of change.value?.statuses ?? []) {
        statuses++;
        if (s.status === "delivered" || s.status === "read") {
          await admin
            .from("notifications")
            .update({ status: "delivered", delivered_at: new Date().toISOString() })
            .eq("provider_ref", s.id)
            .neq("status", "delivered");
        } else if (s.status === "failed") {
          await admin
            .from("notifications")
            .update({
              status: "failed",
              error: s.errors?.map((e) => `${e.code} ${e.title}`).join("; ") ?? "failed",
            })
            .eq("provider_ref", s.id);
        }
      }
      for (const m of change.value?.messages ?? []) {
        log.info("whatsapp inbound", { from: m.from.slice(0, 6) + "…", type: m.type, id: m.id });
      }
    }
  }
  return json({ ok: true, statuses });
});
