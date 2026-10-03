import type { NextRequest } from "next/server";
import { z } from "zod";
import { errors, handle, json, parseJson, requireSalonRole, userClient } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPhoneE164, normalizePhone } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** GET /api/dashboard/:salonId/members — team members with profiles and linked staff rows. */
export const GET = handle(async (_req: NextRequest, ctx: { params: Promise<{ salonId: string }> }) => {
  const { salonId } = await ctx.params;
  await requireSalonRole(salonId, "staff");
  const supabase = await userClient();
  const [{ data: members, error }, { data: staff }] = await Promise.all([
    supabase
      .from("salon_members")
      .select(
        "user_id, role, created_at, profiles!salon_members_user_id_fkey(full_name, phone, email, avatar_path)",
      )
      .eq("salon_id", salonId),
    supabase.from("staff").select("id, user_id, display_name").eq("salon_id", salonId),
  ]);
  if (error) throw error;
  return json({
    members: (members ?? []).map((m) => ({
      userId: m.user_id,
      role: m.role,
      fullName: m.profiles?.full_name ?? null,
      phone: m.profiles?.phone ?? null,
      email: m.profiles?.email ?? null,
      staff: staff?.find((s) => s.user_id === m.user_id) ?? null,
      joinedAt: m.created_at,
    })),
  });
});

const inviteSchema = z.object({
  phone: z.string().min(6).max(20),
  fullName: z.string().trim().min(1).max(80).optional(),
  role: z.enum(["manager", "staff"]),
  /** Link the invited account to an existing technician profile. */
  staffId: z.string().uuid().optional(),
});

/**
 * POST /api/dashboard/:salonId/members — owner adds a manager/technician by phone.
 * The account is created (phone pre-confirmed) if it does not exist; they sign in with OTP.
 */
export const POST = handle(async (req: NextRequest, ctx: { params: Promise<{ salonId: string }> }) => {
  const { salonId } = await ctx.params;
  const auth = await requireSalonRole(salonId, "owner");
  const body = await parseJson(req, inviteSchema);
  const digits = normalizePhone(body.phone);
  if (!/^\d{10,15}$/.test(digits)) throw errors.unprocessable("invalid_phone");
  const admin = createAdminClient();

  // Seat limit from the plan
  const [{ data: sub }, { count: memberCount }] = await Promise.all([
    admin.from("subscriptions").select("plan_code").eq("salon_id", salonId).maybeSingle(),
    admin.from("salon_members").select("user_id", { count: "exact", head: true }).eq("salon_id", salonId),
  ]);
  const { data: plan } = await admin
    .from("plans")
    .select("staff_seats")
    .eq("code", sub?.plan_code ?? "trial")
    .maybeSingle();
  const seats = plan?.staff_seats ?? 2;
  if ((memberCount ?? 0) >= seats + 1)
    throw errors.conflict("seat_limit", `Your plan includes ${seats} team seats`);

  let userId: string | null = null;
  const { data: existing } = await admin.from("profiles").select("id").eq("phone", digits).maybeSingle();
  if (existing) {
    userId = existing.id;
  } else {
    const { data: created, error } = await admin.auth.admin.createUser({
      phone: formatPhoneE164(digits),
      phone_confirm: true,
      user_metadata: { full_name: body.fullName ?? "", invited_to_salon: salonId },
    });
    if (error || !created.user) throw errors.badRequest("invite_failed", error?.message);
    userId = created.user.id;
    if (body.fullName) await admin.from("profiles").update({ full_name: body.fullName }).eq("id", userId);
  }

  const { error: memberErr } = await admin
    .from("salon_members")
    .upsert(
      { salon_id: salonId, user_id: userId, role: body.role, invited_by: auth.userId },
      { onConflict: "salon_id,user_id" },
    );
  if (memberErr) throw memberErr;
  if (body.staffId)
    await admin.from("staff").update({ user_id: userId }).eq("id", body.staffId).eq("salon_id", salonId);
  return json({ ok: true, userId, role: body.role }, { status: 201 });
});
