import { after, type NextRequest } from "next/server";
import { z } from "zod";
import { errors, handle, json, okOne, parseJson, requestLocale, requireUser } from "@/lib/api";
import { clientIp, enforceLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchForBooking } from "@/lib/notifications/dispatch";
import { toBookingView } from "@/lib/booking/serialize";
import { getAnonId } from "@/lib/tryon/anon";

const schema = z.object({
  salonId: z.string().uuid(),
  serviceId: z.string().uuid(),
  /** Omit for "any available technician". */
  staffId: z.string().uuid().nullable().optional(),
  designId: z.string().uuid().nullable().optional(),
  tryonJobId: z.string().uuid().nullable().optional(),
  startsAt: z.string().datetime({ offset: true }),
  clientName: z.string().trim().min(2).max(80),
  notes: z.string().trim().max(500).optional(),
  locale: z.enum(["en"]).optional(),
});

/**
 * POST /api/bookings — books a slot for the signed-in client.
 * The phone number comes from the verified session (OTP), never from the body. The database
 * exclusion constraint makes double booking impossible; conflicts return 409 `slot_taken`.
 */
export const POST = handle(async (req: NextRequest) => {
  const auth = await requireUser();
  if (!auth.phone) throw errors.forbidden("A verified phone number is required to book");
  const body = await parseJson(req, schema);
  const ip = clientIp(req.headers);
  const phone = auth.phone.replace(/\D/g, "");
  await enforceLimit("booking_ip", ip);
  await enforceLimit("booking_phone", phone);
  const locale = requestLocale(req, body.locale);
  const admin = createAdminClient();

  if (body.tryonJobId) {
    const { data: job } = await admin
      .from("tryon_jobs")
      .select("id, user_id, anon_id")
      .eq("id", body.tryonJobId)
      .maybeSingle();
    const anonId = await getAnonId(false);
    if (!job || !(job.user_id === auth.userId || (!job.user_id && job.anon_id === anonId))) {
      throw errors.forbidden("Try-on does not belong to you");
    }
    if (!job.user_id) await admin.from("tryon_jobs").update({ user_id: auth.userId }).eq("id", job.id);
  }

  const booking = okOne(
    await admin.rpc("book_slot", {
      p_salon_id: body.salonId,
      p_service_id: body.serviceId,
      // null = any available technician (the generated type omits null; PostgREST passes it through)
      p_staff_id: (body.staffId ?? null) as unknown as string,
      p_starts_at: body.startsAt,
      p_client_name: body.clientName,
      p_client_phone: phone,
      p_client_user_id: auth.userId,
      p_design_id: body.designId ?? undefined,
      p_tryon_job_id: body.tryonJobId ?? undefined,
      p_client_notes: body.notes ?? undefined,
      p_source: body.tryonJobId ? "tryon" : "direct",
      p_locale: locale,
    }),
  );

  await admin
    .from("profiles")
    .update({ full_name: body.clientName })
    .eq("id", auth.userId)
    .is("full_name", null);
  await admin.from("analytics_events").insert({
    salon_id: body.salonId,
    kind: "booking_created",
    design_id: body.designId ?? null,
    user_id: auth.userId,
    payload: { booking_id: booking.id, source: booking.source, status: booking.status },
  });
  after(() => dispatchForBooking(booking.id));

  return json(await toBookingView(booking, { includeToken: true }), { status: 201 });
});
