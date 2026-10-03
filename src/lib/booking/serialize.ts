import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKETS, publicMediaUrl, signedUrl } from "@/lib/storage";
import type { Booking } from "@/lib/supabase/types";

/** Booking as returned to the client that made it (includes the manage token). */
export async function toBookingView(booking: Booking, opts: { includeToken?: boolean } = {}) {
  const admin = createAdminClient();
  const [{ data: salon }, { data: service }, { data: staff }, { data: design }] = await Promise.all([
    admin
      .from("salons")
      .select(
        "id, slug, name, address, city, phone, whatsapp_number, timezone, logo_path, brand_color, cancel_cutoff_hours, reschedule_cutoff_hours",
      )
      .eq("id", booking.salon_id)
      .single(),
    admin.from("services").select("id, name, duration_min").eq("id", booking.service_id).single(),
    admin.from("staff").select("id, display_name, avatar_path").eq("id", booking.staff_id).single(),
    booking.design_id
      ? admin.from("designs").select("id, name, cover_path").eq("id", booking.design_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return {
    id: booking.id,
    status: booking.status,
    source: booking.source,
    startsAt: booking.starts_at,
    endsAt: booking.ends_at,
    locale: booking.locale,
    servicePrice: Number(booking.service_price),
    designPrice: Number(booking.design_price),
    totalPrice: Number(booking.total_price),
    currency: booking.currency,
    depositAmount: Number(booking.deposit_amount),
    clientNotes: booking.client_notes,
    cancelReason: booking.cancel_reason,
    cancelledBy: booking.cancelled_by,
    tryonImageUrl: booking.tryon_image_path ? await signedUrl(BUCKETS.tryon, booking.tryon_image_path) : null,
    manageToken: opts.includeToken ? booking.manage_token : undefined,
    salon: salon
      ? {
          id: salon.id,
          slug: salon.slug,
          name: salon.name,
          address: salon.address,
          city: salon.city,
          phone: salon.phone,
          whatsappNumber: salon.whatsapp_number,
          timezone: salon.timezone,
          logoUrl: publicMediaUrl(salon.logo_path),
          brandColor: salon.brand_color,
          cancelCutoffHours: salon.cancel_cutoff_hours,
          rescheduleCutoffHours: salon.reschedule_cutoff_hours,
        }
      : null,
    service: service ? { id: service.id, name: service.name, durationMin: service.duration_min } : null,
    staff: staff
      ? { id: staff.id, displayName: staff.display_name, avatarUrl: publicMediaUrl(staff.avatar_path) }
      : null,
    design: design ? { id: design.id, name: design.name, coverUrl: publicMediaUrl(design.cover_path) } : null,
    createdAt: booking.created_at,
  };
}

export type BookingView = Awaited<ReturnType<typeof toBookingView>>;
