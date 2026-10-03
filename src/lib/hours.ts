/** Opening-hours helpers shared by server and client components. */
export interface HoursRow {
  weekday: number; // 0 = Sunday … 6 = Saturday
  open_time: string | null; // "10:00:00"
  close_time: string | null;
  is_closed: boolean;
}

export function hhmm(t: string | null | undefined) {
  return t ? t.slice(0, 5) : "";
}

function nowInTz(tz: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    weekday: weekdays.indexOf(map.weekday),
    minutes: (Number(map.hour) % 24) * 60 + Number(map.minute),
  };
}

function toMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** "open" | "closed" plus the next opening time today when still ahead. */
export function openState(hours: HoursRow[], tz: string, now = new Date()) {
  const { weekday, minutes } = nowInTz(tz, now);
  const today = hours.find((h) => h.weekday === weekday);
  if (!today || today.is_closed || !today.open_time || !today.close_time)
    return { open: false, closedToday: true };
  const o = toMin(today.open_time);
  const c = toMin(today.close_time);
  if (minutes >= o && minutes < c) return { open: true, closesAt: hhmm(today.close_time) };
  if (minutes < o) return { open: false, opensAt: hhmm(today.open_time) };
  return { open: false, closedToday: false };
}

/**
 * "Tue–Sun 10:00–20:00 · Mon closed" — groups consecutive weekdays with identical hours.
 * `short` maps weekday index → localised short name.
 */
export function summarizeHours(hours: HoursRow[], short: (i: number) => string, closedLabel: string) {
  if (!hours.length) return "";
  // Start the week on Monday for the summary.
  const order = [1, 2, 3, 4, 5, 6, 0];
  const byDay = new Map(hours.map((h) => [h.weekday, h]));
  const key = (d: number) => {
    const h = byDay.get(d);
    if (!h || h.is_closed || !h.open_time || !h.close_time) return "closed";
    return `${hhmm(h.open_time)}–${hhmm(h.close_time)}`;
  };
  const groups: { from: number; to: number; label: string }[] = [];
  for (const d of order) {
    const k = key(d);
    const last = groups[groups.length - 1];
    if (last && last.label === k) last.to = d;
    else groups.push({ from: d, to: d, label: k });
  }
  return groups
    .map((g) => {
      const days = g.from === g.to ? short(g.from) : `${short(g.from)}–${short(g.to)}`;
      return `${days} ${g.label === "closed" ? closedLabel : g.label}`;
    })
    .join(" · ");
}
