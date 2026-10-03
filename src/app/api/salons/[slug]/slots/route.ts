import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle, json, parseQuery } from "@/lib/api";
import { loadBookableSalon } from "@/lib/salons/lookup";
import { getSlotsForDate, todayIn } from "@/lib/salons/availability";

export const dynamic = "force-dynamic";

const schema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  serviceId: z.string().uuid(),
  designId: z.string().uuid().optional(),
  staffId: z.string().uuid().optional(),
});

/**
 * GET /api/salons/:slug/slots?date=YYYY-MM-DD&serviceId=&designId=&staffId=
 * Bookable start times for one day in the salon's time zone (default: today).
 */
export const GET = handle(async (req: NextRequest, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const q = parseQuery(req, schema);
  const salon = await loadBookableSalon(slug);
  const date = q.date ?? todayIn(salon.timezone);
  const result = await getSlotsForDate(salon, date, {
    serviceId: q.serviceId,
    designId: q.designId,
    staffId: q.staffId,
  });
  return json(result, { headers: { "Cache-Control": "no-store" } });
});
