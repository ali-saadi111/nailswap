"use client";

import * as React from "react";
import { Lock, MessageCircle, Navigation } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Wordmark } from "@/components/shell/wordmark";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog, Notice, StatusDot, Tabs, bookingTone } from "@/components/ui/primitives";
import { Textarea, Label } from "@/components/ui/input";
import { Nail, fillForDesign } from "@/components/nails/nail";
import { SlotPicker } from "@/components/booking/slot-picker";
import type { BookingView, Slot } from "@/components/booking/types";
import { api, isApiError } from "@/lib/client/api";
import { fmtDateTime, fmtDay, fmtTimeRange, shortRef } from "@/lib/format";

type Tab = "reschedule" | "cancel";

export function ManageBooking({
  token,
  initial,
  clientName,
  salonExtra,
}: {
  token: string;
  initial: BookingView;
  clientName: string | null;
  salonExtra: { area: string | null; lat: number | null; lng: number | null; maxAdvanceDays: number };
}) {
  const t = useTranslations("ui.booking");
  const locale = useLocale();
  const [booking, setBooking] = React.useState(initial);
  const [tab, setTab] = React.useState<Tab>("reschedule");
  const [slot, setSlot] = React.useState<Slot | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");

  const salon = booking.salon!;
  const tz = salon.timezone;
  const first = clientName?.split(" ")[0];
  const live = booking.status === "new" || booking.status === "confirmed";
  const cutoffAt = new Date(new Date(booking.startsAt).getTime() - salon.cancelCutoffHours * 3_600_000);
  const title = booking.design
    ? t("serviceDesign", { service: booking.service?.name ?? "", design: booking.design.name })
    : (booking.service?.name ?? "");
  const mapsUrl =
    salonExtra.lat !== null && salonExtra.lng !== null
      ? `https://www.google.com/maps/dir/?api=1&destination=${salonExtra.lat},${salonExtra.lng}`
      : salon.address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${salon.address} ${salon.city ?? ""}`)}`
        : null;

  async function reschedule() {
    if (!slot) return;
    setBusy(true);
    setError(null);
    try {
      const b = await api.post<BookingView>(`/api/bookings/manage/${token}/reschedule`, {
        startsAt: slot.startsAt,
      });
      setBooking({ ...booking, ...b });
      setSlot(null);
      setNotice(t("rescheduled", { when: fmtDateTime(b.startsAt, locale, tz) }));
    } catch (err) {
      if (isApiError(err, "slot_taken") || isApiError(err, "slot_unavailable")) setError(t("slotTaken"));
      else if (isApiError(err, "cutoff_passed") || isApiError(err, "booking_not_changeable"))
        setError(t("cutoffPassed"));
      else setError(t("generic"));
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      const b = await api.post<BookingView>(`/api/bookings/manage/${token}/cancel`, {
        reason: reason.trim() || undefined,
      });
      setBooking({ ...booking, ...b, canCancel: false, canReschedule: false });
      setCancelOpen(false);
      setNotice(t("cancelled"));
    } catch (err) {
      if (isApiError(err, "cutoff_passed") || isApiError(err, "booking_not_changeable"))
        setError(t("cutoffPassed"));
      else setError(t("generic"));
    } finally {
      setBusy(false);
    }
  }

  const statusLabel =
    booking.status === "new"
      ? t("awaitingSalon")
      : booking.status === "confirmed"
        ? t("confirmed")
        : booking.status === "completed"
          ? t("completed")
          : booking.status === "no_show"
            ? t("noShow")
            : t("cancelledStatus");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[640px] flex-col px-6 pt-3 pb-10">
      <header className="flex h-11 items-center justify-between">
        <Wordmark />
        <span className="text-muted inline-flex items-center gap-1.5 text-[12px]" dir="ltr">
          <Lock className="size-[13px]" strokeWidth={2} />
          nailswap.app/b/{token.slice(0, 5)}-…
        </span>
      </header>
      <h1 className="font-display mt-3 text-[30px] leading-[1.1]">
        {first ? t("hiBooking", { name: first }) : t("yourBooking")}
      </h1>
      <p className="text-muted mt-1.5 text-[13px]">{t("openedFromSms")}</p>

      <div className="mt-5 flex items-center justify-between">
        <StatusDot tone={bookingTone(booking.status)}>{statusLabel}</StatusDot>
        <span className="text-muted text-[12px] tracking-wider" dir="ltr">
          {shortRef(booking.id)}
        </span>
      </div>

      <div className="mt-2.5 flex items-start gap-3.5">
        {booking.design && (
          <span className="mt-1 inline-flex items-end gap-[3px]">
            <Nail fill={fillForDesign({ coverUrl: booking.design.coverUrl })} width={10} height={14} />
            <Nail fill={fillForDesign({ coverUrl: booking.design.coverUrl })} width={10} height={17} />
            <Nail fill={fillForDesign({ coverUrl: booking.design.coverUrl })} width={10} height={14} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold">{title}</div>
          <div className="mt-0.5 text-sm" dir="ltr">
            {fmtDay(booking.startsAt, locale, tz)} ·{" "}
            {fmtTimeRange(booking.startsAt, booking.endsAt, locale, tz)}
            {booking.staff ? ` · ${booking.staff.displayName}` : ""}
          </div>
          <div className="text-muted mt-0.5 text-[13px]">
            {salon.name}
            {salon.address ? ` · ${salon.address}` : salonExtra.area ? ` · ${salonExtra.area}` : ""}
          </div>
        </div>
      </div>

      {notice && (
        <Notice tone="success" className="mt-4">
          {notice}
        </Notice>
      )}
      {error && (
        <Notice tone="danger" className="mt-4">
          {error}
        </Notice>
      )}

      {live && (booking.canReschedule || booking.canCancel) ? (
        <>
          <Tabs
            className="mt-3"
            value={tab}
            onChange={setTab}
            items={[
              { value: "reschedule", label: t("reschedule") },
              { value: "cancel", label: t("cancel") },
            ]}
          />
          {tab === "reschedule" &&
            (booking.canReschedule ? (
              <>
                <div className="text-muted mt-3.5 text-[13px]">{t("pickNew")}</div>
                <SlotPicker
                  endpoint={`/api/bookings/manage/${token}`}
                  query={{}}
                  timezone={tz}
                  maxAdvanceDays={salonExtra.maxAdvanceDays}
                  staff={[]}
                  staffId={null}
                  onStaffChange={() => undefined}
                  value={slot}
                  onChange={setSlot}
                  showStaff={false}
                />
                <Button
                  size="lg"
                  className="mt-3.5 w-full"
                  disabled={!slot}
                  loading={busy}
                  onClick={reschedule}
                >
                  {t("confirmNew")}
                </Button>
                <p className="text-muted mt-3.5 text-[13px] leading-[19px]">
                  {t("reschedulePolicy", {
                    until: fmtDateTime(
                      new Date(
                        new Date(booking.startsAt).getTime() - salon.rescheduleCutoffHours * 3_600_000,
                      ),
                      locale,
                      tz,
                    ),
                    hours: salon.rescheduleCutoffHours,
                  })}
                </p>
              </>
            ) : (
              <Notice className="mt-4">{t("cutoffPassed")}</Notice>
            ))}
          {tab === "cancel" &&
            (booking.canCancel ? (
              <>
                <p className="text-muted mt-4 text-[13px] leading-[19px]">
                  {t("cancelPolicy", {
                    until: fmtDateTime(cutoffAt, locale, tz),
                    hours: salon.cancelCutoffHours,
                    salon: salon.name,
                  })}
                </p>
                <Button
                  variant="danger"
                  size="lg"
                  className="mt-2 self-start"
                  onClick={() => setCancelOpen(true)}
                >
                  {t("cancelBooking")}
                </Button>
              </>
            ) : (
              <Notice className="mt-4">{t("cutoffPassed")}</Notice>
            ))}
        </>
      ) : live ? (
        <Notice className="mt-5">{t("cutoffPassed")}</Notice>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-x-7">
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
        {(salon.whatsappNumber ?? salon.phone) && (
          <a
            href={`https://wa.me/${(salon.whatsappNumber ?? salon.phone)!.replace(/\D/g, "")}`}
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:text-foreground inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium"
          >
            <MessageCircle className="size-5" strokeWidth={1.75} />
            {t("whatsapp")}
          </a>
        )}
        {booking.status === "completed" && (
          <Link
            href={`/b/${token}/review`}
            className="text-accent hover:text-foreground inline-flex min-h-11 items-center text-[15px] font-medium"
          >
            {t("leaveReview")}
          </Link>
        )}
        {(booking.status === "completed" || booking.status === "cancelled") && (
          <ButtonLink
            href={`/s/${salon.slug}/book?serviceId=${booking.service?.id ?? ""}${booking.design ? `&designId=${booking.design.id}` : ""}`}
            variant="link"
            size="lg"
          >
            {t("rebook")}
          </ButtonLink>
        )}
      </div>

      <Dialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title={t("cancelConfirm")}
        sheet
        size="sm"
      >
        <Label htmlFor="cancel-reason">{t("cancelReason")}</Label>
        <Textarea
          id="cancel-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={300}
        />
        <div className="mt-6 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setCancelOpen(false)}>
            {t("keep")}
          </Button>
          <Button size="md" loading={busy} onClick={cancel} className="bg-danger hover:bg-danger">
            {t("cancelBooking")}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
