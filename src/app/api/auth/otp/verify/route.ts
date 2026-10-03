import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, errors, handle, json, parseJson, requestLocale, userClient } from "@/lib/api";
import { clientIp, enforceLimit } from "@/lib/rate-limit";
import { formatPhoneE164, normalizePhone } from "@/lib/utils";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TablesUpdate } from "@/lib/supabase/database.types";

const schema = z.object({
  phone: z.string().min(6).max(20),
  code: z.string().regex(/^\d{4,8}$/),
  fullName: z.string().trim().min(1).max(80).optional(),
  locale: z.string().optional(),
});

/**
 * POST /api/auth/otp/verify — verifies the SMS code and sets the session cookies.
 * Returns the user and whether the account was just created (to prompt for a name).
 */
export const POST = handle(async (req: NextRequest) => {
  const body = await parseJson(req, schema);
  const digits = normalizePhone(body.phone);
  await enforceLimit("otp_ip", clientIp(req.headers));

  const supabase = await userClient();
  const { data, error } = await supabase.auth.verifyOtp({
    phone: formatPhoneE164(digits),
    token: body.code,
    type: "sms",
  });
  if (error || !data.user) {
    if (error?.status === 403 || /expired|invalid/i.test(error?.message ?? "")) {
      throw errors.unprocessable("invalid_code", "The code is invalid or has expired");
    }
    throw new ApiError(error?.status ?? 500, "otp_verify_failed", error?.message ?? "Verification failed");
  }

  const user = data.user;
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, preferred_locale, is_platform_admin")
    .eq("id", user.id)
    .maybeSingle();
  const isNew = !profile?.full_name;
  const locale = requestLocale(req, body.locale);
  const patch: TablesUpdate<"profiles"> = {};
  if (body.fullName) patch.full_name = body.fullName;
  if (isNew) patch.preferred_locale = locale;
  if (Object.keys(patch).length) await admin.from("profiles").update(patch).eq("id", user.id);

  const { data: memberships } = await admin
    .from("salon_members")
    .select("role, salons(id, slug, name)")
    .eq("user_id", user.id);

  return json({
    ok: true,
    user: {
      id: user.id,
      phone: digits,
      fullName: body.fullName ?? profile?.full_name ?? null,
      isPlatformAdmin: profile?.is_platform_admin ?? false,
    },
    isNew,
    salons: (memberships ?? []).map((m) => ({
      id: m.salons?.id,
      slug: m.salons?.slug,
      name: m.salons?.name,
      role: m.role,
    })),
  });
});
