"use client";

import * as React from "react";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { PageHeader } from "@/components/shell/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Avatar, KeyValueList, Notice, StatusDot, bookingTone } from "@/components/ui/primitives";
import { Nail, fillForDesign } from "@/components/nails/nail";
import { toast } from "@/components/ui/toaster";
import { api, isApiError } from "@/lib/client/api";
import {
  durationLabel,
  fmtDateTime,
  fmtDay,
  fmtTime,
  fmtTimeRange,
  isoDate,
  money,
  prettyPhone,
  shortRef,
} from "@/lib/format";
import { zonedIso } from "../../calendar/calendar-view";

interface Detail {
  id: string;
  startsAt: string;
  endsAt: string;
  status: "new" | "confirmed" | "completed" | "no_show" | "cancelled";
  source: string;
  staffId: string;
  staffName: string;
  serviceName: string;
  durationMin: number;
  design: { name: string; category: string; coverUrl: string | null; shape: string | null } | null;
  client: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    visits: number;
    noShows: number;
    notes: string | null;
  } | null;
  clientNotes: string | null;
  staffNotes: string | null;
  cancelReason: string | null;
  servicePrice: number;
  designPrice: number;
  totalPrice: number;
  depositAmount: number;
  currency: string;
  tryonImageUrl: string | null;
  createdAt: string;
  events: { id: number; type: string; actorRole: string | null; createdAt: string }[];
}

