import { handle, json } from "@/lib/api";
import { listCities } from "@/lib/salons/directory";

export const dynamic = "force-dynamic";

/** GET /api/salons/cities — cities with active salons and their counts (directory filter). */
export const GET = handle(async () => {
  return json(
    { cities: await listCities() },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
  );
});
