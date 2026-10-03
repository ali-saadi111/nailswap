import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Normalises a phone number to E.164 digits without '+', defaulting to Lebanon (+961). */
export function normalizePhone(input: string, defaultCountryCode = "961"): string {
  let digits = input.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("00")) digits = digits.slice(2);
  // Lebanese local formats: 03 123 456 / 70 123 456 / 71 / 76 / 78 / 79 / 81 / 01 ...
  if (digits.length <= 8) {
    if (digits.startsWith("0")) digits = digits.slice(1);
    digits = defaultCountryCode + digits;
  }
  return digits;
}

export function formatPhoneE164(input: string) {
  return `+${normalizePhone(input)}`;
}

export function formatMoney(amount: number, currency = "USD", locale = "en") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "LBP" ? 0 : 2,
    minimumFractionDigits: 0,
  }).format(amount);
}

export function slugify(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function truncate(text: string, max: number) {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h,
    16,
  );
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Relative luminance (WCAG) 0..1 */
export function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Picks black or white text for a background so contrast meets WCAG AA. */
export function contrastText(hex: string) {
  return luminance(hex) > 0.35 ? "#111111" : "#ffffff";
}

export function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${String(x)}`);
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
