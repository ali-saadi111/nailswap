import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicMediaUrl } from "@/lib/storage";

export const directoryQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  city: z.string().trim().max(60).optional(),
  category: z.enum(["french", "chrome", "ombre", "art_3d", "minimal", "bridal", "seasonal"]).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0),
});

export type DirectoryQuery = z.infer<typeof directoryQuerySchema>;

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Directory search: active, approved salons ordered by plan priority, then distance (when a
 * location is given) or rating. Only public fields are returned.
 */
export async function searchSalons(q: DirectoryQuery) {
  const admin = createAdminClient();
  let query = admin
    .from("salons")
    .select(
      "id, slug, name, description, brand_color, logo_path, cover_path, city, area, lat, lng, languages, booking_mode, timezone, rating_avg, rating_count, subscriptions(plan_code, status), salon_hours(weekday, open_time, close_time, is_closed)",
    )
    .eq("status", "active")
    .eq("directory_approved", true);
  if (q.city) query = query.ilike("city", `%${q.city}%`);
  if (q.q) query = query.or(`name.ilike.%${q.q}%,city.ilike.%${q.q}%,area.ilike.%${q.q}%`);
  const { data: salons, error } = await query.limit(500);
  if (error) throw error;

  const { data: plans } = await admin.from("plans").select("code, directory_priority");
  const priorityByPlan = new Map((plans ?? []).map((p) => [p.code, p.directory_priority]));
  let rows = salons ?? [];
  if (q.category) {
    const { data: withCategory } = await admin
      .from("designs")
      .select("salon_id")
      .eq("category", q.category)
      .eq("is_visible", true)
      .in(
        "salon_id",
        rows.map((s) => s.id),
      );
    const allowed = new Set((withCategory ?? []).map((d) => d.salon_id));
    rows = rows.filter((s) => allowed.has(s.id));
  }

  const { data: featured } = await admin
    .from("designs")
    .select("salon_id, cover_path, category")
    .eq("is_visible", true)
    .in(
      "salon_id",
      rows.map((s) => s.id),
    )
    .order("is_featured", { ascending: false })
    .order("tryon_count", { ascending: false })
    .limit(2000);
  const { data: prices } = await admin
    .from("services")
    .select("salon_id, price")
    .eq("is_active", true)
    .in(
      "salon_id",
      rows.map((s) => s.id),
    );
  const fromPriceBySalon = new Map<string, number>();
  for (const p of prices ?? []) {
    const cur = fromPriceBySalon.get(p.salon_id);
    const v = Number(p.price);
    if (cur === undefined || v < cur) fromPriceBySalon.set(p.salon_id, v);
  }

  const designsBySalon = new Map<string, { covers: string[]; count: number; categories: Set<string> }>();
  for (const d of featured ?? []) {
    const entry = designsBySalon.get(d.salon_id) ?? { covers: [], count: 0, categories: new Set<string>() };
    entry.count++;
    entry.categories.add(d.category);
    if (d.cover_path && entry.covers.length < 3) entry.covers.push(d.cover_path);
    designsBySalon.set(d.salon_id, entry);
  }

  const items = rows.map((s) => {
    const sub = s.subscriptions;
    const priority = sub ? (priorityByPlan.get(sub.plan_code) ?? 0) : 0;
    const distanceKm =
      q.lat !== undefined && q.lng !== undefined && s.lat !== null && s.lng !== null
        ? haversineKm(q.lat, q.lng, s.lat, s.lng)
        : null;
    const d = designsBySalon.get(s.id);
    return {
      id: s.id,
      slug: s.slug,
      name: s.name,
      description: s.description,
      brandColor: s.brand_color,
      logoUrl: publicMediaUrl(s.logo_path),
      coverUrl: publicMediaUrl(s.cover_path),
      city: s.city,
      area: s.area,
      lat: s.lat,
      lng: s.lng,
      languages: s.languages,
      bookingMode: s.booking_mode,
      timezone: s.timezone,
      hours: s.salon_hours,
      fromPrice: fromPriceBySalon.get(s.id) ?? null,
      ratingAvg: Number(s.rating_avg),
      ratingCount: s.rating_count,
      plan: sub?.plan_code ?? "trial",
      priority,
      distanceKm: distanceKm === null ? null : Math.round(distanceKm * 10) / 10,
      designCount: d?.count ?? 0,
      categories: [...(d?.categories ?? [])],
      featuredCovers: (d?.covers ?? []).map((p) => publicMediaUrl(p)),
    };
  });

  items.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (a.distanceKm !== null && b.distanceKm !== null && a.distanceKm !== b.distanceKm)
      return a.distanceKm - b.distanceKm;
    if (b.ratingAvg !== a.ratingAvg) return b.ratingAvg - a.ratingAvg;
    return b.ratingCount - a.ratingCount;
  });

  return { total: items.length, items: items.slice(q.offset, q.offset + q.limit) };
}

export type DirectoryResult = Awaited<ReturnType<typeof searchSalons>>;
export type DirectoryItem = DirectoryResult["items"][number];

/** Distinct cities with active salons (for filters). */
export async function listCities() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("salons")
    .select("city")
    .eq("status", "active")
    .eq("directory_approved", true)
    .not("city", "is", null);
  const counts = new Map<string, number>();
  for (const row of data ?? []) if (row.city) counts.set(row.city, (counts.get(row.city) ?? 0) + 1);
  return [...counts.entries()].map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count);
}
