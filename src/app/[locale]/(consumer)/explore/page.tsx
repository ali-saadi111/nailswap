import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { directoryQuerySchema, searchSalons, listCities } from "@/lib/salons/directory";
import { nextSlotsForSalons } from "@/lib/salons/next-slots";
import { ExploreList } from "./explore-list";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ui.explore" });
  return { title: t("title") };
}

export default async function ExplorePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ city?: string; q?: string; category?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const query = directoryQuerySchema.parse({
    limit: 100,
    city: sp.city || undefined,
    category: sp.category || undefined,
  });
  const [result, cities] = await Promise.all([
    searchSalons(query).catch(() => ({
      total: 0,
      items: [] as Awaited<ReturnType<typeof searchSalons>>["items"],
    })),
    listCities().catch(() => []),
  ]);
  const nextSlots = await nextSlotsForSalons(result.items.slice(0, 8).map((s) => s.id)).catch(() => ({}));

  return (
    <ExploreList
      items={result.items}
      cities={cities}
      nextSlots={nextSlots}
      initialCity={sp.city ?? ""}
      initialQuery={sp.q ?? ""}
      locale={locale}
    />
  );
}
