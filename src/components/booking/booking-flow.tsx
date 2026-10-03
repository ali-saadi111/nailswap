"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { PhoneHeader, BackButton } from "@/components/shell/phone-header";
import { StickyAction } from "@/components/shell/consumer-shell";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Notice } from "@/components/ui/primitives";
import { NailGroup, fillForDesign } from "@/components/nails/nail";
import { PhoneOtpForm } from "@/components/auth/phone-otp-form";
import { TrackView } from "@/components/track-view";
import { SlotPicker } from "./slot-picker";
import { Confirmation } from "./confirmation";
import { api, isApiError, track } from "@/lib/client/api";
import { useMe } from "@/lib/client/use-me";
import { durationLabel, fmtDay, fmtTimeRange, money, prettyPhone } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BookingDesign, BookingSalon, BookingService, BookingStaff, BookingView, Slot } from "./types";

type Step = "service" | "time" | "details" | "done";

export function BookingFlow({
  salon,
  services,
  designs,
  staff,
  initialServiceId,
  initialDesignId,
  initialStaffId,
  initialDate,
  tryonJobId,
}: {
  salon: BookingSalon;
  services: BookingService[];
  designs: BookingDesign[];
  staff: BookingStaff[];
  initialServiceId?: string | null;
  initialDesignId?: string | null;
  initialStaffId?: string | null;
  initialDate?: string | null;
  tryonJobId?: string | null;
}) {
  const t = useTranslations("ui.booking");
  const ta = useTranslations("ui.auth");
  const locale = useLocale();
  const router = useRouter();
  const { user, refresh } = useMe();

  const design = designs.find((d) => d.id === initialDesignId) ?? null;
  const eligibleServices =
    design && design.serviceIds.length ? services.filter((s) => design.serviceIds.includes(s.id)) : services;
  const [serviceId, setServiceId] = React.useState<string | null>(
    initialServiceId && services.some((s) => s.id === initialServiceId)
      ? initialServiceId
      : eligibleServices.length === 1
        ? eligibleServices[0].id
        : null,
  );
  const service = services.find((s) => s.id === serviceId) ?? null;
  const [step, setStep] = React.useState<Step>(serviceId ? "time" : "service");
  const [staffId, setStaffId] = React.useState<string | null>(initialStaffId ?? null);
  const [slot, setSlot] = React.useState<Slot | null>(null);
  const [nameInput, setName] = React.useState<string | null>(null);
  const name = nameInput ?? user?.fullName ?? "";
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [booking, setBooking] = React.useState<BookingView | null>(null);

  const eligibleStaff = staff.filter(
    (s) => s.acceptsOnlineBooking && (!service || s.serviceIds.includes(service.id)),
  );
  const durationMin = (service?.durationMin ?? 0) + (design?.durationAddonMin ?? 0);
  const total = (service?.price ?? 0) + (design?.priceAddon ?? 0);
  const approval = salon.bookingMode === "approval";
  const title =
    design && service
      ? t("serviceDesign", { service: service.name, design: design.name })
      : (service?.name ?? "");

  async function submit() {
    if (!service || !slot) return;
    const clientName = name.trim();
    if (clientName.length < 2) {
      setError(t("name"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const b = await api.post<BookingView>("/api/bookings", {
        salonId: salon.id,
        serviceId: service.id,
        staffId: staffId ?? (slot.staffIds.length === 1 ? slot.staffIds[0] : null),
        designId: design?.id ?? null,
        tryonJobId: tryonJobId ?? null,
        startsAt: slot.startsAt,
        clientName,
        notes: notes.trim() || undefined,
        locale,
      });
      setBooking(b);
      setStep("done");
      window.scrollTo({ top: 0 });
    } catch (err) {
      if (isApiError(err, "slot_taken") || isApiError(err, "slot_unavailable")) {
        setError(t("slotTaken"));
        setSlot(null);
        setStep("time");
      } else if (isApiError(err, "slot_too_soon")) setError(t("tooSoon"));
      else if (isApiError(err, "unauthorized")) {
        await refresh();
        setError(t("signInToBook"));
      } else setError(t("generic"));
    } finally {
      setBusy(false);
    }
  }

  if (step === "done" && booking) {
    return <Confirmation booking={booking} salon={salon} design={design} />;
  }

  const stepNo = step === "service" ? 1 : step === "time" ? 2 : 3;
  const totalSteps = 3;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[640px] flex-col px-6 pt-3">
      <TrackView salonId={salon.id} designId={design?.id} payload={{ screen: "booking" }} />
      <PhoneHeader
        leading={
          step === "service" ? (
            <BackButton fallback={`/s/${salon.slug}`} />
          ) : (
            <BackButton fallback={`/s/${salon.slug}`} label={t("edit")} />
          )
        }
        trailing={
          <span className="text-muted pe-3 text-[13px]">
            {t("stepOf", { step: stepNo, total: totalSteps })}
          </span>
        }
      />

      {step === "service" && (
        <>
          <h1 className="font-display mt-2 text-[34px] leading-[1.1]">{t("chooseService")}</h1>
          {design && (
            <div className="mt-3.5 flex items-center gap-3.5">
              <NailGroup shape={design.shape} fill={fillForDesign(design)} size={11} gap={3} />
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold">{design.name}</div>
                <div className="text-muted mt-0.5 text-[13px]">
                  {design.priceAddon > 0 ? `+${money(design.priceAddon, salon.currency, locale)}` : ""}
                  {design.durationAddonMin > 0 ? ` · +${design.durationAddonMin} min` : ""}
                </div>
              </div>
            </div>
          )}
          <div className="mt-4">
            {eligibleServices.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setServiceId(s.id);
                  setStep("time");
                }}
                className="border-border hover:text-accent flex min-h-14 w-full items-center gap-3 border-b py-2 text-start"
              >
                <span className="flex-1 text-[15px]">{s.name}</span>
                <span className="text-muted text-[13px]">{durationLabel(s.durationMin, locale)}</span>
                <span className="w-14 text-end text-[15px] font-semibold">
                  {money(s.price, salon.currency, locale)}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {step === "time" && service && (
        <>
          <h1 className="font-display mt-2 text-[34px] leading-[1.1]">{t("chooseTime")}</h1>
          <div className="mt-3.5 flex items-center gap-3.5">
            {design ? (
              <NailGroup shape={design.shape} fill={fillForDesign(design)} size={11} gap={3} />
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-semibold">{title}</div>
              <div className="text-muted mt-0.5 text-[13px]">
                {salon.name} · {durationLabel(durationMin, locale)} · {money(total, salon.currency, locale)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setStep("service")}
              className="text-accent hover:text-foreground text-sm font-medium"
            >
              {t("edit")}
            </button>
          </div>
          <SlotPicker
            endpoint={`/api/salons/${salon.slug}`}
            query={{ serviceId: service.id, designId: design?.id }}
            timezone={salon.timezone}
            maxAdvanceDays={salon.maxAdvanceDays}
            staff={eligibleStaff.map((s) => ({ id: s.id, displayName: s.displayName }))}
            staffId={staffId}
            onStaffChange={(id) => {
              setStaffId(id);
              setSlot(null);
            }}
            value={slot}
            onChange={setSlot}
            initialDate={initialDate ?? undefined}
          />
          {error && (
            <Notice tone="danger" className="mt-4">
              {error}
            </Notice>
          )}
          <StickyAction
            className="mt-6"
            summary={
              slot ? (
                <>
                  <b className="text-[15px] font-semibold" dir="ltr">
                    {fmtDay(slot.startsAt, locale, salon.timezone)} ·{" "}
                    {fmtTimeRange(slot.startsAt, slot.endsAt, locale, salon.timezone)}
                  </b>
                  <span className="text-muted text-sm">
                    {t("summaryLine", {
                      duration: durationLabel(durationMin, locale),
                      price: money(total, salon.currency, locale),
                    })}
                  </span>
                </>
              ) : undefined
            }
          >
            <Button
              size="lg"
              className="w-full"
              disabled={!slot}
              onClick={() => {
                track("book_click", { salonId: salon.id, designId: design?.id });
                setStep("details");
              }}
            >
              {t("continue")}
            </Button>
          </StickyAction>
        </>
      )}

      {step === "details" && service && slot && (
        <>
          {user ? (
            <>
              <h1 className="font-display mt-2 text-[34px] leading-[1.1]">{t("yourDetails")}</h1>
              <p className="text-muted mt-2 text-[15px] leading-[22px]">
                {t("signedInAs", { name: user.fullName ?? "", phone: prettyPhone(user.phone) })}
              </p>
              <HoldLine slot={slot} salon={salon} title={title} />
              <div className="mt-6">
                <Label htmlFor="bk-name">{t("name")}</Label>
                <Input
                  id="bk-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  maxLength={80}
                />
              </div>
              <div className="mt-6">
                <Label htmlFor="bk-notes">{t("notes")}</Label>
                <Textarea
                  id="bk-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t("notesPlaceholder")}
                  maxLength={500}
                />
              </div>
              {salon.depositRequired && salon.depositAmount > 0 && (
                <Notice className="mt-4">
                  {t("depositDue", { amount: money(salon.depositAmount, salon.currency, locale) })}
                </Notice>
              )}
              {error && (
                <Notice tone="danger" className="mt-4">
                  {error}
                </Notice>
              )}
              <StickyAction className="mt-6">
                <Button size="lg" className="w-full" loading={busy} onClick={submit}>
                  {approval ? t("requestBooking") : t("confirmBooking")}
                </Button>
              </StickyAction>
            </>
          ) : (
            <>
              <h1 className="font-display mt-2 text-[34px] leading-[1.1]">{t("confirmPhone")}</h1>
              <p className="text-muted mt-2 text-[15px] leading-[22px]">{t("confirmPhoneBody")}</p>
              <PhoneOtpForm
                submitLabel={t("verifyBook")}
                hint={<HoldLine slot={slot} salon={salon} title={title} />}
                onSuccess={async () => {
                  await refresh();
                  router.refresh();
                }}
              />
              <p className="text-muted mt-3 text-center text-[12px]">
                {ta.rich("acceptTerms", {
                  terms: (c) => (
                    <a href={`/${locale}/legal/terms`} className="text-accent">
                      {c}
                    </a>
                  ),
                  privacy: (c) => (
                    <a href={`/${locale}/legal/privacy`} className="text-accent">
                      {c}
                    </a>
                  ),
                })}
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}

function HoldLine({
  slot,
  salon,
  title,
  className,
}: {
  slot: Slot;
  salon: BookingSalon;
  title: string;
  className?: string;
}) {
  const t = useTranslations("ui.booking");
  const locale = useLocale();
  return (
    <p className={cn("text-muted mt-5 flex items-start gap-2.5 text-[13px] leading-[19px]", className)}>
      <Clock className="text-accent mt-px size-[18px] shrink-0" strokeWidth={1.75} />
      <span>
        {t.rich("holding", {
          b: (c) => <b className="text-foreground font-semibold">{c}</b>,
          when: `${fmtDay(slot.startsAt, locale, salon.timezone)}, ${fmtTimeRange(slot.startsAt, slot.endsAt, locale, salon.timezone)}`,
          salon: salon.name,
          service: title,
        })}
      </span>
    </p>
  );
}
