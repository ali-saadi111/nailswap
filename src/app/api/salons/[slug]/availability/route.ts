import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle, json, parseQuery } from "@/lib/api";
import { loadBookableSalon } from "@/lib/salons/lookup";
import { getAvailability, todayIn } from "@/lib/salons/availability";

export const dynamic = "force-dynamic";

const schema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  days: z.coerce.number().int().min(1).max(60).default(14),
  serviceId: z.string().uuid(),
  designId: z.string().uuid().optional(),
  staffId: z.string().uuid().optional(),
});

/**
 * GET /api/salons/:slug/availability?from=YYYY-MM-DD&days=14&serviceId=&designId=&staffId=
 * Slot counts per day for the booking calendar (max 60 days).
 */
export const GET = handle(async (req: NextRequest, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const q = parseQuery(req, schema);
  const salon = await loadBookableSalon(slug);
  const from = q.from ?? todayIn(salon.timezone);
  const result = await getAvailability(salon, from, Math.min(q.days, salon.max_advance_days + 1), {
    serviceId: q.serviceId,
    designId: q.designId,
    staffId: q.staffId,
  });
  return json({ from, ...result }, { headers: { "Cache-Control": "no-store" } });
});
