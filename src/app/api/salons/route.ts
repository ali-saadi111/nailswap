import type { NextRequest } from "next/server";
import { handle, json, parseQuery } from "@/lib/api";
import { directoryQuerySchema, searchSalons } from "@/lib/salons/directory";

export const dynamic = "force-dynamic";

/**
 * GET /api/salons — directory search.
 * Query: q, city, category, lat, lng, limit (≤100), offset.
 * Active + approved salons only, ordered by plan priority → distance (if lat/lng) → rating.
 */
export const GET = handle(async (req: NextRequest) => {
  const q = parseQuery(req, directoryQuerySchema);
  const result = await searchSalons(q);
  return json(result, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
});
