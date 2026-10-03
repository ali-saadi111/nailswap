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
import { publicEnv } from "@/lib/env";
import { contrastText, luminance } from "@/lib/utils";
import { money, fmtDay } from "@/lib/format";
import { openState, summarizeHours, hhmm } from "@/lib/hours";
import { Avatar, StatusDot, EmptyState, Notice } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { NailGroup, fillForDesign } from "@/components/nails/nail";
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
  const tc = await getTranslations("common");
  const sp = await searchParams;

  const state = openState(hours, salon.timezone);
  const hoursLine = summarizeHours(
    hours,
    (i) => tc(`weekdaysShort.${i}` as never),
    t("closed").toLowerCase(),
  );
  const host = `${salon.slug}.${publicEnv.rootDomain}`;
  const approval = salon.booking_mode === "approval";
  const minPrice = services.length ? Math.min(...services.map((s) => Number(s.price))) : null;
  const initialTab =
    (["designs", "services", "reviews", "about"] as const).find((x) => x === sp.tab) ?? "designs";

  const designsPanel = designs.length ? (
    <div className="grid grid-cols-3 gap-x-4 gap-y-5">
      {designs.map((d) => (
        <Link
          key={d.id}
          href={`/s/${salon.slug}/try?designId=${d.id}`}
          className="text-foreground hover:text-accent min-w-0"
        >
          <NailGroup shape={d.shape} fill={fillForDesign(d)} size={18} gap={5} className="h-[30px]" />
          <span className="mt-2 block truncate text-[13px] font-medium">{d.name}</span>
          <span className="text-muted mt-0.5 block text-[13px]">
            {d.priceAddon > 0
              ? t("addon", { price: money(d.priceAddon, salon.currency, locale) })
              : t("included")}
          </span>
        </Link>
      ))}
    </div>
  ) : (
    <EmptyState title={t("noDesigns")} description={t("noDesignsBody")} />
  );

  const servicesPanel = (
    <div>
      {services.map((s) => (
        <Link
          key={s.id}
          href={`/s/${salon.slug}/book?serviceId=${s.id}`}
          className="border-border hover:text-accent flex min-h-12 items-center gap-3 border-b py-2"
        >
          <span className="flex-1 text-[15px]">{s.name}</span>
          <span className="text-muted text-[13px]">{tc("min", { count: s.duration_min })}</span>
          <span className="w-12 text-end text-[15px] font-semibold">
            {money(s.price, salon.currency, locale)}
          </span>
        </Link>
      ))}
    </div>
  );

  const reviewsPanel = reviews.length ? (
    <div>
      {reviews.map((r) => (
        <article key={r.id} className="border-border border-b py-4">
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
            <div className="border-border mt-3 border-s ps-4">
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
    <div className="space-y-8">
      {salon.description && <p className="text-[15px] leading-6">{salon.description}</p>}
      <section>
        <h3 className="text-[15px] font-semibold">{t("hours")}</h3>
        <dl className="mt-2">
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
              className="text-accent hover:text-foreground mt-1 inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium"
            >
              <MapPin className="size-5" strokeWidth={1.75} />
              {t("directions")}
            </a>
          )}
        </section>
      )}
      <section className="flex flex-wrap gap-x-7">
        {waNumber && (
          <a
            href={`https://wa.me/${waNumber.replace(/\D/g, "")}`}
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:text-foreground inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium"
          >
            <MessageCircle className="size-5" strokeWidth={1.75} />
            {t("whatsapp")}
          </a>
        )}
        {salon.phone && (
          <a
            href={`tel:+${salon.phone.replace(/\D/g, "")}`}
            className="text-accent hover:text-foreground inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium"
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
            className="text-accent hover:text-foreground inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium"
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
            className="text-accent hover:text-foreground inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium"
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
      className="mx-auto flex min-h-dvh w-full max-w-[640px] flex-col px-6 pt-3"
    >
      <TrackView salonId={salon.id} />
      <PhoneHeader
        leading={<BackButton fallback="/explore" label={t("back")} />}
        center={
          <span className="text-muted flex items-center gap-1.5 text-[13px]" dir="ltr">
            <Lock className="size-[13px]" strokeWidth={2} />
            {host}
          </span>
        }
        trailing={<ShareSalonButton salonId={salon.id} name={salon.name} />}
      />

      {salon.status === "pending" && (
        <Notice className="mt-3" icon={<Lock />}>
          {t("previewBanner")}
        </Notice>
      )}

      <div className="mt-4 flex items-center gap-4">
        <Avatar name={salon.name} src={salon.logoUrl} size={64} serif />
        <div className="min-w-0 flex-1">
          <h1 className="font-display truncate text-[28px] leading-8">{salon.name}</h1>
          <div className="mt-1 flex items-center gap-1.5 text-sm">
            {salon.rating_count > 0 && (
              <>
                <Star className="text-accent size-3.5 fill-current" strokeWidth={1.5} />
                <b className="font-semibold">{Number(salon.rating_avg).toFixed(1)}</b>
                <span className="text-muted">{t("reviewCount", { count: salon.rating_count })}</span>
                <span className="text-muted">·</span>
              </>
            )}
            <span className="text-muted truncate">{salon.area ?? salon.city}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1">
        {state.open ? (
          <StatusDot tone="success">{t("open")}</StatusDot>
        ) : state.opensAt ? (
          <StatusDot tone="hollow">{t("opensAt", { time: state.opensAt })}</StatusDot>
        ) : (
          <StatusDot tone="hollow">{state.closedToday ? t("closedToday") : t("closed")}</StatusDot>
        )}
        <span className="text-muted text-[13px]" dir="ltr">
          {hoursLine}
        </span>
      </div>

      <div className="mt-1 flex items-center gap-6">
        <Link
          href={`/s/${salon.slug}/try`}
          className="text-accent hover:text-foreground inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium"
        >
          <Sparkles className="size-5" strokeWidth={1.75} />
          {t("tryDesigns")}
        </Link>
        <Link
          href={`/s/${salon.slug}/book`}
          className="text-accent hover:text-foreground inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium"
        >
          <CalendarDays className="size-5" strokeWidth={1.75} />
          {t("book")}
        </Link>
      </div>

      <SalonTabs
        initial={initialTab}
        reviewCount={salon.rating_count}
        designs={
          <>
            {designsPanel}
            {services.length > 0 && (
              <>
                <div className="mt-5 flex h-11 items-center justify-between">
                  <h2 className="text-[15px] font-semibold">{t("services")}</h2>
                  <Link
                    href={`/s/${salon.slug}?tab=services`}
                    className="text-accent hover:text-foreground inline-flex min-h-11 items-center text-sm font-medium"
                  >
                    {t("allServices", { count: services.length })}
                  </Link>
                </div>
                <div>
                  {services.slice(0, 3).map((s) => (
                    <Link
                      key={s.id}
                      href={`/s/${salon.slug}/book?serviceId=${s.id}`}
                      className="border-border hover:text-accent flex min-h-12 items-center gap-3 border-b py-2"
                    >
                      <span className="flex-1 text-[15px]">{s.name}</span>
                      <span className="text-muted text-[13px]">{tc("min", { count: s.duration_min })}</span>
                      <span className="w-12 text-end text-[15px] font-semibold">
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
            <span className="text-muted text-[13px]">
              {t("services")} · {tc("from").toLowerCase()} {money(minPrice, salon.currency, locale)}
            </span>
          ) : undefined
        }
      >
        <ButtonLink href={`/s/${salon.slug}/book`} size="lg" className="w-full">
          {approval ? t("requestAppointment") : t("bookAppointment")}
        </ButtonLink>
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
