import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ApiError } from "@/lib/api";
import { loadBookingByToken } from "@/lib/booking/manage";
import { toBookingView } from "@/lib/booking/serialize";
import { createAdminClient } from "@/lib/supabase/admin";
import { ReviewForm } from "./review-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "review" });
  return { title: t("title"), robots: { index: false } };
}

export default async function ReviewPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  let booking: Awaited<ReturnType<typeof loadBookingByToken>>;
  try {
    booking = await loadBookingByToken(token);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const [view, { data: existing }] = await Promise.all([
    toBookingView(booking),
    createAdminClient().from("reviews").select("id, rating").eq("booking_id", booking.id).maybeSingle(),
  ]);
  return <ReviewForm token={token} booking={view} existingRating={existing?.rating ?? null} />;
}
