import "server-only";
import { addDays, format } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { createAdminClient } from "@/lib/supabase/admin";
import { errors } from "@/lib/api";
import { computeSlots, bookingDuration, type SlotQuery, type Slot } from "@/lib/booking/slots";
import type { Salon } from "@/lib/supabase/types";

export interface AvailabilityOptions {
  serviceId: string;
  designId?: string | null;
  /** Restrict to one technician (default: any qualified staff). */
  staffId?: string | null;
  /** Ignore this booking's own interval (reschedule flows). */
  excludeBookingId?: string | null;
  now?: Date;
}

type SalonRules = Pick<
  Salon,
  "id" | "timezone" | "slot_interval_min" | "min_lead_time_min" | "max_advance_days"
>;

interface LoadedRange {
  makeQuery: (date: string) => SlotQuery;
  durationMin: number;
  bufferMin: number;
  staffIds: string[];
}

/** Loads everything needed to compute slots for a date range and returns a query factory. */
async function loadRange(
  salon: SalonRules,
  fromDate: string,
  days: number,
  opts: AvailabilityOptions,
): Promise<LoadedRange> {
  const admin = createAdminClient();
  const tz = salon.timezone;
  const now = opts.now ?? new Date();
  const rangeStart = fromZonedTime(`${fromDate}T00:00:00`, tz);
  const rangeEnd = fromZonedTime(
    `${format(addDays(new Date(`${fromDate}T00:00:00Z`), days), "yyyy-MM-dd")}T00:00:00`,
    tz,
  );

  const { data: service } = await admin
    .from("services")
    .select("id, duration_min, buffer_min, is_active")
    .eq("id", opts.serviceId)
    .eq("salon_id", salon.id)
    .maybeSingle();
  if (!service || !service.is_active) throw errors.notFound("Service");

  let designAddon = 0;
  if (opts.designId) {
    const { data: design } = await admin
      .from("designs")
      .select("duration_addon_min")
      .eq("id", opts.designId)
      .eq("salon_id", salon.id)
      .maybeSingle();
    designAddon = design?.duration_addon_min ?? 0;
  }
  const durationMin = bookingDuration(service.duration_min, designAddon);

  const [{ data: hours }, { data: holidays }, { data: staffRows }] = await Promise.all([
    admin.from("salon_hours").select("weekday, open_time, close_time, is_closed").eq("salon_id", salon.id),
    admin
      .from("salon_holidays")
      .select("date")
      .eq("salon_id", salon.id)
      .gte("date", fromDate)
      .lt("date", format(addDays(new Date(`${fromDate}T00:00:00Z`), days), "yyyy-MM-dd")),
    admin
      .from("staff")
      .select("id, staff_services!inner(service_id)")
      .eq("salon_id", salon.id)
      .eq("is_active", true)
      .eq("accepts_online_booking", true)
      .eq("staff_services.service_id", opts.serviceId)
      .order("sort_order"),
  ]);

  let staffIds = (staffRows ?? []).map((s) => s.id);
  if (opts.staffId) staffIds = staffIds.filter((id) => id === opts.staffId);
  if (!staffIds.length) {
    return {
      makeQuery: (date) => ({
        date,
        timezone: tz,
        salonHours: hours ?? [],
        holidays: (holidays ?? []).map((h) => h.date),
        staff: [],
        durationMin,
        bufferMin: service.buffer_min,
        slotIntervalMin: salon.slot_interval_min,
        minLeadTimeMin: salon.min_lead_time_min,
        maxAdvanceDays: salon.max_advance_days,
        now,
      }),
      durationMin,
      bufferMin: service.buffer_min,
      staffIds: [],
    };
  }

  const [{ data: rules }, { data: timeOff }, { data: bookings }] = await Promise.all([
    admin
      .from("staff_schedule_rules")
      .select("staff_id, weekday, kind, start_time, end_time")
      .in("staff_id", staffIds),
    admin
      .from("staff_time_off")
      .select("staff_id, starts_at, ends_at")
      .in("staff_id", staffIds)
      .lt("starts_at", rangeEnd.toISOString())
      .gt("ends_at", rangeStart.toISOString()),
    admin
      .from("bookings")
      .select("id, staff_id, starts_at, ends_at")
      .in("staff_id", staffIds)
      .in("status", ["new", "confirmed"])
      .lt("starts_at", rangeEnd.toISOString())
      .gt("ends_at", rangeStart.toISOString()),
  ]);

  const staff = staffIds.map((id) => ({
    id,
    rules: (rules ?? [])
      .filter((r) => r.staff_id === id)
      .map((r) => ({ weekday: r.weekday, kind: r.kind, start_time: r.start_time, end_time: r.end_time })),
    timeOff: (timeOff ?? [])
      .filter((t) => t.staff_id === id)
      .map((t) => ({ start: new Date(t.starts_at), end: new Date(t.ends_at) })),
    bookings: (bookings ?? [])
      .filter((b) => b.staff_id === id && b.id !== opts.excludeBookingId)
      .map((b) => ({ start: new Date(b.starts_at), end: new Date(b.ends_at) })),
  }));

  return {
    makeQuery: (date) => ({
      date,
      timezone: tz,
      salonHours: hours ?? [],
      holidays: (holidays ?? []).map((h) => h.date),
      staff,
      durationMin,
      bufferMin: service.buffer_min,
      slotIntervalMin: salon.slot_interval_min,
      minLeadTimeMin: salon.min_lead_time_min,
      maxAdvanceDays: salon.max_advance_days,
      now,
    }),
    durationMin,
    bufferMin: service.buffer_min,
    staffIds,
  };
}

export interface SlotsResult {
  date: string;
  timezone: string;
  durationMin: number;
  slots: Array<{ startsAt: string; endsAt: string; staffIds: string[] }>;
}

/** Bookable start times for one calendar day (salon time zone). */
export async function getSlotsForDate(
  salon: SalonRules,
  date: string,
  opts: AvailabilityOptions,
): Promise<SlotsResult> {
  const range = await loadRange(salon, date, 1, opts);
  const slots = computeSlots(range.makeQuery(date));
  return { date, timezone: salon.timezone, durationMin: range.durationMin, slots: slots.map(serialise) };
}

export interface DayAvailability {
  date: string;
  count: number;
  firstStartsAt: string | null;
}

/** Slot counts per day over a range (for the booking calendar). */
export async function getAvailability(
  salon: SalonRules,
  fromDate: string,
  days: number,
  opts: AvailabilityOptions,
): Promise<{ timezone: string; days: DayAvailability[] }> {
  const range = await loadRange(salon, fromDate, days, opts);
  const out: DayAvailability[] = [];
  for (let i = 0; i < days; i++) {
    const date = format(addDays(new Date(`${fromDate}T00:00:00Z`), i), "yyyy-MM-dd");
    const slots = computeSlots(range.makeQuery(date));
    out.push({ date, count: slots.length, firstStartsAt: slots[0]?.startsAt.toISOString() ?? null });
  }
  return { timezone: salon.timezone, days: out };
}

/** Today's date in the salon time zone. */
export function todayIn(tz: string, now = new Date()) {
  return format(toZonedTime(now, tz), "yyyy-MM-dd");
}

function serialise(s: Slot) {
  return { startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString(), staffIds: s.staffIds };
}
