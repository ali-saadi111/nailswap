import type { NextRequest } from "next/server";
import { handle, json } from "@/lib/api";
import { loadBookingByToken } from "@/lib/booking/manage";
import { toBookingView } from "@/lib/booking/serialize";

export const dynamic = "force-dynamic";

/** GET /api/bookings/manage/:token — booking details for the manage page (link in messages). */
export const GET = handle(async (_req: NextRequest, ctx: { params: Promise<{ token: string }> }) => {
  const { token } = await ctx.params;
  const booking = await loadBookingByToken(token);
  const now = Date.now();
  const view = await toBookingView(booking);
  const starts = new Date(booking.starts_at).getTime();
  const live = booking.status === "new" || booking.status === "confirmed";
  return json(
    {
      ...view,
      canCancel: live && starts - (view.salon?.cancelCutoffHours ?? 0) * 3_600_000 > now,
      canReschedule: live && starts - (view.salon?.rescheduleCutoffHours ?? 0) * 3_600_000 > now,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
});
