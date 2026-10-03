import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Wordmark } from "@/components/shell/wordmark";
import { NailHeroRow } from "@/components/nails/nail";
import { ButtonLink } from "@/components/ui/button";
import { LogoutEffect } from "./logout-effect";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ui.auth" });
  return { title: t("signedOut") };
}

export default async function LogoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("ui.auth");
  const th = await getTranslations("ui.home");
  const year = new Date().getFullYear();

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-[1280px] flex-col px-6 lg:px-12">
      <LogoutEffect />
      <div className="h-[72px] pt-9 lg:h-24">
        <Wordmark />
      </div>
      <main className="mx-auto flex w-full max-w-[380px] flex-1 flex-col items-center pt-16 text-center lg:pt-24">
        <NailHeroRow size={20} className="w-[132px]" />
        <h1 className="font-display mt-7 text-[40px] leading-[1.05] lg:text-[44px]">{t("signedOut")}</h1>
        <p className="text-muted mt-3 max-w-[340px] text-base leading-6">{t("signedOutBody")}</p>
        <ButtonLink href="/login" size="md" className="mt-9 w-full">
          {t("signInAgain")}
        </ButtonLink>
        <ButtonLink href="/" variant="link" size="lg" className="mt-3">
          {t("goHome")}
        </ButtonLink>
        <p className="text-muted mt-5 text-[13px]">{t("sharedComputer")}</p>
      </main>
      <footer className="text-muted flex flex-wrap items-center justify-center gap-x-6 py-3 text-[13px]">
        <span>© {year} NailSwap</span>
        <Link href="/legal/terms" className="hover:text-foreground inline-flex min-h-11 items-center">
          {th("terms")}
        </Link>
        <Link href="/legal/privacy" className="hover:text-foreground inline-flex min-h-11 items-center">
          {th("privacy")}
        </Link>
        <a
          href="mailto:help@nailswap.app"
          className="hover:text-foreground inline-flex min-h-11 items-center"
        >
          {t("help")}
        </a>
      </footer>
    </div>
  );
}
