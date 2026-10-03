import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { addMinutes, format, getDay, isBefore } from "date-fns";

/** Weekly interval in local salon time, e.g. { weekday: 1, kind: "work", start: "10:00", end: "19:00" }. */
export interface ScheduleRule {
  weekday: number;
  kind: "work" | "break";
  start_time: string; // "HH:mm" or "HH:mm:ss"
  end_time: string;
}

export interface Interval {
  start: Date;
  end: Date;
}

export interface StaffAvailabilityInput {
  id: string;
  rules: ScheduleRule[];
  timeOff: Interval[];
  bookings: Interval[];
}

export interface SalonHoursRule {
  weekday: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
}

export interface SlotQuery {
  /** Calendar date in the salon's timezone, "YYYY-MM-DD". */
  date: string;
  timezone: string;
  salonHours: SalonHoursRule[];
  /** Holiday dates "YYYY-MM-DD". */
  holidays: string[];
  staff: StaffAvailabilityInput[];
  /** Service duration + design add-on, minutes. */
  durationMin: number;
  /** Buffer added after the appointment before the next can start. */
  bufferMin?: number;
  slotIntervalMin: number;
  minLeadTimeMin: number;
  maxAdvanceDays?: number;
  now: Date;
}

export interface Slot {
  startsAt: Date;
  endsAt: Date;
  /** Staff members who can take this slot. */
  staffIds: string[];
}

function localTime(date: string, time: string, tz: string): Date {
  const hhmm = time.length === 5 ? `${time}:00` : time;
  return fromZonedTime(`${date}T${hhmm}`, tz);
}

function overlaps(a: Interval, b: Interval) {
  return a.start < b.end && a.end > b.start;
}

function contains(outer: Interval, inner: Interval) {
  return outer.start <= inner.start && outer.end >= inner.end;
}

/**
 * Returns true if the given staff member can take an appointment occupying [start, end)
 * (end includes any buffer).
 */
export function isStaffFree(
  staff: StaffAvailabilityInput,
  start: Date,
  end: Date,
  weekday: number,
  date: string,
  tz: string,
): boolean {
  const slot = { start, end };
  const work = staff.rules
    .filter((r) => r.weekday === weekday && r.kind === "work")
    .map((r) => ({ start: localTime(date, r.start_time, tz), end: localTime(date, r.end_time, tz) }));
  if (!work.some((w) => contains(w, slot))) return false;

  const breaks = staff.rules
    .filter((r) => r.weekday === weekday && r.kind === "break")
    .map((r) => ({ start: localTime(date, r.start_time, tz), end: localTime(date, r.end_time, tz) }));
  if (breaks.some((b) => overlaps(b, slot))) return false;

  if (staff.timeOff.some((t) => overlaps(t, slot))) return false;
  if (staff.bookings.some((b) => overlaps(b, slot))) return false;
  return true;
}

/**
 * Pure slot calculation. Given the salon rules, staff schedules and existing bookings for one
 * day, returns every start time at which at least one staff member is free for the full
 * duration (+ buffer). Deterministic: pass `now` explicitly.
 */
export function computeSlots(q: SlotQuery): Slot[] {
  const tz = q.timezone;
  const buffer = q.bufferMin ?? 0;
  const dayStartLocal = localTime(q.date, "00:00", tz);
  const weekday = getDay(toZonedTime(dayStartLocal, tz));

  if (q.holidays.includes(q.date)) return [];
  const hours = q.salonHours.find((h) => h.weekday === weekday);
  if (!hours || hours.is_closed || !hours.open_time || !hours.close_time) return [];

  const open = localTime(q.date, hours.open_time, tz);
  const close = localTime(q.date, hours.close_time, tz);
  const earliest = addMinutes(q.now, q.minLeadTimeMin);
  if (q.maxAdvanceDays !== undefined) {
    const latest = addMinutes(q.now, q.maxAdvanceDays * 24 * 60);
    if (isBefore(latest, open)) return [];
  }

  const slots: Slot[] = [];
  const total = q.durationMin + buffer;
  for (let t = open; addMinutes(t, q.durationMin) <= close; t = addMinutes(t, q.slotIntervalMin)) {
    if (isBefore(t, earliest)) continue;
    const end = addMinutes(t, total);
    // Buffer may run past closing time; the appointment itself must fit.
    const staffIds = q.staff.filter((s) => isStaffFree(s, t, end, weekday, q.date, tz)).map((s) => s.id);
    if (staffIds.length) slots.push({ startsAt: t, endsAt: addMinutes(t, q.durationMin), staffIds });
  }
  return slots;
}

/** Groups slots by hour label for display, e.g. "10:00" → [slots]. */
export function groupSlotsByHour(slots: Slot[], tz: string) {
  const groups = new Map<string, Slot[]>();
  for (const s of slots) {
    const label = format(toZonedTime(s.startsAt, tz), "HH:00");
    const arr = groups.get(label) ?? [];
    arr.push(s);
    groups.set(label, arr);
  }
  return groups;
}

/** Finds the first date (inclusive) with at least one slot, scanning up to `maxDays` ahead. */
export function findNextAvailableDate(
  makeQuery: (date: string) => SlotQuery,
  fromDate: string,
  maxDays = 30,
): string | null {
  const [y, m, d] = fromDate.split("-").map(Number);
  for (let i = 0; i < maxDays; i++) {
    const dt = new Date(Date.UTC(y, m - 1, d + i));
    const date = dt.toISOString().slice(0, 10);
    if (computeSlots(makeQuery(date)).length) return date;
  }
  return null;
}

/** Total minutes for a booking given service + optional design. */
export function bookingDuration(serviceDurationMin: number, designAddonMin = 0) {
  return serviceDurationMin + designAddonMin;
}

/** Price for a booking given service + optional design. */
export function bookingPrice(servicePrice: number, designAddon = 0) {
  return Math.round((servicePrice + designAddon) * 100) / 100;
}
