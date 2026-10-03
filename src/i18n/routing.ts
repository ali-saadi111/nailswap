import { defineRouting } from "next-intl/routing";

export const locales = ["en"] as const;
export type Locale = (typeof locales)[number];

export const LOCALE_COOKIE = "NAILSWAP_LOCALE";

export const routing = defineRouting({
  locales,
  defaultLocale: "en",
  localePrefix: "always",
  localeDetection: false,
  localeCookie: { name: LOCALE_COOKIE, maxAge: 60 * 60 * 24 * 365 },
});

export const rtlLocales: ReadonlySet<string> = new Set(["ar"]);

export function isRtl(locale: string) {
  return rtlLocales.has(locale);
}

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}
