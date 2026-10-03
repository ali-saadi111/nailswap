import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle, json, parseJson } from "@/lib/api";
import { clientIp, enforceLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClaims } from "@/lib/supabase/server";
import { getAnonId } from "@/lib/tryon/anon";
import type { Json } from "@/lib/supabase/database.types";

const schema = z.object({
  mode: z.enum(["ar", "ai"]),
  salonId: z.string().uuid().nullable().optional(),
  designId: z.string().uuid().nullable().optional(),
  polishId: z.string().uuid().nullable().optional(),
  device: z.record(z.string(), z.unknown()).optional(),
});

/**
 * POST /api/tryon/session — records the start of an AR or AI try-on (analytics only; AR runs
 * fully on-device and is unlimited). Returns the session id to attach to an upload.
 */
export const POST = handle(async (req: NextRequest) => {
  const body = await parseJson(req, schema);
  await enforceLimit("api_ip", clientIp(req.headers));
  const [claims, anonId] = await Promise.all([getClaims(), getAnonId(true)]);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tryon_sessions")
    .insert({
      salon_id: body.salonId ?? null,
      user_id: claims.userId,
      anon_id: anonId,
      mode: body.mode,
      design_id: body.designId ?? null,
      polish_id: body.polishId ?? null,
      device: (body.device ?? {}) as NonNullable<Json>,
    })
    .select("id")
    .single();
  if (error) throw error;
  if (body.mode === "ar") {
    await admin.from("analytics_events").insert({
      salon_id: body.salonId ?? null,
      kind: "tryon_ar_start",
      design_id: body.designId ?? null,
      polish_id: body.polishId ?? null,
      user_id: claims.userId,
      anon_id: anonId,
      payload: { session_id: data.id },
    });
  }
  return json({ sessionId: data.id }, { status: 201 });
});
