import type { NextRequest } from "next/server";
import Papa from "papaparse";
import { handle, requireSalonRole, userClient } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/dashboard/:salonId/clients/export — CSV download of the salon's client list. */
export const GET = handle(async (_req: NextRequest, ctx: { params: Promise<{ salonId: string }> }) => {
  const { salonId } = await ctx.params;
  await requireSalonRole(salonId, "manager");
  const supabase = await userClient();
  const { data, error } = await supabase
    .from("clients")
    .select(
      "full_name, phone, email, preferred_locale, visit_count, no_show_count, last_visit_at, notes, created_at",
    )
    .eq("salon_id", salonId)
    .order("full_name");
  if (error) throw error;
  const csv = Papa.unparse(
    (data ?? []).map((c) => ({
      full_name: c.full_name,
      phone: `+${c.phone}`,
      email: c.email ?? "",
      locale: c.preferred_locale,
      visits: c.visit_count,
      no_shows: c.no_show_count,
      last_visit: c.last_visit_at ?? "",
      notes: c.notes ?? "",
      created_at: c.created_at,
    })),
  );
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clients-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
