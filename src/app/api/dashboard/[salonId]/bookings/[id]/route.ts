import { after, type NextRequest } from "next/server";
import { z } from "zod";
import { errors, handle, json, parseJson, requireSalonRole, userClient } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchForBooking, queueNotification } from "@/lib/notifications/dispatch";
import { toBookingView } from "@/lib/booking/serialize";
import type { TablesUpdate } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

const schema = z.object({
  status: z.enum(["confirmed", "cancelled", "completed", "no_show"]).optional(),
  staffNotes: z.string().trim().max(1000).nullable().optional(),
  cancelReason: z.string().trim().max(300).optional(),
  /** Managers only: move or reassign. */
  startsAt: z.string().datetime({ offset: true }).optional(),
  staffId: z.string().uuid().optional(),
});

/** GET /api/dashboard/:salonId/bookings/:id — booking detail (RLS: managers, or the assigned staff). */
export const GET = handle(
  async (_req: NextRequest, ctx: { params: Promise<{ salonId: string; id: string }> }) => {
    const { salonId, id } = await ctx.params;
    await requireSalonRole(salonId, "staff");
    const supabase = await userClient();
    const { data: booking, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", id)
      .eq("salon_id", salonId)
      .maybeSingle();
    if (error) throw error;
    if (!booking) throw errors.notFound("Booking");
    const { data: client } = await supabase
      .from("clients")
      .select("id, full_name, phone, email, notes, visit_count, no_show_count")
      .eq("id", booking.client_id)
      .maybeSingle();
    const { data: events } = await supabase
      .from("booking_events")
      .select("type, actor_role, payload, created_at")
      .eq("booking_id", id)
      .order("created_at");
    return json({
      ...(await toBookingView(booking, { includeToken: true })),
      staffNotes: booking.staff_notes,
      client,
      events: events ?? [],
    });
  },
);

/**
 * PATCH /api/dashboard/:salonId/bookings/:id — status change / notes / reschedule.
 * Runs as the caller (RLS + trigger restrict staff to status & notes on their own bookings) and
 * queues the client notification for approvals and cancellations.
 */
export const PATCH = handle(
  async (req: NextRequest, ctx: { params: Promise<{ salonId: string; id: string }> }) => {
    const { salonId, id } = await ctx.params;
    const auth = await requireSalonRole(salonId, "staff");
    const body = await parseJson(req, schema);
    const supabase = await userClient();
    const { data: before } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", id)
      .eq("salon_id", salonId)
      .maybeSingle();
    if (!before) throw errors.notFound("Booking");

    const patch: TablesUpdate<"bookings"> = {};
    if (body.status) patch.status = body.status;
    if (body.staffNotes !== undefined) patch.staff_notes = body.staffNotes;
    if (body.status === "cancelled") {
      patch.cancel_reason = body.cancelReason ?? null;
      patch.cancelled_by = "salon";
    }
    if (body.startsAt || body.staffId) {
      if (auth.role === "staff") throw errors.forbidden("Only managers can move a booking");
      if (body.staffId) patch.staff_id = body.staffId;
      if (body.startsAt) {
        const duration = new Date(before.ends_at).getTime() - new Date(before.starts_at).getTime();
        patch.starts_at = body.startsAt;
        patch.ends_at = new Date(new Date(body.startsAt).getTime() + duration).toISOString();
      }
    }
    if (!Object.keys(patch).length) throw errors.badRequest("nothing_to_update");

    const { data: booking, error } = await supabase
      .from("bookings")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      if (error.code === "23P01")
        throw errors.conflict("slot_taken", "That technician is already booked at this time");
      throw error;
    }

    const admin = createAdminClient();
    const { data: client } = await admin.from("clients").select("phone").eq("id", booking.client_id).single();
    const notify = async (kind: "booking_approved" | "booking_cancelled" | "booking_rescheduled") => {
      if (!client) return;
      await queueNotification({
        salonId,
        bookingId: booking.id,
        kind,
        channel: "whatsapp",
        recipient: client.phone,
        locale: booking.locale,
      });
    };
    if (before.status === "new" && booking.status === "confirmed") await notify("booking_approved");
    if (before.status !== "cancelled" && booking.status === "cancelled") await notify("booking_cancelled");
    if (before.starts_at !== booking.starts_at && booking.status !== "cancelled")
      await notify("booking_rescheduled");
    after(() => dispatchForBooking(booking.id));

    return json(await toBookingView(booking, { includeToken: true }));
  },
);
