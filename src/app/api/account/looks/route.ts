import { handle, json, requireUser } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKETS, publicMediaUrl, signedUrls } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** GET /api/account/looks — the signed-in user's saved looks with signed image URLs. */
export const GET = handle(async () => {
  const auth = await requireUser();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("saved_looks")
    .select(
      "id, title, image_path, created_at, job_id, salons(id, slug, name, logo_path), designs(id, name, slug, price_addon), polishes(id, brand, shade_name, hex_color)",
    )
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  const urls = await signedUrls(
    BUCKETS.tryon,
    (data ?? []).map((l) => l.image_path),
  );
  return json({
    looks: (data ?? []).map((l, i) => ({
      id: l.id,
      title: l.title,
      imageUrl: urls[i],
      createdAt: l.created_at,
      jobId: l.job_id,
      salon: l.salons
        ? {
            id: l.salons.id,
            slug: l.salons.slug,
            name: l.salons.name,
            logoUrl: publicMediaUrl(l.salons.logo_path),
          }
        : null,
      design: l.designs,
      polish: l.polishes,
    })),
  });
});
