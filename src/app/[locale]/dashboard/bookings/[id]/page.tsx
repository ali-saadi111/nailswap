import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getDashboardContext } from "@/lib/dashboard/context";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKETS, publicMediaUrl, signedUrl } from "@/lib/storage";
import { BookingDetail } from "./booking-detail";

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const ctx = await getDashboardContext();
  if (!ctx.salon) redirect({ href: "/dashboard/onboarding", locale });
  const salon = ctx.salon!;
  const client = ctx.role === "admin" ? createAdminClient() : await createClient();
  const { data: b } = await client
    .from("bookings")
    .select(
      "id, starts_at, ends_at, status, source, staff_id, service_id, design_id, client_id, client_notes, staff_notes, cancel_reason, service_price, design_price, total_price, deposit_amount, currency, tryon_image_path, created_at, clients(id, full_name, phone, email, visit_count, no_show_count, notes), services(name, duration_min), designs(name, category, cover_path, shape), staff(display_name)",
    )
    .eq("id", id)
    .eq("salon_id", salon.id)
    .maybeSingle();
  if (!b) notFound();

  const [{ data: events }, { data: staff }, tryonUrl] = await Promise.all([
    client
      .from("booking_events")
      .select("id, type, actor_role, payload, created_at")
      .eq("booking_id", id)
      .order("created_at"),
    client
      .from("staff")
      .select("id, display_name")
      .eq("salon_id", salon.id)
      .eq("is_active", true)
      .order("sort_order"),
    b.tryon_image_path
      ? signedUrl(BUCKETS.tryon, b.tryon_image_path).catch(() => null)
      : Promise.resolve(null),
  ]);

  return (
    <BookingDetail
      salon={{ id: salon.id, name: salon.name, timezone: salon.timezone, currency: salon.currency }}
      booking={{
        id: b.id,
        startsAt: b.starts_at,
        endsAt: b.ends_at,
        status: b.status,
        source: b.source,
        staffId: b.staff_id,
        staffName: b.staff?.display_name ?? "",
        serviceName: b.services?.name ?? "",
        durationMin: b.services?.duration_min ?? 0,
        design: b.designs
          ? {
              name: b.designs.name,
              category: b.designs.category,
              coverUrl: publicMediaUrl(b.designs.cover_path),
              shape: b.designs.shape,
            }
          : null,
        client: b.clients
          ? {
              id: b.clients.id,
              name: b.clients.full_name,
              phone: b.clients.phone,
              email: b.clients.email,
              visits: b.clients.visit_count,
              noShows: b.clients.no_show_count,
              notes: b.clients.notes,
            }
          : null,
        clientNotes: b.client_notes,
        staffNotes: b.staff_notes,
        cancelReason: b.cancel_reason,
        servicePrice: Number(b.service_price),
        designPrice: Number(b.design_price),
        totalPrice: Number(b.total_price),
        depositAmount: Number(b.deposit_amount),
        currency: b.currency,
        tryonImageUrl: tryonUrl,
        createdAt: b.created_at,
        events: (events ?? []).map((e) => ({
          id: e.id,
          type: e.type,
          actorRole: e.actor_role,
          createdAt: e.created_at,
        })),
      }}
      staff={(staff ?? []).map((s) => ({ id: s.id, name: s.display_name }))}
      canEdit={ctx.role !== "staff"}
    />
  );
}
