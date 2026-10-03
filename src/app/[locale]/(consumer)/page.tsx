import { Suspense } from "react";
import { ChevronRight, MapPin, Sparkles } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Wordmark } from "@/components/shell/wordmark";
import { ButtonLink } from "@/components/ui/button";
import { ListRow } from "@/components/ui/list-row";
import { Avatar, Skeleton } from "@/components/ui/primitives";
import { NailGroup, NailHeroRow, fillForDesign } from "@/components/nails/nail";
import { directoryQuerySchema, searchSalons } from "@/lib/salons/directory";
import { listTrendingDesigns } from "@/lib/salons/trending";
import { money } from "@/lib/format";
import { HeaderAuthLink } from "./header-auth-link";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("ui.home");

  return (
    <>
      <header className="flex h-11 items-center justify-between md:hidden">
        <Wordmark />
        <HeaderAuthLink />
      </header>

      <NailHeroRow className="mt-4 md:mx-auto md:mt-10 md:w-[420px]" />

      <h1 className="font-display mt-5 text-[32px] leading-[36px] md:mt-8 md:text-center md:text-[44px] md:leading-[1.1]">
        {t("title")}
      </h1>
      <p className="text-muted mt-2 text-sm leading-5 md:text-center md:text-[15px]">
        <span className="text-foreground me-2 font-medium">{t("how")}</span>
        {t("steps")}
      </p>

      <div className="mt-5 flex items-center gap-6 md:justify-center">
        <ButtonLink href="/try" size="lg">
          <Sparkles className="size-5" strokeWidth={1.75} />
          {t("tryCta")}
        </ButtonLink>
        <ButtonLink href="/explore" variant="link" size="lg">
          {t("findSalon")}
          <ChevronRight className="size-4 rtl:-scale-x-100" />
        </ButtonLink>
      </div>

      <div className="border-border-strong mt-3 flex h-12 items-center gap-2.5 border-b">
        <MapPin className="text-accent size-5" strokeWidth={1.75} />
        <span className="sr-only">{t("yourArea")}</span>
        <span className="flex-1 text-base">{t("anywhere")}</span>
        <Link
          href="/explore"
          className="text-accent hover:text-foreground inline-flex min-h-11 items-center text-sm font-medium"
        >
          {t("change")}
        </Link>
      </div>

      <div className="mt-3 flex h-11 items-center justify-between">
        <h2 className="text-[15px] font-semibold">{t("trending")}</h2>
        <Link
          href="/explore"
          className="text-accent hover:text-foreground inline-flex min-h-11 items-center text-sm font-medium"
        >
          {t("seeAll")}
        </Link>
      </div>
      <Suspense fallback={<TrendingSkeleton />}>
        <Trending />
      </Suspense>

      <h2 className="mt-4 text-[15px] font-semibold">{t("featuredSalons")}</h2>
      <Suspense fallback={<SalonsSkeleton />}>
        <FeaturedSalons locale={locale} />
      </Suspense>

      <nav aria-label="Footer" className="text-muted mt-6 flex items-center gap-5 text-[13px]">
        <Link href="/legal/terms" className="hover:text-foreground min-h-11 leading-[44px]">
          {t("terms")}
        </Link>
        <Link href="/legal/privacy" className="hover:text-foreground min-h-11 leading-[44px]">
          {t("privacy")}
        </Link>
        <Link href="/for-salons" className="hover:text-foreground min-h-11 leading-[44px]">
          {t("forSalons")}
        </Link>
        <span className="ms-auto">{t("copyright", { year: new Date().getFullYear() })}</span>
      </nav>
    </>
  );
}

async function Trending() {
  const designs = await listTrendingDesigns(8).catch(() => []);
  if (!designs.length) return null;
  return (
    <div className="no-scrollbar -me-6 flex gap-5 overflow-x-auto pe-6">
      {designs.map((d) => (
        <Link
          key={d.id}
          href={`/s/${d.salonSlug}/try?designId=${d.id}`}
          className="text-foreground hover:text-accent w-24 shrink-0"
        >
          <NailGroup shape={d.shape} fill={fillForDesign(d)} size={16} className="h-[26px]" />
          <span className="mt-2 block truncate text-[13px] font-medium">{d.name}</span>
        </Link>
      ))}
    </div>
  );
}

function TrendingSkeleton() {
  return (
    <div className="flex gap-5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="w-24">
          <Skeleton className="h-[26px] w-14" />
          <Skeleton className="mt-2 w-20" />
        </div>
      ))}
    </div>
  );
}

async function FeaturedSalons({ locale }: { locale: string }) {
  const t = await getTranslations("ui.home");
  const { items } = await searchSalons(directoryQuerySchema.parse({ limit: 4 })).catch(() => ({
    items: [] as Awaited<ReturnType<typeof searchSalons>>["items"],
  }));
  if (!items.length) {
    return (
      <div className="py-6">
        <div className="font-display text-2xl">{t("noSalons")}</div>
        <p className="text-muted mt-1 text-[15px]">{t("noSalonsBody")}</p>
      </div>
    );
  }
  return (
    <div className="mt-1">
      {items.map((s) => (
        <ListRow
          key={s.id}
          href={`/s/${s.slug}`}
          minHeight="min-h-[60px]"
          leading={<Avatar name={s.name} src={s.logoUrl} size={44} />}
          title={s.name}
          meta={[
            s.ratingCount ? s.ratingAvg.toFixed(1) : null,
            s.area ?? s.city,
            s.fromPrice !== null ? t("fromPrice", { price: money(s.fromPrice, "USD", locale) }) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          chevron
        />
      ))}
    </div>
  );
}

function SalonsSkeleton() {
  return (
    <div className="mt-1">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="border-border flex min-h-[60px] items-center gap-3.5 border-b">
          <Skeleton circle className="size-11" />
          <div className="flex-1">
            <Skeleton className="w-40" />
            <Skeleton className="mt-2 w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}
