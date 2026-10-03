import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle, noContent, parseJson } from "@/lib/api";
import { clientIp, enforceLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClaims } from "@/lib/supabase/server";
import { getAnonId } from "@/lib/tryon/anon";
import type { Json } from "@/lib/supabase/database.types";

/** Events the browser may record directly (server-side pipelines record the rest). */
const CLIENT_EVENTS = [
  "page_view",
  "tryon_ar_start",
  "tryon_ar_capture",
  "book_click",
  "share",
  "qr_scan",
  "whatsapp_click",
] as const;

const schema = z.object({
  kind: z.enum(CLIENT_EVENTS),
  salonId: z.string().uuid().nullable().optional(),
  designId: z.string().uuid().nullable().optional(),
  polishId: z.string().uuid().nullable().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

/** POST /api/analytics — records a lightweight funnel event. Always 204. */
export const POST = handle(async (req: NextRequest) => {
  const body = await parseJson(req, schema);
  await enforceLimit("api_ip", clientIp(req.headers));
  const [claims, anonId] = await Promise.all([getClaims(), getAnonId(true)]);
  const payload = { ...(body.payload ?? {}) };
  const ua = req.headers.get("user-agent");
  if (ua) payload.ua = ua.slice(0, 200);
  const ref = req.headers.get("referer");
  if (ref) payload.referer = ref.slice(0, 300);
  await createAdminClient()
    .from("analytics_events")
    .insert({
      salon_id: body.salonId ?? null,
      kind: body.kind,
      design_id: body.designId ?? null,
      polish_id: body.polishId ?? null,
      user_id: claims.userId,
      anon_id: anonId,
      payload: payload as NonNullable<Json>,
    });
  return noContent();
});
