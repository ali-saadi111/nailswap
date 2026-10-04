import { setRequestLocale } from "next-intl/server";
import { DiscoverSalons } from "@/components/discovery/discover-salons";
import { directoryQuerySchema, searchSalons } from "@/lib/salons/directory";

export const dynamic = "force-dynamic";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const result = await searchSalons(directoryQuerySchema.parse({ limit: 100 }))
    .then((data) => ({ ...data, loadError: false }))
    .catch(() => ({ items: [], total: 0, loadError: true }));
  return <DiscoverSalons items={result.items} loadError={result.loadError} />;
}
