import { formatMoney } from "@/lib/utils";

const DEFAULT_TZ = "Asia/Beirut";

/** "Lumière Nail Bar" → "LN"; "Nour" → "N". */
export function initials(name: string | null | undefined) {
  if (!name) return "·";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + second).toUpperCase();
}

export function money(amount: number | string | null | undefined, currency = "USD", locale = "en") {
  const n = Number(amount ?? 0);
  return formatMoney(n, currency, locale);
}

export function fmtTime(iso: string | Date, locale = "en", tz = DEFAULT_TZ) {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  }).format(new Date(iso));
}

export function fmtTimeRange(start: string | Date, end: string | Date, locale = "en", tz = DEFAULT_TZ) {
  return `${fmtTime(start, locale, tz)}–${fmtTime(end, locale, tz)}`;
}

export function fmtDay(
  iso: string | Date,
  locale = "en",
  tz = DEFAULT_TZ,
  opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" },
) {
  return new Intl.DateTimeFormat(locale, { ...opts, timeZone: tz }).format(new Date(iso));
}

export function fmtDateTime(iso: string | Date, locale = "en", tz = DEFAULT_TZ) {
  return `${fmtDay(iso, locale, tz)} · ${fmtTime(iso, locale, tz)}`;
}

export function fmtLongDate(iso: string | Date, locale = "en", tz = DEFAULT_TZ) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: tz,
  }).format(new Date(iso));
}

/** Date parts in a timezone for the big date columns ("Sat" / "10" / "Oct"). */
export function dayParts(iso: string | Date, locale = "en", tz = DEFAULT_TZ) {
  const d = new Date(iso);
  return {
    weekday: new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: tz }).format(d),
    day: new Intl.DateTimeFormat(locale, { day: "numeric", timeZone: tz }).format(d),
    month: new Intl.DateTimeFormat(locale, { month: "short", timeZone: tz }).format(d),
  };
}

/** YYYY-MM-DD for a date in a timezone. */
export function isoDate(d: Date, tz = DEFAULT_TZ) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, p) => ((acc[p.type] = p.value), acc), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Minutes since midnight in a timezone. */
export function minutesOfDay(iso: string | Date, tz = DEFAULT_TZ) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(new Date(iso))
    .reduce<Record<string, string>>((acc, p) => ((acc[p.type] = p.value), acc), {});
  return (Number(parts.hour) % 24) * 60 + Number(parts.minute);
}

export function durationLabel(min: number, locale = "en") {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  const hours = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(m ? h + m / 60 : h);
  return `${hours} h`;
}

export function pct(n: number, locale = "en", digits = 0) {
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: digits }).format(n);
}

export function compact(n: number, locale = "en") {
  return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function num(n: number, locale = "en") {
  return new Intl.NumberFormat(locale).format(n);
}

/** "+961 71 234 567" from "96171234567". */
export function prettyPhone(digits: string | null | undefined) {
  if (!digits) return "";
  const d = digits.replace(/\D/g, "");
  if (d.startsWith("961") && d.length >= 10) {
    const rest = d.slice(3);
    return `+961 ${rest.slice(0, 2)} ${rest.slice(2, 5)} ${rest.slice(5)}`.trim();
  }
  return `+${d}`;
}

/** Short reference from a uuid: "NS-4F7K2". */
export function shortRef(id: string) {
  return `NS-${id.replace(/-/g, "").slice(0, 5).toUpperCase()}`;
}

/** Wall clock accessors kept out of component bodies (React purity lint). */
export const nowMs = () => Date.now();
export const nowDate = () => new Date();

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
