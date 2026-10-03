import type { NextRequest } from "next/server";
import { handle, json } from "@/lib/api";
import { getPublicSalon } from "@/lib/salons/public";

export const dynamic = "force-dynamic";

/** GET /api/salons/:slug — full public profile (hours, staff, services, designs, polishes, reviews). */
export const GET = handle(async (_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const data = await getPublicSalon(slug.toLowerCase());
  return json(data, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } });
});
