import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle, json, okOne, parseJson, requireUser, userClient } from "@/lib/api";
import { publicMediaUrl } from "@/lib/storage";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  city: z.string().trim().max(60).optional(),
  defaultLocale: z.enum(["en"]).default("en"),
  brandColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#8B5E3C"),
});

/**
 * POST /api/dashboard/salons — onboarding step 1: creates the salon (owner = caller), default
 * hours and the 14-day trial, then refreshes the session so `salon_roles` appears in the JWT.
 */
export const POST = handle(async (req: NextRequest) => {
  await requireUser();
  const body = await parseJson(req, schema);
  const supabase = await userClient();
  const salon = okOne(
    await supabase.rpc("create_salon", {
      p_name: body.name,
      p_slug: body.slug ?? body.name,
      p_city: body.city ?? undefined,
      p_default_locale: body.defaultLocale,
      p_brand_color: body.brandColor,
    }),
  );
  // New membership → new claims. Refresh so the proxy/dashboard sees the role immediately.
  await supabase.auth.refreshSession();
  return json(
    {
      salon: {
        id: salon.id,
        slug: salon.slug,
        name: salon.name,
        status: salon.status,
        onboardingStep: salon.onboarding_step,
        logoUrl: publicMediaUrl(salon.logo_path),
      },
    },
    { status: 201 },
  );
});

/** GET /api/dashboard/salons — salons the caller belongs to, with role. */
export const GET = handle(async () => {
  const auth = await requireUser();
  const supabase = await userClient();
  const { data, error } = await supabase
    .from("salon_members")
    .select(
      "role, salons(id, slug, name, status, logo_path, onboarding_step, onboarding_completed_at, directory_approved, city)",
    )
    .eq("user_id", auth.userId);
  if (error) throw error;
  return json({
    salons: (data ?? [])
      .filter((m) => m.salons)
      .map((m) => ({ ...m.salons!, logoUrl: publicMediaUrl(m.salons!.logo_path), role: m.role })),
  });
});
