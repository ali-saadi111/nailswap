import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { listTrendingDesigns } from "@/lib/salons/trending";
import { TryonScreen } from "@/components/tryon/tryon-screen";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ui.tryon" });
  return { title: t("title") };
}

/** Try-on without a salon: trending designs from the directory, or a described look. */
export default async function TryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ designId?: string; jobId?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const designs = await listTrendingDesigns(24).catch(() => []);

  return (
    <div className="-mx-6 -mt-3 md:-mt-2">
      <TryonScreen
        salon={null}
        designs={designs.map((d) => ({
          id: d.id,
          name: d.name,
          category: d.category,
          shape: d.shape,
          length: d.length,
          priceAddon: d.priceAddon,
          coverUrl: d.coverUrl,
          salonId: d.salonId,
          salonSlug: d.salonSlug,
          salonName: d.salonName,
        }))}
        polishes={[]}
        initialDesignId={sp.designId ?? null}
        initialJobId={sp.jobId ?? null}
        closeHref="/"
      />
    </div>
  );
}
