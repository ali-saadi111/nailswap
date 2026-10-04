"use client";

import * as React from "react";
import { Navigation, Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, StatusDot, Tabs, bookingTone } from "@/components/ui/primitives";
import { Nail, NailGroup, fillForDesign } from "@/components/nails/nail";
import { dayParts, fmtDay, fmtTimeRange, money, shortRef } from "@/lib/format";

export interface AccountBooking {
  id: string;
  status: "new" | "confirmed" | "completed" | "no_show" | "cancelled";
  startsAt: string;
  endsAt: string;
  totalPrice: number;
  currency: string;
  manageToken: string;
  isUpcoming: boolean;
  canReview: boolean;
  reviewRating: number | null;
  salon: {
    id: string;
    slug: string;
    name: string;
    area: string | null;
    city: string | null;
    address: string | null;
    timezone: string;
    lat: number | null;
    lng: number | null;
    logoUrl: string | null;
  } | null;
  service: { id: string; name: string } | null;
  staff: { id: string; displayName: string } | null;
  design: {
    id: string;
    name: string;
    coverUrl: string | null;
    category: string;
    shape: string | null;
  } | null;
}

export function BookingsList({ bookings }: { bookings: AccountBooking[] }) {
  const t = useTranslations("ui.account");
  const tb = useTranslations("ui.booking");
  const locale = useLocale();
  const [tab, setTab] = React.useState<"upcoming" | "past">("upcoming");
  const upcoming = bookings.filter((b) => b.isUpcoming).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = bookings.filter((b) => !b.isUpcoming);
  const list = tab === "upcoming" ? upcoming : past;

  const statusLabel = (s: AccountBooking["status"]) =>
    s === "new"
      ? tb("awaitingSalon")
      : s === "confirmed"
        ? tb("confirmed")
        : s === "completed"
          ? tb("completed")
          : s === "no_show"
            ? tb("noShow")
            : tb("cancelledStatus");

  return (
    <>
      <header className="flex min-h-[52px] flex-wrap items-center justify-between gap-2 py-2">
        <h1 className="font-display text-[34px] leading-tight">{t("bookingsTitle")}</h1>
      </header>
      <Tabs
        className="mt-2"
        value={tab}
        onChange={setTab}
        items={[
          { value: "upcoming", label: t("upcoming"), count: upcoming.length },
          { value: "past", label: t("past"), count: past.length },
        ]}
      />

      {list.length === 0 ? (
        <EmptyState
          title={tab === "upcoming" ? t("noUpcoming") : t("noPast")}
          description={tab === "upcoming" ? t("noUpcomingBody") : undefined}
          action={<ButtonLink href="/explore">{t("explore")}</ButtonLink>}
        />
      ) : tab === "upcoming" ? (
        upcoming.map((b) => {
          const tz = b.salon?.timezone ?? "Asia/Beirut";
          const parts = dayParts(b.startsAt, locale, tz);
          const mapsUrl =
            b.salon?.lat !== null && b.salon?.lat !== undefined && b.salon.lng !== null
              ? `https://www.google.com/maps/dir/?api=1&destination=${b.salon.lat},${b.salon.lng}`
              : null;
          return (
            <article key={b.id} className="bg-surface mt-3 flex items-start gap-4 rounded-[28px] p-4 pb-2">
              <div className="bg-accent text-accent-contrast flex w-16 shrink-0 flex-col items-center rounded-[20px] py-2.5 text-center">
                <b className="block text-[11px] font-extrabold tracking-[.12em] uppercase">{parts.weekday}</b>
                <div className="font-display my-0.5 text-[32px] leading-9">{parts.day}</div>
                <i className="block text-[11px] font-bold tracking-[.12em] uppercase not-italic opacity-85">
                  {parts.month}
                </i>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex min-h-5 flex-wrap items-center justify-between gap-1">
                  <StatusDot tone={bookingTone(b.status)}>{statusLabel(b.status)}</StatusDot>
                  <span className="text-muted text-[12px] tracking-wider" dir="ltr">
                    {shortRef(b.id)}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  {b.design && (
                    <Nail shape={b.design.shape} fill={fillForDesign(b.design)} width={12} height={17} />
                  )}
                  <h2 className="truncate text-[17px] leading-[22px] font-extrabold">
                    {b.design
                      ? tb("serviceDesign", { service: b.service?.name ?? "", design: b.design.name })
                      : (b.service?.name ?? "")}
                  </h2>
                </div>
                <div className="text-muted mt-1 text-sm" dir="ltr">
                  {fmtTimeRange(b.startsAt, b.endsAt, locale, tz)}
                  {b.staff ? ` · ${b.staff.displayName}` : ""}
                </div>
                <div className="text-muted mt-0.5 text-sm">
                  {b.salon?.name}
                  {b.salon?.area || b.salon?.city ? `, ${b.salon.area ?? b.salon.city}` : ""}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 pb-2">
                  <Link
                    href={`/b/${b.manageToken}`}
                    className="bg-foreground text-background inline-flex min-h-10 items-center rounded-full px-4 text-[14px] font-bold"
                  >
                    {t("manage")}
                  </Link>
                  {mapsUrl && (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-accent-soft text-accent hover:text-foreground inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-[14px] font-bold"
                    >
                      <Navigation className="size-[18px]" strokeWidth={1.75} />
                      {t("directions")}
                    </a>
                  )}
                </div>
              </div>
            </article>
          );
        })
      ) : (
        past.map((b) => {
          const tz = b.salon?.timezone ?? "Asia/Beirut";
          return (
            <div
              key={b.id}
              className="bg-surface mt-2.5 flex items-start gap-4 rounded-[24px] px-4 pt-3.5 pb-1"
            >
              <span className="bg-accent-soft mt-0.5 flex size-12 shrink-0 items-end justify-center rounded-full pb-2.5">
                {b.design ? (
                  <NailGroup shape={b.design.shape} fill={fillForDesign(b.design)} size={11} gap={3} />
                ) : (
                  <NailGroup size={11} gap={3} />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="truncate text-[15px] leading-5 font-extrabold">
                    {b.salon?.name} · {b.service?.name}
                  </div>
                  <StatusDot tone={bookingTone(b.status)} className="shrink-0">
                    {statusLabel(b.status)}
                  </StatusDot>
                </div>
                <div className="text-muted mt-0.5 text-[13px]">
                  {[b.design?.name, fmtDay(b.startsAt, locale, tz), money(b.totalPrice, b.currency, locale)]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  {b.salon && (
                    <Link
                      href={`/s/${b.salon.slug}/book?serviceId=${b.service?.id ?? ""}${b.design ? `&designId=${b.design.id}` : ""}`}
                      className="text-accent hover:text-foreground min-h-11 text-sm leading-[44px] font-medium"
                    >
                      {t("rebook")}
                    </Link>
                  )}
                  {b.canReview && (
                    <Link
                      href={`/b/${b.manageToken}/review`}
                      className="text-accent hover:text-foreground min-h-11 text-sm leading-[44px] font-medium"
                    >
                      {t("leaveReview")}
                    </Link>
                  )}
                  {b.reviewRating !== null && (
                    <span className="text-muted inline-flex min-h-11 items-center gap-1 text-[13px]">
                      <Star className="text-accent size-[13px] fill-current" strokeWidth={1.5} />
                      {t("yourReview", { rating: b.reviewRating.toFixed(1) })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
    </>
  );
}