export function BookingDetail({
  salon,
  booking: b,
  staff,
  canEdit,
}: {
  salon: { id: string; name: string; timezone: string; currency: string };
  booking: Detail;
  staff: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const t = useTranslations("bookingsPage");
  const tb = useTranslations("ui.booking");
  const td = useTranslations("ui.dash");
  const tc = useTranslations("common");
  const tcal = useTranslations("calendar");
  const locale = useLocale();
  const router = useRouter();
  const tz = salon.timezone;
  const [notes, setNotes] = React.useState(b.staffNotes ?? "");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [moveDay, setMoveDay] = React.useState(isoDate(new Date(b.startsAt), tz));
  const [moveTime, setMoveTime] = React.useState(fmtTime(b.startsAt, "en", tz));
  const [moveStaff, setMoveStaff] = React.useState(b.staffId);

  async function patch(body: Record<string, unknown>, ok?: string) {
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/api/dashboard/${salon.id}/bookings/${b.id}`, body);
      if (ok) toast.success(ok);
      router.refresh();
    } catch (err) {
      if (isApiError(err, "slot_taken") || isApiError(err, "slot_unavailable")) setError(tb("slotTaken"));
      else setError(tc("somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  const statusLabel = (s: Detail["status"]) =>
    s === "new"
      ? tb("awaitingSalon")
      : s === "confirmed"
        ? tb("confirmed")
        : s === "completed"
          ? tb("completed")
          : s === "no_show"
            ? tb("noShow")
            : tb("cancelledStatus");
  const live = b.status === "new" || b.status === "confirmed";

  return (
    <>
      <Link
        href="/dashboard/bookings"
        className="text-muted hover:text-foreground -ms-1 inline-flex min-h-11 items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4 rtl:-scale-x-100" />
        {t("title")}
      </Link>
      <PageHeader
        context={
          <span dir="ltr">
            {shortRef(b.id)} · {fmtDateTime(b.createdAt, locale, tz)}
          </span>
        }
        title={b.client?.name ?? ""}
        actions={
          <>
            <StatusDot tone={bookingTone(b.status)} className="text-[15px]">
              {statusLabel(b.status)}
            </StatusDot>
            {canEdit && b.status === "new" && (
              <>
                <Button
                  variant="danger"
                  onClick={() => patch({ status: "cancelled" }, t("decline"))}
                  disabled={busy}
                >
                  {t("decline")}
                </Button>
                <Button onClick={() => patch({ status: "confirmed" }, t("approve"))} loading={busy}>
                  {t("approve")}
                </Button>
              </>
            )}
            {b.status === "confirmed" && (
              <>
                <Button
                  variant="ghost"
                  onClick={() => patch({ status: "no_show" }, t("markNoShow"))}
                  disabled={busy}
                >
                  {t("markNoShow")}
                </Button>
                {canEdit && (
                  <Button
                    variant="danger"
                    onClick={() => patch({ status: "cancelled" }, t("cancelBooking"))}
                    disabled={busy}
                  >
                    {t("cancelBooking")}
                  </Button>
                )}
                <Button onClick={() => patch({ status: "completed" }, t("markCompleted"))} loading={busy}>
                  {t("markCompleted")}
                </Button>
              </>
            )}
          </>
        }
      />

      {error && (
        <Notice tone="danger" className="mb-6">
          {error}
        </Notice>
      )}

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <KeyValueList
            items={[
              { label: tb("service"), value: `${b.serviceName} · ${durationLabel(b.durationMin, locale)}` },
              ...(b.design
                ? [
                    {
                      label: tb("design"),
                      value: (
                        <span className="inline-flex items-center gap-[7px]">
                          <Nail
                            shape={b.design.shape}
                            fill={fillForDesign(b.design)}
                            width={10}
                            height={14}
                          />
                          {b.design.name}
                        </span>
                      ),
                    },
                  ]
                : []),
              { label: tb("technician"), value: b.staffName },
              {
                label: tb("when"),
                value: (
                  <span dir="ltr">
                    {fmtDay(b.startsAt, locale, tz)} · {fmtTimeRange(b.startsAt, b.endsAt, locale, tz)}
                  </span>
                ),
              },
              {
                label: td("source"),
                value:
                  b.source === "tryon"
                    ? td("sourceTryon")
                    : b.source === "direct"
                      ? td("sourceDirect")
                      : b.source === "rebook"
                        ? td("sourceRebook")
                        : td("sourceDashboard"),
              },
              {
                label: tb("price"),
                value: `${money(b.totalPrice, b.currency, locale)}${b.designPrice ? ` (${money(b.servicePrice, b.currency, locale)} + ${money(b.designPrice, b.currency, locale)})` : ""}`,
              },
              ...(b.depositAmount
                ? [
                    {
                      label: tb("depositDue", { amount: "" }).trim(),
                      value: money(b.depositAmount, b.currency, locale),
                    },
                  ]
                : []),
              ...(b.cancelReason ? [{ label: tb("cancelReason"), value: b.cancelReason }] : []),
            ]}
          />

          {b.tryonImageUrl && (
            <section className="mt-10">
              <h2 className="text-[15px] font-semibold">{t("lookRequested")}</h2>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={b.tryonImageUrl}
                alt={t("lookRequested")}
                className="rounded-media mt-3 max-h-80 w-auto"
              />
            </section>
          )}

          {b.clientNotes && (
            <section className="mt-10">
              <h2 className="text-[15px] font-semibold">{t("clientNotes")}</h2>
              <p className="mt-2 text-[15px] leading-6">{b.clientNotes}</p>
            </section>
          )}

          <section className="mt-10">
            <Label htmlFor="staff-notes">{t("staffNotes")}</Label>
            <Textarea
              id="staff-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
            />
            <Button
              variant="link"
              className="mt-2"
              disabled={busy || notes === (b.staffNotes ?? "")}
              onClick={() => patch({ staffNotes: notes }, tc("save"))}
            >
              {tc("save")}
            </Button>
          </section>

          {canEdit && live && (
            <section className="mt-10 max-w-[520px]">
              <h2 className="font-display text-2xl">{tb("reschedule")}</h2>
              <div className="mt-4 grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="mv-day">{tc("date")}</Label>
                  <Input
                    id="mv-day"
                    type="date"
                    dir="ltr"
                    value={moveDay}
                    onChange={(e) => setMoveDay(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="mv-time">{tc("time")}</Label>
                  <Input
                    id="mv-time"
                    type="time"
                    dir="ltr"
                    step={300}
                    value={moveTime}
                    onChange={(e) => setMoveTime(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="mv-staff">{tb("technician")}</Label>
                  <Select id="mv-staff" value={moveStaff} onChange={(e) => setMoveStaff(e.target.value)}>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <Button
                variant="link"
                className="mt-3"
                loading={busy}
                onClick={() =>
                  patch({ startsAt: zonedIso(moveDay, moveTime, tz), staffId: moveStaff }, tcal("moved"))
                }
              >
                {tb("confirmNew")}
              </Button>
            </section>
          )}

          <section className="mt-10">
            <h2 className="text-[15px] font-semibold">{t("history")}</h2>
            <ol className="mt-2">
              {b.events.map((e) => (
                <li
                  key={e.id}
                  className="border-border flex min-h-10 items-center justify-between gap-4 border-b text-sm"
                >
                  <span>
                    {e.type.replace(/_/g, " ")}
                    {e.actorRole && <span className="text-muted"> · {e.actorRole}</span>}
                  </span>
                  <span className="text-muted tabular-nums" dir="ltr">
                    {fmtDateTime(e.createdAt, locale, tz)}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {b.client && (
          <aside className="border-border lg:border-s lg:ps-8">
            <div className="flex items-center gap-4">
              <Avatar name={b.client.name} size={56} serif />
              <div className="min-w-0">
                <div className="font-display truncate text-2xl">{b.client.name}</div>
                <div className="text-muted text-[13px]">
                  {td("clientSince", { visits: b.client.visits, noShows: b.client.noShows })}
                </div>
              </div>
            </div>
            <div className="mt-5 space-y-1 text-[15px]">
              <div dir="ltr">{prettyPhone(b.client.phone)}</div>
              {b.client.email && <div>{b.client.email}</div>}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-6">
              <a
                href={`https://wa.me/${b.client.phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="text-accent hover:text-foreground inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium"
              >
                <MessageCircle className="size-5" strokeWidth={1.75} />
                {td("message")}
              </a>
              <Link
                href={`/dashboard/clients?client=${b.client.id}`}
                className="text-accent hover:text-foreground inline-flex min-h-11 items-center text-[15px] font-medium"
              >
                {td("openClient")}
              </Link>
            </div>
            {b.client.notes && (
              <div className="mt-5">
                <div className="text-muted text-[13px]">{tc("notes")}</div>
                <p className="mt-1 text-[15px] leading-6">{b.client.notes}</p>
              </div>
            )}
          </aside>
        )}
      </div>
    </>
  );
}
