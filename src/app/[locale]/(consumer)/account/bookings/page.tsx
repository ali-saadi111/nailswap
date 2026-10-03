import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { publicMediaUrl } from "@/lib/storage";
import { nowMs } from "@/lib/format";
import { BookingsList, type AccountBooking } from "./bookings-list";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ui.account" });
  return { title: t("bookingsTitle") };
}

export default async function AccountBookingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select(
      "id, status, source, starts_at, ends_at, total_price, currency, manage_token, created_at, salons(id, slug, name, logo_path, city, area, address, timezone, lat, lng), services(id, name), staff(id, display_name), designs(id, name, cover_path, category, shape), reviews(id, rating)",
    )
    .order("starts_at", { ascending: false })
    .limit(100);
  const now = nowMs();
  const bookings: AccountBooking[] = (data ?? []).map((b) => ({
    id: b.id,
    status: b.status,
    startsAt: b.starts_at,
    endsAt: b.ends_at,
    totalPrice: Number(b.total_price),
    currency: b.currency,
    manageToken: b.manage_token,
    isUpcoming: new Date(b.starts_at).getTime() > now && (b.status === "new" || b.status === "confirmed"),
    canReview: b.status === "completed" && !b.reviews,
    reviewRating: b.reviews?.rating ?? null,
    salon: b.salons
      ? {
          id: b.salons.id,
          slug: b.salons.slug,
          name: b.salons.name,
          area: b.salons.area,
          city: b.salons.city,
          address: b.salons.address,
          timezone: b.salons.timezone,
          lat: b.salons.lat,
          lng: b.salons.lng,
          logoUrl: publicMediaUrl(b.salons.logo_path),
        }
      : null,
    service: b.services ? { id: b.services.id, name: b.services.name } : null,
    staff: b.staff ? { id: b.staff.id, displayName: b.staff.display_name } : null,
    design: b.designs
      ? {
          id: b.designs.id,
          name: b.designs.name,
          coverUrl: publicMediaUrl(b.designs.cover_path),
          category: b.designs.category,
          shape: b.designs.shape,
        }
      : null,
  }));

  return <BookingsList bookings={bookings} />;
}
