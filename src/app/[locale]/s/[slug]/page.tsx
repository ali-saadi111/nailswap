import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  AtSign,
  CalendarDays,
  Lock,
  MapPin,
  MessageCircle,
  Phone,
  Sparkles,
  Star,
  Globe,
} from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ApiError } from "@/lib/api";
import { getPublicSalon } from "@/lib/salons/public";
import { contrastText, luminance } from "@/lib/utils";
import { money, fmtDay } from "@/lib/format";
import { openState, summarizeHours, hhmm } from "@/lib/hours";
import { Avatar, StatusDot, EmptyState, Notice } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { NailHeroRow } from "@/components/nails/nail";
import { BackButton, PhoneHeader } from "@/components/shell/phone-header";
import { StickyAction } from "@/components/shell/consumer-shell";
import { TrackView } from "@/components/track-view";
import { ShareSalonButton } from "./salon-header-actions";
import { SalonTabs } from "./salon-tabs";

async function load(slug: string) {
  try {
    return await getPublicSalon(slug);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return {};
  return {
    title: data.salon.name,
    description: data.salon.description ?? undefined,
    openGraph: data.salon.coverUrl ? { images: [data.salon.coverUrl] } : undefined,
  };
}

/** Salon brand colour as the page accent when it keeps ≥ 4.5:1 with white text. */
function accentStyle(brand: string | null | undefined): React.CSSProperties | undefined {
  if (!brand || !/^#[0-9a-fA-F]{6}$/.test(brand)) return undefined;
  if (contrastText(brand) !== "#ffffff" || luminance(brand) > 0.2) return undefined;
  return {
    ["--accent" as string]: brand,
    ["--accent-hover" as string]: `color-mix(in oklab, ${brand} 85%, black)`,
  };
}

export default async function SalonPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const data = await load(slug);
  if (!data) notFound();
  const { salon, hours, staff, services, designs, reviews } = data;
  const t = await getTranslations("ui.salon");
  const tTabs = await getTranslations("ui.tabs");
  const tc = await getTranslations("common");
  const sp = await searchParams;

  const state = openState(hours, salon.timezone);
  const hoursLine = summarizeHours(
    hours,
    (i) => tc(`weekdaysShort.${i}` as never),
    t("closed").toLowerCase(),
  );
  const feedText = await getTranslations("merchant");
  const approval = salon.booking_mode === "approval";
  const minPrice = services.length ? Math.min(...services.map((s) => Number(s.price))) : null;
  const initialTab =
    (["designs", "services", "reviews", "about"] as const).find((x) => x === sp.tab) ?? "designs";

  const designsPanel = designs.length ? (
    <div className="grid grid-cols-2 gap-3">
      {designs.map((d) => (
        <article key={d.id} className="bg-surface overflow-hidden rounded-[26px]">
          <Link href={`/s/${salon.slug}/try?designId=${d.id}`}>
            {d.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={d.coverUrl}
                alt={d.name}
                loading="lazy"
                className="aspect-[4/5] w-full object-cover"
              />
            ) : (
              <div className="bg-surface-2 flex aspect-[4/5] items-center justify-center">
                <Sparkles className="text-accent size-10" />
              </div>
            )}
          </Link>
          <div className="p-3">
            <h3 className="truncate text-[15px] font-extrabold">{d.name}</h3>
            {d.description && (
              <p className="text-muted mt-1 line-clamp-2 text-[13px] leading-snug">{d.description}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-x-3">
              <Link
                href={`/s/${salon.slug}/try?designId=${d.id}`}
                className="text-accent inline-flex min-h-10 items-center gap-1 text-[13px] font-bold"
              >
                <Sparkles className="size-4" />
                {feedText("tryPhoto")}
              </Link>
              <Link
                href={`/s/${salon.slug}/book?designId=${d.id}`}
                className="inline-flex min-h-10 items-center text-[13px] font-bold"
              >
                {feedText("bookLook")}
              </Link>
            </div>
          </div>
        </article>
      ))}
    </div>
  ) : (
    <EmptyState title={t("noDesigns")} description={t("noDesignsBody")} />
  );

  const servicesPanel = (
    <div className="bg-surface rounded-[26px] px-4">
      {services.map((s) => (
        <Link
          key={s.id}
          href={`/s/${salon.slug}/book?serviceId=${s.id}`}
          className="border-border hover:text-accent flex min-h-[60px] items-center gap-3 border-b py-2 last:border-b-0"
        >
          <span className="flex-1 text-[15px] font-bold">{s.name}</span>
          <span className="text-muted text-[13px] font-semibold">{tc("min", { count: s.duration_min })}</span>
          <span className="w-14 text-end text-[15px] font-extrabold">
            {money(s.price, salon.currency, locale)}
          </span>
        </Link>
      ))}
    </div>
  );

  const reviewsPanel = reviews.length ? (
    <div>
      {reviews.map((r) => (
        <article key={r.id} className="bg-surface mb-2.5 rounded-[24px] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Avatar name={r.authorName} size={32} />
              <span className="text-[15px] font-semibold">{r.authorName}</span>
            </div>
            <span className="flex items-center gap-1 text-[13px]" aria-label={`${r.rating}/5`}>
              <Star className="text-accent size-3.5 fill-current" strokeWidth={1.5} />
              <b className="font-semibold">{r.rating.toFixed(1)}</b>
              <span className="text-muted ms-1">
                {fmtDay(r.createdAt, locale, salon.timezone, { day: "numeric", month: "short" })}
              </span>
            </span>
          </div>
          {r.body && <p className="mt-2 text-[15px] leading-6">{r.body}</p>}
          {r.salonReply && (
            <div className="bg-surface-2/60 mt-3 rounded-2xl p-3">
              <div className="text-muted text-[13px]">{t("replyFrom", { salon: salon.name })}</div>
              <p className="mt-1 text-[14px] leading-5">{r.salonReply}</p>
            </div>
          )}
        </article>
      ))}
    </div>
  ) : (
    <EmptyState title={t("noReviews")} description={t("noReviewsBody")} />
  );

  const mapsUrl =
    salon.lat !== null && salon.lng !== null
      ? `https://www.google.com/maps/dir/?api=1&destination=${salon.lat},${salon.lng}`
      : salon.address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${salon.address} ${salon.city ?? ""}`)}`
        : null;
  const waNumber = salon.whatsapp_number ?? salon.phone;

  const aboutPanel = (
    <div className="space-y-6">
      {salon.description && <p className="text-[15px] leading-6">{salon.description}</p>}
      <section className="bg-surface rounded-[26px] px-4 pt-4 pb-2">
        <h3 className="text-[15px] font-extrabold">{t("hours")}</h3>
        <dl className="mt-1">
          {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
            const h = hours.find((x) => x.weekday === wd);
            const closed = !h || h.is_closed || !h.open_time || !h.close_time;
            return (
              <div
                key={wd}
                className="border-border flex h-10 items-center justify-between border-b text-sm last:border-b-0"
              >
                <dt className="text-muted">{tc(`weekdays.${wd}` as never)}</dt>
                <dd dir="ltr">{closed ? t("closed") : `${hhmm(h!.open_time)}–${hhmm(h!.close_time)}`}</dd>
              </div>
            );
          })}
        </dl>
      </section>
      {(salon.address || salon.city) && (
        <section>
          <h3 className="text-[15px] font-semibold">{t("location")}</h3>
          <p className="text-muted mt-2 text-[15px]">
            {[salon.address, salon.area, salon.city].filter(Boolean).join(", ")}
          </p>
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:text-foreground mt-1 inline-flex min-h-11 items-center gap-1.5 text-[15px] font-bold"
            >
              <MapPin className="size-5" strokeWidth={1.75} />
              {t("directions")}
            </a>
          )}
        </section>
      )}
      <section className="flex flex-wrap gap-2">
        {waNumber && (
          <a
            href={`https://wa.me/${waNumber.replace(/\D/g, "")}`}
            target="_blank"
            rel="noreferrer"
            className="bg-surface text-foreground hover:text-accent inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[14px] font-bold"
          >
            <MessageCircle className="size-5" strokeWidth={1.75} />
            {t("whatsapp")}
          </a>
        )}
        {salon.phone && (
          <a
            href={`tel:+${salon.phone.replace(/\D/g, "")}`}
            className="bg-surface text-foreground hover:text-accent inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[14px] font-bold"
          >
            <Phone className="size-5" strokeWidth={1.75} />
            {t("call")}
          </a>
        )}
        {salon.instagram && (
          <a
            href={`https://instagram.com/${salon.instagram.replace(/^@/, "")}`}
            target="_blank"
            rel="noreferrer"
            className="bg-surface text-foreground hover:text-accent inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[14px] font-bold"
          >
            <AtSign className="size-5" strokeWidth={1.75} />
            {t("instagram")}
          </a>
        )}
        {salon.website && (
          <a
            href={salon.website}
            target="_blank"
            rel="noreferrer"
            className="bg-surface text-foreground hover:text-accent inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[14px] font-bold"
          >
            <Globe className="size-5" strokeWidth={1.75} />
            {t("website")}
          </a>
        )}
      </section>
      {staff.length > 0 && (
        <section>
          <h3 className="text-[15px] font-semibold">{t("team")}</h3>
          <div className="mt-3 flex flex-wrap gap-6">
            {staff.map((s) => (
              <div key={s.id} className="flex w-16 flex-col items-center text-center">
                <Avatar name={s.displayName} src={s.avatarUrl} size={48} />
                <span className="mt-2 truncate text-[13px] font-medium">{s.displayName}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );

  return (
    <div
      style={accentStyle(salon.brand_color)}
      className="mx-auto flex min-h-dvh w-full max-w-[640px] flex-col px-6"
    >
      <TrackView salonId={salon.id} />

      {/* Hero: cover photo (or the salon's nails) full-bleed, salon facts on a frosted card. */}
      <section className="bg-hero relative -mx-6 flex min-h-[400px] flex-col overflow-hidden rounded-b-[36px] sm:mx-0 sm:mt-3 sm:rounded-[36px]">
        {salon.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={salon.coverUrl} alt={salon.name} className="absolute inset-0 size-full object-cover" />
        ) : (
          <div aria-hidden className="absolute inset-x-0 top-20 flex justify-center px-10">
            <NailHeroRow size={50} gap={12} className="max-w-[330px] flex-1 -rotate-6" />
          </div>
        )}
        <PhoneHeader
          className="relative mx-0 px-3 pt-2"
          leading={<BackButton fallback="/" label={t("back")} />}
          trailing={<ShareSalonButton salonId={salon.id} name={salon.name} />}
        />
        <div className="flex-1" />
        <div className="glass relative m-3 rounded-[28px] p-4">
          <div className="flex items-center gap-3.5">
            <Avatar name={salon.name} src={salon.logoUrl} size={56} />
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-[28px] leading-tight break-words">{salon.name}</h1>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm font-semibold">
                {salon.rating_count > 0 && (
                  <>
                    <Star className="text-accent size-3.5 fill-current" strokeWidth={1.5} />
                    <b className="font-extrabold">{Number(salon.rating_avg).toFixed(1)}</b>
                    <span className="text-muted">{t("reviewCount", { count: salon.rating_count })}</span>
                    <span className="text-muted">·</span>
                  </>
                )}
                <span className="text-muted truncate">{salon.area ?? salon.city}</span>
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            {state.open ? (
              <StatusDot tone="success" className="font-bold">
                {t("open")}
              </StatusDot>
            ) : state.opensAt ? (
              <StatusDot tone="hollow" className="font-bold">
                {t("opensAt", { time: state.opensAt })}
              </StatusDot>
            ) : (
              <StatusDot tone="hollow" className="font-bold">
                {state.closedToday ? t("closedToday") : t("closed")}
              </StatusDot>
            )}
            <span className="text-muted text-[13px] font-semibold" dir="ltr">
              {hoursLine}
            </span>
          </div>
        </div>
      </section>

      {salon.status === "pending" && (
        <Notice className="mt-4" icon={<Lock />}>
          {t("previewBanner")}
        </Notice>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link
          href={`/s/${salon.slug}/try`}
          className="bg-foreground text-background inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[14px] font-bold"
        >
          <Sparkles className="size-[18px]" strokeWidth={2} />
          {t("tryDesigns")}
        </Link>
        <Link
          href={`/s/${salon.slug}/book`}
          className="bg-surface text-foreground hover:text-accent inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[14px] font-bold"
        >
          <CalendarDays className="size-[18px]" strokeWidth={2} />
          {t("book")}
        </Link>
      </div>

      <SalonTabs
        key={initialTab}
        initial={initialTab}
        reviewCount={salon.rating_count}
        designs={
          <>
            {designsPanel}
            {services.length > 0 && (
              <>
                <div className="mt-6 flex h-11 items-center justify-between">
                  <h2 className="text-lg font-extrabold">{t("services")}</h2>
                  <Link
                    href={`/s/${salon.slug}?tab=services`}
                    className="text-accent hover:text-foreground inline-flex min-h-11 items-center text-sm font-bold"
                  >
                    {t("allServices", { count: services.length })}
                  </Link>
                </div>
                <div className="bg-surface rounded-[26px] px-4">
                  {services.slice(0, 3).map((s) => (
                    <Link
                      key={s.id}
                      href={`/s/${salon.slug}/book?serviceId=${s.id}`}
                      className="border-border hover:text-accent flex min-h-[60px] items-center gap-3 border-b py-2 last:border-b-0"
                    >
                      <span className="flex-1 text-[15px] font-bold">{s.name}</span>
                      <span className="text-muted text-[13px] font-semibold">
                        {tc("min", { count: s.duration_min })}
                      </span>
                      <span className="w-14 text-end text-[15px] font-extrabold">
                        {money(s.price, salon.currency, locale)}
                      </span>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </>
        }
        services={servicesPanel}
        reviews={reviewsPanel}
        about={aboutPanel}
      />

      {approval && <p className="text-muted mt-4 text-[13px]">{t("approvalNote")}</p>}

      <StickyAction
        className="mt-8"
        summary={
          minPrice !== null ? (
            <span className="text-muted text-[13px] font-semibold">
              {t("services")} · {tc("from").toLowerCase()} {money(minPrice, salon.currency, locale)}
            </span>
          ) : undefined
        }
      >
        <div className="flex gap-2">
          <ButtonLink href={`/s/${salon.slug}/try`} variant="secondary" size="lg" className="px-5">
            <Sparkles className="size-[18px]" strokeWidth={2} />
            {tTabs("tryOn")}
          </ButtonLink>
          <ButtonLink href={`/s/${salon.slug}/book`} size="lg" className="flex-1 px-4">
            {approval ? t("requestAppointment") : t("bookAppointment")}
          </ButtonLink>
        </div>
      </StickyAction>
      {!salon.remove_branding && (
        <p className="text-muted mt-3 pb-6 text-center text-[12px]">
          <Link href="/" className="hover:text-foreground">
            {t("poweredBy")}
          </Link>
        </p>
      )}
    </div>
  );
}
