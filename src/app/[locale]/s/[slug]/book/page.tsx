import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ApiError } from "@/lib/api";
import { getPublicSalon } from "@/lib/salons/public";
import { BookingFlow } from "@/components/booking/booking-flow";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "booking" });
  return { title: t("title") };
}

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{
    serviceId?: string;
    designId?: string;
    staffId?: string;
    date?: string;
    tryonJobId?: string;
  }>;
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
  const { salon, services, designs, staff } = data;

  return (
    <BookingFlow
      salon={{
        id: salon.id,
        slug: salon.slug,
        name: salon.name,
        currency: salon.currency,
        timezone: salon.timezone,
        bookingMode: salon.booking_mode,
        address: salon.address,
        area: salon.area,
        city: salon.city,
        lat: salon.lat,
        lng: salon.lng,
        cancelCutoffHours: salon.cancel_cutoff_hours,
        rescheduleCutoffHours: salon.reschedule_cutoff_hours,
        depositRequired: salon.deposit_required,
        depositAmount: Number(salon.deposit_amount),
        maxAdvanceDays: salon.max_advance_days,
        whatsappNumber: salon.whatsapp_number,
      }}
      services={services.map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        price: Number(s.price),
        durationMin: s.duration_min,
        supportsTryon: s.supports_tryon,
      }))}
      designs={designs.map((d) => ({
        id: d.id,
        name: d.name,
        category: d.category,
        shape: d.shape,
        length: d.length,
        priceAddon: d.priceAddon,
        durationAddonMin: d.durationAddonMin,
        coverUrl: d.coverUrl,
        serviceIds: d.serviceIds,
      }))}
      staff={staff.map((s) => ({
        id: s.id,
        displayName: s.displayName,
        avatarUrl: s.avatarUrl,
        serviceIds: s.serviceIds,
        acceptsOnlineBooking: s.acceptsOnlineBooking,
      }))}
      initialServiceId={sp.serviceId ?? null}
      initialDesignId={sp.designId ?? null}
      initialStaffId={sp.staffId ?? null}
      initialDate={sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : null}
      tryonJobId={sp.tryonJobId ?? null}
    />
  );
}
