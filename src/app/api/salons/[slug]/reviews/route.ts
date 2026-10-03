import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle, json, parseQuery, userClient } from "@/lib/api";
import { loadBookableSalon } from "@/lib/salons/lookup";
import { BUCKETS, signedUrls } from "@/lib/storage";

export const dynamic = "force-dynamic";

const schema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/** GET /api/salons/:slug/reviews?limit&offset — approved reviews, newest first. */
export const GET = handle(async (req: NextRequest, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const q = parseQuery(req, schema);
  const salon = await loadBookableSalon(slug);
  const supabase = await userClient();
  const { data, error, count } = await supabase
    .from("reviews")
    .select("id, rating, body, photo_paths, salon_reply, replied_at, created_at, clients(full_name)", {
      count: "exact",
    })
    .eq("salon_id", salon.id)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .range(q.offset, q.offset + q.limit - 1);
  if (error) throw error;
  const reviews = await Promise.all(
    (data ?? []).map(async (r) => ({
      id: r.id,
      rating: r.rating,
      body: r.body,
      photoUrls: r.photo_paths.length ? await signedUrls(BUCKETS.privateDocs, r.photo_paths) : [],
      authorName: r.clients?.full_name ? r.clients.full_name.split(" ")[0] : "Client",
      salonReply: r.salon_reply,
      repliedAt: r.replied_at,
      createdAt: r.created_at,
    })),
  );
  return json({ total: count ?? reviews.length, reviews });
});
