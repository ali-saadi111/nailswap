import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKETS, publicMediaUrl, signedUrl } from "@/lib/storage";
import { publicEnv } from "@/lib/env";
import { ModerationQueue, type ModerationItem } from "./moderation-queue";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });
  return { title: t("moderation") };
}

export default async function ModerationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const admin = createAdminClient();
  const { data } = await admin
    .from("moderation_queue")
    .select(
      "id, kind, ref_id, salon_id, image_path, reason, status, created_at, reviewed_at, salons(name, slug, city, area)",
    )
    .order("status")
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = data ?? [];
  const reviewIds = rows.filter((r) => r.kind === "review").map((r) => r.ref_id);
  const designIds = rows.filter((r) => r.kind === "design").map((r) => r.ref_id);
  const [{ data: reviews }, { data: designs }] = await Promise.all([
    reviewIds.length
      ? admin
          .from("reviews")
          .select("id, rating, body, flagged_reason, clients(full_name)")
          .in("id", reviewIds)
      : Promise.resolve({ data: [] }),
    designIds.length
      ? admin
          .from("designs")
          .select("id, name, cover_path, shape, category, tryon_count, booking_count")
          .in("id", designIds)
      : Promise.resolve({ data: [] }),
  ]);

  const items: ModerationItem[] = await Promise.all(
    rows.map(async (r) => {
      const review = r.kind === "review" ? (reviews ?? []).find((x) => x.id === r.ref_id) : null;
      const design = r.kind === "design" ? (designs ?? []).find((x) => x.id === r.ref_id) : null;
      let imageUrl: string | null = null;
      if (r.image_path) {
        imageUrl =
          r.kind === "upload"
            ? await signedUrl(BUCKETS.tryon, r.image_path).catch(() => null)
            : publicMediaUrl(r.image_path);
      } else if (design?.cover_path) imageUrl = publicMediaUrl(design.cover_path);
      return {
        id: r.id,
        kind: r.kind,
        status: r.status,
        reason: r.reason,
        createdAt: r.created_at,
        salon: r.salons
          ? {
              name: r.salons.name,
              slug: r.salons.slug,
              area: r.salons.area ?? r.salons.city,
              url: `${publicEnv.appUrl}/${locale}/s/${r.salons.slug}`,
            }
          : null,
        title: review
          ? `“${(review.body ?? "").slice(0, 80)}”`
          : design
            ? design.name
            : r.kind === "upload"
              ? "Try-on photo"
              : r.ref_id,
        review: review
          ? {
              rating: review.rating,
              body: review.body,
              author: review.clients?.full_name ?? null,
              flagged: review.flagged_reason,
            }
          : null,
        design: design
          ? {
              shape: design.shape,
              category: design.category,
              tryons: design.tryon_count,
              bookings: design.booking_count,
            }
          : null,
        imageUrl,
      };
    }),
  );
  return <ModerationQueue items={items} />;
}
