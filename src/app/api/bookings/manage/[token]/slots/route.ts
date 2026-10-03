import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle, json, parseQuery } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadBookingByToken } from "@/lib/booking/manage";
import { getAvailability, getSlotsForDate, todayIn } from "@/lib/salons/availability";

export const dynamic = "force-dynamic";

const schema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  days: z.coerce.number().int().min(1).max(60).optional(),
});

/**
 * GET /api/bookings/manage/:token/slots?date=  → slots for that day (same technician & service)
 * GET /api/bookings/manage/:token/slots?days=14 → availability per day from today
 */
export const GET = handle(async (req: NextRequest, ctx: { params: Promise<{ token: string }> }) => {
  const { token } = await ctx.params;
  const q = parseQuery(req, schema);
  const booking = await loadBookingByToken(token);
  const admin = createAdminClient();
  const { data: salon } = await admin
    .from("salons")
    .select("id, timezone, slot_interval_min, min_lead_time_min, max_advance_days")
    .eq("id", booking.salon_id)
    .single();
  const opts = {
    serviceId: booking.service_id,
    designId: booking.design_id,
    staffId: booking.staff_id,
    excludeBookingId: booking.id,
  };
  if (q.days) {
    const from = todayIn(salon!.timezone);
    return json(
      { from, ...(await getAvailability(salon!, from, q.days, opts)) },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  const date = q.date ?? todayIn(salon!.timezone);
  return json(await getSlotsForDate(salon!, date, opts), { headers: { "Cache-Control": "no-store" } });
});
