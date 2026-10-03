import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ApiError } from "@/lib/api";
import { loadBookingByToken } from "@/lib/booking/manage";
import { toBookingView } from "@/lib/booking/serialize";
import { createAdminClient } from "@/lib/supabase/admin";
import { nowMs } from "@/lib/format";
import { ManageBooking } from "./manage-booking";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "booking.manage" });
  return { title: t("title"), robots: { index: false } };
}

export default async function ManagePage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  let booking: Awaited<ReturnType<typeof loadBookingByToken>>;
  try {
    booking = await loadBookingByToken(token);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const [view, { data: client }, { data: salonExtra }] = await Promise.all([
    toBookingView(booking),
    createAdminClient().from("clients").select("full_name").eq("id", booking.client_id).maybeSingle(),
    createAdminClient()
      .from("salons")
      .select("area, lat, lng, max_advance_days")
      .eq("id", booking.salon_id)
      .maybeSingle(),
  ]);
  const now = nowMs();
  const starts = new Date(booking.starts_at).getTime();
  const live = booking.status === "new" || booking.status === "confirmed";

  return (
    <ManageBooking
      token={token}
      initial={{
        ...view,
        canCancel: live && starts - (view.salon?.cancelCutoffHours ?? 0) * 3_600_000 > now,
        canReschedule: live && starts - (view.salon?.rescheduleCutoffHours ?? 0) * 3_600_000 > now,
      }}
      clientName={client?.full_name ?? null}
      salonExtra={{
        area: salonExtra?.area ?? null,
        lat: salonExtra?.lat ?? null,
        lng: salonExtra?.lng ?? null,
        maxAdvanceDays: salonExtra?.max_advance_days ?? 30,
      }}
    />
  );
}
