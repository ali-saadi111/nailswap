import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle, json, parseJson, requireUser, userClient } from "@/lib/api";
import { getClaims } from "@/lib/supabase/server";
import { publicMediaUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/me — session summary for the header / dashboard switcher.
 * Returns `{ user: null }` for anonymous visitors (200, not 401).
 */
export const GET = handle(async () => {
  const claims = await getClaims();
  if (!claims.userId) return json({ user: null });
  const supabase = await userClient();
  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, phone, email, full_name, avatar_path, preferred_locale, is_platform_admin")
      .eq("id", claims.userId)
      .maybeSingle(),
    supabase
      .from("salon_members")
      .select("role, salons(id, slug, name, status, logo_path, onboarding_completed_at)")
      .eq("user_id", claims.userId),
  ]);
  return json({
    user: profile
      ? {
          id: profile.id,
          phone: profile.phone,
          email: profile.email,
          fullName: profile.full_name,
          avatarUrl: publicMediaUrl(profile.avatar_path),
          preferredLocale: profile.preferred_locale,
          isPlatformAdmin: profile.is_platform_admin,
        }
      : {
          id: claims.userId,
          phone: claims.phone,
          email: null,
          fullName: null,
          avatarUrl: null,
          preferredLocale: "en",
          isPlatformAdmin: claims.isPlatformAdmin,
        },
    salons: (memberships ?? [])
      .filter((m) => m.salons)
      .map((m) => ({
        id: m.salons!.id,
        slug: m.salons!.slug,
        name: m.salons!.name,
        status: m.salons!.status,
        logoUrl: publicMediaUrl(m.salons!.logo_path),
        onboardingComplete: Boolean(m.salons!.onboarding_completed_at),
        role: m.role,
      })),
  });
});

const patchSchema = z.object({
  fullName: z.string().trim().min(1).max(80).optional(),
  email: z.string().email().max(120).nullable().optional(),
  preferredLocale: z.enum(["en"]).optional(),
  avatarPath: z.string().max(300).nullable().optional(),
});

/** PATCH /api/auth/me — updates the signed-in user's profile. */
export const PATCH = handle(async (req: NextRequest) => {
  const auth = await requireUser();
  const body = await parseJson(req, patchSchema);
  const supabase = await userClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({
      ...(body.fullName !== undefined ? { full_name: body.fullName } : {}),
      ...(body.email !== undefined ? { email: body.email } : {}),
      ...(body.preferredLocale !== undefined ? { preferred_locale: body.preferredLocale } : {}),
      ...(body.avatarPath !== undefined ? { avatar_path: body.avatarPath } : {}),
    })
    .eq("id", auth.userId)
    .select("id, phone, email, full_name, preferred_locale")
    .single();
  if (error) throw error;
  return json({ ok: true, profile: data });
});
