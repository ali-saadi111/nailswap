import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ApiError } from "@/lib/api";
import { getPublicSalon } from "@/lib/salons/public";
import { TryonScreen } from "@/components/tryon/tryon-screen";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ui.tryon" });
  return { title: t("title") };
}

export default async function SalonTryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ designId?: string; polishId?: string; jobId?: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  let data: Awaited<ReturnType<typeof getPublicSalon>>;
  try {
    data = await getPublicSalon(slug);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const { salon, designs, polishes } = data;

  return (
    <TryonScreen
      salon={{ id: salon.id, slug: salon.slug, name: salon.name, currency: salon.currency }}
      designs={designs.map((d) => ({
        id: d.id,
        name: d.name,
        category: d.category,
        shape: d.shape,
        length: d.length,
        priceAddon: d.priceAddon,
        coverUrl: d.coverUrl,
        salonId: salon.id,
        salonSlug: salon.slug,
        salonName: salon.name,
        polishIds: d.polishIds,
      }))}
      polishes={polishes.map((p) => ({
        id: p.id,
        hexColor: p.hexColor,
        finish: p.finish,
        shadeName: p.shadeName,
        brand: p.brand,
      }))}
      initialDesignId={sp.designId ?? null}
      initialJobId={sp.jobId ?? null}
      closeHref={`/s/${salon.slug}`}
    />
  );
}
