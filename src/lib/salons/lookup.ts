import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { errors } from "@/lib/api";

/** Loads a bookable salon by slug (active or pending) with the fields booking flows need. */
export async function loadBookableSalon(slug: string) {
  const admin = createAdminClient();
  const { data: salon } = await admin
    .from("salons")
    .select(
      "id, slug, name, status, timezone, slot_interval_min, min_lead_time_min, max_advance_days, booking_mode, currency, deposit_required, deposit_amount, default_locale, cancel_cutoff_hours, reschedule_cutoff_hours",
    )
    .eq("slug", slug.toLowerCase())
    .in("status", ["active", "pending"])
    .maybeSingle();
  if (!salon) throw errors.notFound("Salon");
  return salon;
}

export type BookableSalon = Awaited<ReturnType<typeof loadBookableSalon>>;
