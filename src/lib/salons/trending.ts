import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicMediaUrl } from "@/lib/storage";

export interface TrendingDesign {
  id: string;
  slug: string;
  name: string;
  category: string;
  shape: string | null;
  length: string | null;
  priceAddon: number;
  coverUrl: string | null;
  salonId: string;
  salonSlug: string;
  salonName: string;
  tryonCount: number;
}

/** Most tried-on visible designs from active, approved salons (home "Trending this week"). */
export async function listTrendingDesigns(limit = 8, category?: string): Promise<TrendingDesign[]> {
  const admin = createAdminClient();
  let q = admin
    .from("designs")
    .select(
      "id, slug, name, category, shape, length, price_addon, cover_path, tryon_count, salons!inner(id, slug, name, status, directory_approved)",
    )
    .eq("is_visible", true)
    .eq("salons.status", "active")
    .eq("salons.directory_approved", true)
    .order("tryon_count", { ascending: false })
    .order("is_featured", { ascending: false })
    .limit(limit);
  if (category) q = q.eq("category", category as never);
  const { data } = await q;
  return (data ?? []).map((d) => ({
    id: d.id,
    slug: d.slug,
    name: d.name,
    category: d.category,
    shape: d.shape,
    length: d.length,
    priceAddon: Number(d.price_addon),
    coverUrl: publicMediaUrl(d.cover_path),
    salonId: d.salons.id,
    salonSlug: d.salons.slug,
    salonName: d.salons.name,
    tryonCount: d.tryon_count,
  }));
}
