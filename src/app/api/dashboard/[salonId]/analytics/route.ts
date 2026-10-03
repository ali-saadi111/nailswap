import type { NextRequest } from "next/server";
import { subDays } from "date-fns";
import { z } from "zod";
import { handle, json, ok, parseQuery, requireSalonRole, userClient } from "@/lib/api";
import { publicMediaUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

const schema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

/**
 * GET /api/dashboard/:salonId/analytics?from=&to= (ISO; default last 30 days)
 * Funnel, daily series, bookings by status/source, revenue, top designs/polishes, AI usage.
 */
export const GET = handle(async (req: NextRequest, ctx: { params: Promise<{ salonId: string }> }) => {
  const { salonId } = await ctx.params;
  await requireSalonRole(salonId, "staff");
  const q = parseQuery(req, schema);
  const to = q.to ? new Date(q.to) : new Date();
  const from = q.from ? new Date(q.from) : subDays(to, 30);
  const supabase = await userClient();
  const summary = ok(
    await supabase.rpc("salon_analytics_summary", {
      p_salon_id: salonId,
      p_from: from.toISOString(),
      p_to: to.toISOString(),
    }),
  ) as Record<string, unknown> & {
    top_designs?: Array<{ cover_path: string | null }>;
    events?: Record<string, number>;
  };

  const events = summary.events ?? {};
  const tryons = (events.tryon_ar_capture ?? 0) + (events.tryon_ai_success ?? 0);
  const bookings = events.booking_created ?? 0;
  return json({
    ...summary,
    top_designs: (summary.top_designs ?? []).map((d) => ({ ...d, coverUrl: publicMediaUrl(d.cover_path) })),
    funnel: {
      pageViews: events.page_view ?? 0,
      tryons,
      bookClicks: events.book_click ?? 0,
      bookings,
      tryonToBookingRate: tryons ? Math.round((bookings / tryons) * 1000) / 10 : 0,
    },
  });
});
