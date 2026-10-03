import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { errors, handle, json, parseJson, requireAdmin } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp } from "@/lib/rate-limit";
import { IMPERSONATION_COOKIE } from "@/lib/admin/impersonation";

const schema = z.object({ salonId: z.string().uuid(), reason: z.string().trim().min(3).max(300) });

/**
 * POST /api/admin/impersonation — start viewing the dashboard as a salon (2h, audited).
 * Sets an httpOnly cookie with the session id; dashboard pages read it to pick the salon.
 * Admins already pass RLS, so no credentials are exchanged.
 */
export const POST = handle(async (req: NextRequest) => {
  const auth = await requireAdmin();
  const body = await parseJson(req, schema);
  const admin = createAdminClient();
  const { data: salon } = await admin
    .from("salons")
    .select("id, slug, name")
    .eq("id", body.salonId)
    .maybeSingle();
  if (!salon) throw errors.notFound("Salon");
  await admin
    .from("impersonation_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("admin_id", auth.userId)
    .is("ended_at", null);
  const { data: session, error } = await admin
    .from("impersonation_sessions")
    .insert({ admin_id: auth.userId, salon_id: salon.id, reason: body.reason })
    .select("id, expires_at")
    .single();
  if (error) throw error;
  await admin.from("admin_audit_log").insert({
    admin_id: auth.userId,
    action: "impersonate_start",
    target_type: "salon",
    target_id: salon.id,
    payload: { reason: body.reason, session_id: session.id },
    ip: clientIp(req.headers),
  });
  const res = NextResponse.json({ session: { id: session.id, expiresAt: session.expires_at }, salon });
  res.cookies.set(IMPERSONATION_COOKIE, `${session.id}:${salon.id}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(session.expires_at),
  });
  return res;
});

/** GET /api/admin/impersonation — current impersonation (if any). */
export const GET = handle(async (req: NextRequest) => {
  await requireAdmin();
  const raw = req.cookies.get(IMPERSONATION_COOKIE)?.value;
  if (!raw) return json({ session: null });
  const [sessionId] = raw.split(":");
  const { data } = await createAdminClient()
    .from("impersonation_sessions")
    .select("id, salon_id, reason, started_at, expires_at, ended_at, salons(slug, name)")
    .eq("id", sessionId)
    .maybeSingle();
  if (!data || data.ended_at || new Date(data.expires_at) < new Date()) return json({ session: null });
  return json({ session: data });
});

/** DELETE /api/admin/impersonation — stop impersonating. */
export const DELETE = handle(async (req: NextRequest) => {
  const auth = await requireAdmin();
  const raw = req.cookies.get(IMPERSONATION_COOKIE)?.value;
  const admin = createAdminClient();
  if (raw) {
    const [sessionId] = raw.split(":");
    await admin
      .from("impersonation_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("admin_id", auth.userId);
    await admin.from("admin_audit_log").insert({
      admin_id: auth.userId,
      action: "impersonate_end",
      target_type: "impersonation_session",
      target_id: sessionId,
      ip: clientIp(req.headers),
    });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(IMPERSONATION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
});
