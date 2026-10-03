import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getClaims } from "@/lib/supabase/server";
import { Link } from "@/i18n/navigation";
import { Wordmark } from "@/components/shell/wordmark";
import { NailHeroRow } from "@/components/nails/nail";
import { LoginForm } from "./login-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ui.auth" });
  return { title: t("signIn") };
}

function safeNext(next: string | undefined, locale: string) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next.startsWith(`/${locale}/`) || next === `/${locale}` ? next : `/${locale}${next}`;
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { next } = await searchParams;
  const nextPath = safeNext(next, locale);

  const claims = await getClaims();
  if (claims.userId) {
    if (nextPath) redirect({ href: nextPath.replace(new RegExp(`^/${locale}`), "") || "/", locale });
    redirect({
      href: claims.isPlatformAdmin
        ? "/admin"
        : Object.keys(claims.salonRoles).length
          ? "/dashboard"
          : "/account",
      locale,
    });
  }

  const t = await getTranslations("ui.auth");
  const th = await getTranslations("ui.home");
  const year = new Date().getFullYear();

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-[1280px] flex-col px-6 lg:px-12">
      <div className="h-[72px] pt-9 lg:h-24">
        <Wordmark />
      </div>
      <main className="mx-auto flex w-full max-w-[380px] flex-1 flex-col pt-4 lg:pt-8">
        <NailHeroRow size={20} className="w-[132px]" />
        <h1 className="font-display mt-6 text-[40px] leading-[1.05] lg:text-[44px]">{t("signIn")}</h1>
        <p className="text-muted mt-2 text-[15px]">{t("subtitle")}</p>
        {nextPath && (
          <p className="text-muted mt-3.5 text-sm" role="status">
            {t("continueTo")}{" "}
            <span className="text-accent font-medium" dir="ltr">
              {nextPath.replace(new RegExp(`^/${locale}`), "") || "/"}
            </span>
          </p>
        )}
        <LoginForm next={nextPath} locale={locale} />
        <p className="text-muted mt-5 text-center text-sm">
          {t("applyToJoin")}{" "}
          <Link href="/for-salons" className="text-accent hover:text-foreground font-medium">
            {t("applyLink")}
          </Link>
        </p>
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
