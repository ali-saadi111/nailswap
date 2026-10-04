import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { IBM_Plex_Sans_Arabic, Urbanist } from "next/font/google";
import { routing, isRtl } from "@/i18n/routing";
import { publicEnv } from "@/lib/env";
import { Toaster } from "@/components/ui/toaster";
import "../globals.css";

/** Blush Immersive: one family — Urbanist (variable). `--font-display` aliases it in globals.css. */
const urbanist = Urbanist({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  display: "swap",
});

const arabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL(publicEnv.appUrl),
    title: { default: t("title"), template: `%s · NailSwap` },
    description: t("description"),
    applicationName: "NailSwap",
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: "NailSwap", statusBarStyle: "default" },
    openGraph: { type: "website", siteName: "NailSwap", locale },
    twitter: { card: "summary_large_image" },
    alternates: {
      languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}`])),
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6eae6" },
    { media: "(prefers-color-scheme: dark)", color: "#1d1514" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      dir={isRtl(locale) ? "rtl" : "ltr"}
      className={`${urbanist.variable} ${arabic.variable}`}
      suppressHydrationWarning
    >
      <body>
        <NextIntlClientProvider>
          {children}
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
