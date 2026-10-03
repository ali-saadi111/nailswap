import { after, type NextRequest } from "next/server";
import { z } from "zod";
import { handle, json, okOne, parseJson } from "@/lib/api";
import { clientIp, enforceLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadBookingByToken } from "@/lib/booking/manage";
import { toBookingView } from "@/lib/booking/serialize";
import { dispatchForBooking } from "@/lib/notifications/dispatch";

const schema = z.object({ startsAt: z.string().datetime({ offset: true }) });

/** POST /api/bookings/manage/:token/reschedule — moves the booking (same staff, same duration). */
export const POST = handle(async (req: NextRequest, ctx: { params: Promise<{ token: string }> }) => {
  const { token } = await ctx.params;
  await enforceLimit("booking_ip", clientIp(req.headers));
  const body = await parseJson(req, schema);
  await loadBookingByToken(token);
  const admin = createAdminClient();
  const booking = okOne(
    await admin.rpc("reschedule_booking_by_token", { p_token: token, p_starts_at: body.startsAt }),
  );
  after(() => dispatchForBooking(booking.id));
  return json(await toBookingView(booking));
});
