"use client";

import { CalendarPlus, Check, MessageSquare, Navigation } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/button";
import { KeyValueList } from "@/components/ui/primitives";
import { Nail, fillForDesign } from "@/components/nails/nail";
import { CloseButton } from "@/components/shell/phone-header";
import { StickyAction } from "@/components/shell/consumer-shell";
import { useMe } from "@/lib/client/use-me";
import { durationLabel, fmtDay, fmtTimeRange, money, prettyPhone, shortRef } from "@/lib/format";
import type { BookingDesign, BookingSalon, BookingView } from "./types";

function icsFor(b: BookingView) {
  const fmt = (iso: string) =>
    new Date(iso)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NailSwap//EN",
    "BEGIN:VEVENT",
    `UID:${b.id}@nailswap.app`,
    `DTSTAMP:${fmt(new Date().toISOString())}`,
    `DTSTART:${fmt(b.startsAt)}`,
    `DTEND:${fmt(b.endsAt)}`,
    `SUMMARY:${b.service?.name ?? "Nails"}${b.design ? ` + ${b.design.name}` : ""} · ${b.salon?.name ?? "NailSwap"}`,
    `LOCATION:${[b.salon?.address, b.salon?.city].filter(Boolean).join(", ")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\r\n"))}`;
}

export function Confirmation({
  booking,
  salon,
  design,
}: {
  booking: BookingView;
  salon: BookingSalon;
  design: BookingDesign | null;
}) {
  const t = useTranslations("ui.booking");
  const locale = useLocale();
  const { user } = useMe();
  const pending = booking.status === "new";
  const first = user?.fullName?.split(" ")[0];
  const mapsUrl =
    salon.lat !== null && salon.lng !== null
      ? `https://www.google.com/maps/dir/?api=1&destination=${salon.lat},${salon.lng}`
      : salon.address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${salon.address} ${salon.city ?? ""}`)}`
        : null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[640px] flex-col px-6 pt-3">
      <div className="-mx-3 flex h-11 items-center justify-end">
        <CloseButton href={`/s/${salon.slug}`} />
      </div>
      <Check
        className={pending ? "text-pending mt-1 size-[34px]" : "text-success mt-1 size-[34px]"}
        strokeWidth={1.75}
        aria-hidden
      />
      <h1 className="font-display mt-3 text-[34px] leading-[1.1]">
        {pending ? t("requested") : first ? t("bookedName", { name: first }) : t("booked")}
      </h1>
      <p className="text-muted mt-1.5 text-[15px]">
        {pending ? t("requestedBody", { salon: salon.name }) : t("bookedBody", { salon: salon.name })}
      </p>
      <p className="text-muted mt-1.5 text-[13px]">
        {t("ref")}{" "}
        <b className="text-foreground font-semibold tracking-wider" dir="ltr">
          {shortRef(booking.id)}
        </b>
      </p>

      <KeyValueList
        className="mt-5"
        items={[
          { label: t("salon"), value: salon.name },
          { label: t("service"), value: booking.service?.name ?? "" },
          ...(booking.design
            ? [
                {
                  label: t("design"),
                  value: (
                    <span className="inline-flex items-center gap-[7px]">
                      <Nail
                        shape={design?.shape}
                        fill={fillForDesign({
                          category: design?.category,
                          coverUrl: booking.design.coverUrl,
                        })}
                        width={10}
                        height={14}
                      />
                      {booking.design.name}
                    </span>
                  ),
                },
              ]
            : []),
          ...(booking.staff ? [{ label: t("technician"), value: booking.staff.displayName }] : []),
          {
            label: t("when"),
            value: (
              <span dir="ltr">
                {fmtDay(booking.startsAt, locale, salon.timezone)} ·{" "}
                {fmtTimeRange(booking.startsAt, booking.endsAt, locale, salon.timezone)}
              </span>
            ),
          },
          { label: t("duration"), value: durationLabel(booking.service?.durationMin ?? 0, locale) },
          {
            label: t("price"),
            value: `${money(booking.totalPrice, booking.currency, locale)} · ${booking.depositAmount > 0 ? t("depositDue", { amount: money(booking.depositAmount, booking.currency, locale) }) : t("payAtSalon")}`,
          },
          ...(salon.address
            ? [
                {
                  label: t("address"),
                  value: [salon.address, salon.area, salon.city].filter(Boolean).join(", "),
                },
              ]
            : []),
        ]}
      />

      <div className="mt-2 flex flex-wrap items-center gap-x-7">
        <a
          href={icsFor(booking)}
          download="nailswap-booking.ics"
          className="text-accent hover:text-foreground inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium"
        >
          <CalendarPlus className="size-5" strokeWidth={1.75} />
          {t("addToCalendar")}
        </a>
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:text-foreground inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium"
          >
            <Navigation className="size-5" strokeWidth={1.75} />
            {t("directions")}
          </a>
        )}
      </div>
      <p className="text-muted mt-2 flex items-start gap-2.5 text-[13px] leading-[19px]">
        <MessageSquare className="text-accent mt-px size-[18px] shrink-0" strokeWidth={1.75} />
        <span>{t("manageSms", { phone: prettyPhone(user?.phone) })}</span>
      </p>

      <StickyAction className="mt-8">
        <ButtonLink href="/account/bookings" size="lg" className="w-full">
          {t("viewBookings")}
        </ButtonLink>
      </StickyAction>
    </div>
  );
}
