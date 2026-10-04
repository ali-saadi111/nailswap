import "server-only";
import { addDays, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { publicMediaUrl } from "@/lib/storage";
import { errors } from "@/lib/api";

/**
 * Public salon profile as shown on `slug.nailswap.app`. Reads go through the caller's
 * Supabase client so RLS decides what is visible (active/pending salons, visible designs,
 * active services, in-stock polishes, approved reviews).
 */
export async function getPublicSalon(slug: string) {
  const supabase = await createClient();
  const { data: salon, error } = await supabase
    .from("salons")
    .select(
      "id, slug, name, description, description_i18n, status, brand_color, logo_path, cover_path, gallery_paths, default_locale, languages, currency, timezone, city, area, address, lat, lng, phone, whatsapp_number, instagram, website, booking_mode, cancel_cutoff_hours, reschedule_cutoff_hours, slot_interval_min, min_lead_time_min, max_advance_days, deposit_required, deposit_amount, remove_branding, rating_avg, rating_count, settings",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!salon) throw errors.notFound("Salon");

  const today = format(new Date(), "yyyy-MM-dd");
  const [hours, holidays, staff, services, designs, polishes, reviews] = await Promise.all([
    supabase
      .from("salon_hours")
      .select("weekday, open_time, close_time, is_closed")
      .eq("salon_id", salon.id)
      .order("weekday"),
    supabase
      .from("salon_holidays")
      .select("date, name")
      .eq("salon_id", salon.id)
      .gte("date", today)
      .lte("date", format(addDays(new Date(), salon.max_advance_days), "yyyy-MM-dd")),
    supabase
      .from("staff")
      .select(
        "id, display_name, avatar_path, bio, color, accepts_online_booking, sort_order, staff_services(service_id)",
      )
      .eq("salon_id", salon.id)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("services")
      .select(
        "id, name, name_i18n, description, category, price, duration_min, buffer_min, supports_tryon, sort_order",
      )
      .eq("salon_id", salon.id)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("designs")
      .select(
        "id, slug, name, name_i18n, description, category, tags, shape, length, price_addon, duration_addon_min, cover_path, is_featured, sort_order, tryon_count, booking_count, design_images(id, path, alt, sort_order), design_services(service_id), design_polishes(polish_id)",
      )
      .eq("salon_id", salon.id)
      .eq("is_visible", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("polishes")
      .select("id, brand, collection, shade_name, shade_code, finish, hex_color, swatch_path, sort_order")
      .eq("salon_id", salon.id)
      .eq("in_stock", true)
      .order("sort_order"),
    supabase
      .from("reviews")
      .select("id, rating, body, photo_paths, salon_reply, replied_at, created_at, clients(full_name)")
      .eq("salon_id", salon.id)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return {
    salon: {
      ...salon,
      logoUrl: publicMediaUrl(salon.logo_path),
      coverUrl: publicMediaUrl(salon.cover_path),
      galleryUrls: salon.gallery_paths.map((p) => publicMediaUrl(p)),
    },
    hours: hours.data ?? [],
    holidays: holidays.data ?? [],
    staff: (staff.data ?? []).map((s) => ({
      id: s.id,
      displayName: s.display_name,
      avatarUrl: publicMediaUrl(s.avatar_path),
      bio: s.bio,
      color: s.color,
      acceptsOnlineBooking: s.accepts_online_booking,
      serviceIds: s.staff_services.map((x) => x.service_id),
    })),
    services: services.data ?? [],
    designs: (designs.data ?? []).map((d) => ({
      id: d.id,
      slug: d.slug,
      name: d.name,
      nameI18n: d.name_i18n,
      description: d.description,
      category: d.category,
      tags: d.tags,
      shape: d.shape,
      length: d.length,
      priceAddon: Number(d.price_addon),
      durationAddonMin: d.duration_addon_min,
      coverUrl: publicMediaUrl(d.cover_path),
      isFeatured: d.is_featured,
      tryonCount: d.tryon_count,
      bookingCount: d.booking_count,
      images: [...d.design_images]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((i) => ({ id: i.id, url: publicMediaUrl(i.path), alt: i.alt })),
      serviceIds: d.design_services.map((x) => x.service_id),
      polishIds: d.design_polishes.map((x) => x.polish_id),
    })),
    polishes: (polishes.data ?? []).map((p) => ({
      id: p.id,
      brand: p.brand,
      collection: p.collection,
      shadeName: p.shade_name,
      shadeCode: p.shade_code,
      finish: p.finish,
      hexColor: p.hex_color,
      swatchUrl: publicMediaUrl(p.swatch_path),
    })),
    reviews: (reviews.data ?? []).map((r) => ({
      id: r.id,
      rating: r.rating,
      body: r.body,
      authorName: r.clients?.full_name ? r.clients.full_name.split(" ")[0] : "Client",
      salonReply: r.salon_reply,
      repliedAt: r.replied_at,
      createdAt: r.created_at,
    })),
  };
}

export type PublicSalon = Awaited<ReturnType<typeof getPublicSalon>>;
