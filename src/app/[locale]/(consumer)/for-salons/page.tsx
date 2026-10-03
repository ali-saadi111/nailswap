import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Wordmark } from "@/components/shell/wordmark";
import { ButtonLink } from "@/components/ui/button";
import { NailHeroRow } from "@/components/nails/nail";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/format";
import { HeaderAuthLink } from "../header-auth-link";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ui.forSalons" });
  return { title: t("eyebrow"), description: t("body") };
}

export default async function ForSalonsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("ui.forSalons");
  const tb = await getTranslations("billing");
  const supabase = await createClient();
  const { data: plans } = await supabase
    .from("plans")
    .select("code, name, price_usd, ai_quota_monthly, staff_seats, remove_branding, directory_priority")
    .eq("is_active", true)
    .order("price_usd");

  const points = [
    { title: t("p1Title"), body: t("p1") },
    { title: t("p2Title"), body: t("p2") },
    { title: t("p3Title"), body: t("p3") },
  ];

  return (
    <>
      <header className="flex h-11 items-center justify-between md:hidden">
        <Wordmark suffix={t("eyebrow").toLowerCase()} />
        <HeaderAuthLink />
      </header>
      <NailHeroRow className="mt-4 w-[260px]" size={34} />
      <p className="text-muted mt-6 text-[13px] font-medium">{t("eyebrow")}</p>
      <h1 className="font-display mt-1 max-w-[560px] text-[32px] leading-[1.1] md:text-[44px]">
        {t("title")}
      </h1>
      <p className="text-muted mt-3 max-w-[520px] text-[15px] leading-6">{t("body")}</p>
      <div className="mt-5 flex items-center gap-6">
        <ButtonLink href="/login?next=/dashboard/onboarding" size="lg">
          {t("cta")}
        </ButtonLink>
        <Link
          href="/login?next=/dashboard"
          className="text-accent hover:text-foreground text-[15px] font-medium"
        >
          {t("signIn")}
        </Link>
      </div>
      <p className="text-muted mt-2 text-[13px]">{t("trial")}</p>

      <div className="mt-12 grid gap-10 md:grid-cols-3">
        {points.map((p) => (
          <div key={p.title}>
            <h2 className="font-display text-2xl leading-tight">{p.title}</h2>
            <p className="text-muted mt-2 text-[15px] leading-6">{p.body}</p>
          </div>
        ))}
      </div>

      {plans && plans.length > 0 && (
        <section className="mt-14">
          <h2 className="font-display text-2xl">{t("plansTitle")}</h2>
          <div className="mt-6 grid gap-10 md:grid-cols-3">
            {plans.map((p) => (
              <div key={p.code}>
                <div className="text-[15px] font-semibold">{p.name}</div>
                <div className="font-display mt-2 text-[40px] leading-none">
                  {p.price_usd > 0 ? money(p.price_usd, "USD", locale) : tb("trial")}
                  {p.price_usd > 0 && (
                    <span className="text-muted font-sans text-[15px]">{tb("perMonth")}</span>
                  )}
                </div>
                <ul className="text-muted mt-4 space-y-1.5 text-sm">
                  <li>{tb("aiQuota", { count: p.ai_quota_monthly })}</li>
                  <li>{tb("arUnlimited")}</li>
                  <li>{tb("seats", { count: p.staff_seats })}</li>
                  <li>{p.directory_priority > 1 ? tb("directoryPriority") : tb("directory")}</li>
                  {p.remove_branding && <li>{tb("branding")}</li>}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
