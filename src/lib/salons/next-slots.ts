import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAvailability, getSlotsForDate, todayIn } from "@/lib/salons/availability";
import { log, errorMessage } from "@/lib/logger";

export interface NextSlot {
  startsAt: string;
  serviceId: string;
}

/**
 * Up to `perSalon` upcoming bookable start times per salon, using each salon's cheapest
 * try-on service. Used by the directory cards ("Next · Today 16:30 · 17:15 · Sun 11:00").
 * Best effort: a salon with no staff or services simply returns an empty list.
 */
export async function nextSlotsForSalons(
  salonIds: string[],
  perSalon = 3,
  days = 5,
): Promise<Record<string, NextSlot[]>> {
  if (!salonIds.length) return {};
  const admin = createAdminClient();
  const [{ data: salons }, { data: services }] = await Promise.all([
    admin
      .from("salons")
      .select("id, timezone, slot_interval_min, min_lead_time_min, max_advance_days")
      .in("id", salonIds),
    admin
      .from("services")
      .select("id, salon_id, price, supports_tryon")
      .eq("is_active", true)
      .in("salon_id", salonIds)
      .order("supports_tryon", { ascending: false })
      .order("price"),
  ]);
  const serviceBySalon = new Map<string, string>();
  for (const s of services ?? []) if (!serviceBySalon.has(s.salon_id)) serviceBySalon.set(s.salon_id, s.id);

  const out: Record<string, NextSlot[]> = {};
  await Promise.all(
    (salons ?? []).map(async (salon) => {
      const serviceId = serviceBySalon.get(salon.id);
      if (!serviceId) return;
      try {
        const today = todayIn(salon.timezone);
        const found: NextSlot[] = [];
        const todaySlots = await getSlotsForDate(salon, today, { serviceId });
        let lastMs = 0;
        for (const s of todaySlots.slots) {
          const ms = new Date(s.startsAt).getTime();
          if (found.length >= 2) break;
          if (!found.length || ms - lastMs >= 45 * 60_000) {
            found.push({ startsAt: s.startsAt, serviceId });
            lastMs = ms;
          }
        }
        if (found.length < perSalon) {
          const avail = await getAvailability(salon, today, days, { serviceId });
          for (const d of avail.days.slice(1)) {
            if (found.length >= perSalon) break;
            if (d.firstStartsAt) found.push({ startsAt: d.firstStartsAt, serviceId });
          }
        }
        out[salon.id] = found.slice(0, perSalon);
      } catch (err) {
        log.warn("next_slots_failed", { salonId: salon.id, error: errorMessage(err) });
      }
    }),
  );
  return out;
}
