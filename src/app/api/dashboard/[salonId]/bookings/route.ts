import { after, type NextRequest } from "next/server";
import { z } from "zod";
import { errors, handle, json, okOne, parseJson, requireSalonRole } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchForBooking } from "@/lib/notifications/dispatch";
import { toBookingView } from "@/lib/booking/serialize";
import { normalizePhone } from "@/lib/utils";

const schema = z.object({
  serviceId: z.string().uuid(),
  staffId: z.string().uuid().nullable().optional(),
  designId: z.string().uuid().nullable().optional(),
  startsAt: z.string().datetime({ offset: true }),
  clientName: z.string().trim().min(2).max(80),
  clientPhone: z.string().min(6).max(20),
  notes: z.string().trim().max(500).optional(),
  locale: z.enum(["en"]).optional(),
  /** Skip client notifications (e.g. walk-in already at the counter). */
  silent: z.boolean().default(false),
});

/**
 * POST /api/dashboard/:salonId/bookings — staff creates a booking (walk-in / phone).
 * Uses the same `book_slot` rules as online booking; set the salon's lead time to 0 to allow
 * immediate walk-ins.
 */
export const POST = handle(async (req: NextRequest, ctx: { params: Promise<{ salonId: string }> }) => {
  const { salonId } = await ctx.params;
  const auth = await requireSalonRole(salonId, "staff");
  const body = await parseJson(req, schema);
  const phone = normalizePhone(body.clientPhone);
  if (!/^\d{10,15}$/.test(phone)) throw errors.unprocessable("invalid_phone");
  const admin = createAdminClient();
  const { data: salon } = await admin.from("salons").select("default_locale").eq("id", salonId).single();

  const booking = okOne(
    await admin.rpc("book_slot", {
      p_salon_id: salonId,
      p_service_id: body.serviceId,
      p_staff_id: (body.staffId ?? null) as unknown as string,
      p_starts_at: body.startsAt,
      p_client_name: body.clientName,
      p_client_phone: phone,
      p_design_id: body.designId ?? undefined,
      p_client_notes: body.notes ?? undefined,
      p_source: "dashboard",
      p_locale: body.locale ?? salon?.default_locale ?? "en",
    }),
  );
  await admin.from("bookings").update({ created_by: auth.userId }).eq("id", booking.id);
  if (body.silent) {
    await admin
      .from("notifications")
      .update({ status: "cancelled" })
      .eq("booking_id", booking.id)
      .eq("status", "queued")
      .in("kind", ["booking_confirmation", "booking_pending"]);
  } else {
    after(() => dispatchForBooking(booking.id));
  }
  return json(await toBookingView(booking, { includeToken: true }), { status: 201 });
});
