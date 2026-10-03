import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient, getClaims } from "@/lib/supabase/server";
import { publicMediaUrl } from "@/lib/storage";
import { Profile } from "./profile";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ui.account" });
  return { title: t("profile") };
}

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const claims = await getClaims();
  const supabase = await createClient();
  const [{ data: profile }, { count: looks }, { data: bookings }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, phone, email, full_name, avatar_path, preferred_locale, created_at")
      .eq("id", claims.userId!)
      .maybeSingle(),
    supabase.from("saved_looks").select("id", { count: "exact", head: true }).eq("user_id", claims.userId!),
    supabase
      .from("bookings")
      .select("id, starts_at, status")
      .gt("starts_at", new Date().toISOString())
      .in("status", ["new", "confirmed"]),
  ]);

  return (
    <Profile
      user={{
        id: claims.userId!,
        phone: profile?.phone ?? claims.phone ?? "",
        email: profile?.email ?? null,
        fullName: profile?.full_name ?? null,
        avatarUrl: publicMediaUrl(profile?.avatar_path),
        preferredLocale: profile?.preferred_locale ?? "en",
        createdAt: profile?.created_at ?? null,
      }}
      looksCount={looks ?? 0}
      upcomingCount={bookings?.length ?? 0}
    />
  );
}
