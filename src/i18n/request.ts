import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: "Asia/Beirut",
    formats: {
      dateTime: {
        short: { day: "numeric", month: "short" },
        long: { weekday: "long", day: "numeric", month: "long", year: "numeric" },
        time: { hour: "numeric", minute: "2-digit" },
        dateTime: { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" },
      },
      number: {
        currency: { style: "currency", currency: "USD", maximumFractionDigits: 0 },
        percent: { style: "percent", maximumFractionDigits: 1 },
      },
    },
  };
});
