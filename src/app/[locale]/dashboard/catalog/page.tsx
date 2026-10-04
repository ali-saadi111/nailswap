import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getDashboardContext } from "@/lib/dashboard/context";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicMediaUrl } from "@/lib/storage";
import { CatalogView } from "./catalog-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard" });
  return { title: t("catalog") };
}

export default async function CatalogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await getDashboardContext();
  if (!ctx.salon) redirect({ href: "/dashboard/onboarding", locale });
  if (ctx.role === "staff") redirect({ href: "/dashboard/calendar", locale });
  const salon = ctx.salon!;
  const sp = await searchParams;
  const client = ctx.role === "admin" ? createAdminClient() : await createClient();
  const [{ data: designs }, { data: polishes }, { data: services }] = await Promise.all([
    client
      .from("designs")
      .select(
        "id, slug, name, description, category, shape, length, price_addon, duration_addon_min, cover_path, prompt_text, tags, is_visible, is_featured, sort_order, tryon_count, booking_count, design_services(service_id), design_polishes(polish_id)",
      )
      .eq("salon_id", salon.id)
      .order("sort_order"),
    client
      .from("polishes")
      .select(
        "id, brand, collection, shade_name, shade_code, finish, hex_color, in_stock, swatch_path, sort_order",
      )
      .eq("salon_id", salon.id)
      .order("sort_order"),
    client
      .from("services")
      .select(
        "id, name, category, price, duration_min, buffer_min, is_active, supports_tryon, sort_order, description",
      )
      .eq("salon_id", salon.id)
      .order("sort_order"),
  ]);

  return (
    <CatalogView
      salon={{ id: salon.id, name: salon.name, currency: salon.currency, slug: salon.slug }}
      initialTab={sp.tab === "polishes" || sp.tab === "services" ? sp.tab : "designs"}
      designs={(designs ?? []).map((d) => ({
        ...d,
        price_addon: Number(d.price_addon),
        coverUrl: publicMediaUrl(d.cover_path),
        serviceIds: d.design_services.map((x) => x.service_id),
        polishIds: d.design_polishes.map((x) => x.polish_id),
      }))}
      polishes={(polishes ?? []).map((p) => ({ ...p, swatchUrl: publicMediaUrl(p.swatch_path) }))}
      services={(services ?? []).map((s) => ({ ...s, price: Number(s.price) }))}
    />
  );
}
