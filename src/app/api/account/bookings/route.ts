import { handle, json, requireUser, userClient } from "@/lib/api";
import { publicMediaUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** GET /api/account/bookings — the signed-in client's bookings (upcoming first), via RLS. */
export const GET = handle(async () => {
  await requireUser();
  const supabase = await userClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, status, source, starts_at, ends_at, total_price, currency, manage_token, design_id, created_at, salons(id, slug, name, logo_path, city, timezone), services(id, name), staff(id, display_name), designs(id, name, cover_path), reviews(id, rating)",
    )
    .order("starts_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  const now = Date.now();
  const bookings = (data ?? []).map((b) => ({
    id: b.id,
    status: b.status,
    source: b.source,
    startsAt: b.starts_at,
    endsAt: b.ends_at,
    totalPrice: Number(b.total_price),
    currency: b.currency,
    manageToken: b.manage_token,
    isUpcoming: new Date(b.starts_at).getTime() > now && (b.status === "new" || b.status === "confirmed"),
    canReview: b.status === "completed" && !b.reviews,
    reviewId: b.reviews?.id ?? null,
    salon: b.salons
      ? {
          id: b.salons.id,
          slug: b.salons.slug,
          name: b.salons.name,
          city: b.salons.city,
          timezone: b.salons.timezone,
          logoUrl: publicMediaUrl(b.salons.logo_path),
        }
      : null,
    service: b.services,
    staff: b.staff ? { id: b.staff.id, displayName: b.staff.display_name } : null,
    design: b.designs
      ? { id: b.designs.id, name: b.designs.name, coverUrl: publicMediaUrl(b.designs.cover_path) }
      : null,
    createdAt: b.created_at,
  }));
  return json({
    upcoming: bookings.filter((b) => b.isUpcoming).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    past: bookings.filter((b) => !b.isUpcoming),
  });
});
