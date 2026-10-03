import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { BUCKETS, signedUrls } from "@/lib/storage";
import { LooksGrid, type SavedLook } from "./looks-grid";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ui.account" });
  return { title: t("looksTitle") };
}

export default async function LooksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const supabase = await createClient();
  const { data } = await supabase
    .from("saved_looks")
    .select(
      "id, title, image_path, created_at, job_id, salons(id, slug, name), designs(id, name, category, shape, cover_path), polishes(id, shade_name, hex_color), tryon_jobs(params)",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = data ?? [];
  const urls = await signedUrls(
    BUCKETS.tryon,
    rows.map((l) => l.image_path),
  ).catch(() => rows.map(() => ""));
  const looks: SavedLook[] = rows.map((l, i) => {
    const params = (l.tryon_jobs?.params ?? {}) as { shape?: string; mode?: string };
    return {
      id: l.id,
      title: l.title,
      imageUrl: urls[i] || null,
      createdAt: l.created_at,
      jobId: l.job_id,
      shape: l.designs?.shape ?? params.shape ?? "almond",
      kind: "ai",
      salon: l.salons ? { id: l.salons.id, slug: l.salons.slug, name: l.salons.name } : null,
      design: l.designs
        ? {
            id: l.designs.id,
            name: l.designs.name,
            category: l.designs.category,
            coverUrl: l.designs.cover_path,
          }
        : null,
      polish: l.polishes
        ? { id: l.polishes.id, shadeName: l.polishes.shade_name, hexColor: l.polishes.hex_color }
        : null,
    };
  });
  return <LooksGrid initial={looks} />;
}
