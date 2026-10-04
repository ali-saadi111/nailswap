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
      <section className="bg-hero -mx-6 -mt-3 rounded-b-[36px] px-6 pt-3 pb-5 md:mx-0 md:mt-0 md:rounded-[36px]">
        <header className="flex min-h-11 flex-wrap items-center justify-between gap-2 md:hidden">
          <Wordmark suffix={t("eyebrow").toLowerCase()} />
          <HeaderAuthLink />
        </header>
        <NailHeroRow className="mx-auto my-8 w-full max-w-[260px]" size={34} />
        <div className="glass rounded-[28px] p-5">
          <p className="text-muted mt-6 text-[13px] font-medium">{t("eyebrow")}</p>
          <h1 className="font-display mt-1 max-w-[560px] text-[32px] leading-[1.1] md:text-[44px]">
            {t("title")}
          </h1>
          <p className="text-muted mt-3 max-w-[520px] text-[15px] leading-6">{t("body")}</p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <ButtonLink href="/login?next=/dashboard/onboarding" size="lg">
              {t("cta")}
            </ButtonLink>
            <Link
              href="/login?next=/dashboard"
              className="bg-surface text-foreground hover:text-accent inline-flex min-h-11 items-center rounded-full px-5 text-[15px] font-bold"
            >
              {t("signIn")}
            </Link>
          </div>
          <p className="text-muted mt-2 text-[13px]">{t("trial")}</p>
        </div>
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {points.map((p) => (
          <div key={p.title} className="bg-surface rounded-[26px] p-5">
            <h2 className="font-display text-2xl leading-tight">{p.title}</h2>
            <p className="text-muted mt-2 text-[15px] leading-6">{p.body}</p>
          </div>
        ))}
      </div>

      {plans && plans.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-2xl">{t("plansTitle")}</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {plans.map((p) => (
              <div key={p.code} className="bg-surface min-w-0 rounded-[26px] p-5">
                <div className="text-[15px] font-semibold">{p.name}</div>
                <div className="font-display mt-3 flex flex-wrap items-baseline gap-1 text-[36px] leading-tight">
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
