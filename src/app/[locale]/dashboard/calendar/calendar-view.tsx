"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/shell/dashboard-shell";
import { Button, IconButton } from "@/components/ui/button";
import { Avatar, Dialog, Dot, Notice, Tabs } from "@/components/ui/primitives";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { api, isApiError } from "@/lib/client/api";
import { durationLabel, fmtLongDate, fmtTime, isoDate, minutesOfDay } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface CalBooking {
  id: string;
  startsAt: string;
  endsAt: string;
  status: "new" | "confirmed" | "completed" | "no_show" | "cancelled";
  source: string;
  staffId: string;
  clientName: string;
  serviceName: string;
  designName: string | null;
  totalPrice: number;
}

const PX_PER_MIN = 80 / 60;

function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function tone(status: CalBooking["status"]) {
  switch (status) {
    case "new":
      return { bg: "bg-pending-soft", dot: "bg-pending" };
    case "confirmed":
      return { bg: "bg-success-soft", dot: "bg-success" };
    case "completed":
      return { bg: "bg-surface-2", dot: "bg-accent" };
    case "no_show":
      return { bg: "bg-surface-2", dot: "bg-danger" };
    default:
      return { bg: "bg-surface-2", dot: "bg-muted-2" };
  }
}

export function CalendarView({
  salon,
  date,
  today,
  view,
  staff,
  staffFilter,
  bookings,
  hours,
  services,
  pendingCount,
  openNew,
  canEdit,
}: {
  salon: { id: string; name: string; timezone: string; currency: string };
  date: string;
  today: string;
  view: "day" | "week";
  staff: { id: string; name: string; color: string }[];
  staffFilter: string | null;
  bookings: CalBooking[];
  hours: { weekday: number; open_time: string | null; close_time: string | null; is_closed: boolean }[];
  services: { id: string; name: string; durationMin: number; price: number }[];
  pendingCount: number;
  openNew: boolean;
  canEdit: boolean;
}) {
  const t = useTranslations("calendar");
  const td = useTranslations("ui.dash");
  const tb = useTranslations("ui.booking");
  const tc = useTranslations("common");
  const tdash = useTranslations("dashboard");
  const locale = useLocale();
  const router = useRouter();
  const tz = salon.timezone;
  const [newOpen, setNewOpen] = React.useState(openNew);
  const [nowMin, setNowMin] = React.useState(() => minutesOfDay(new Date(), tz));
  const [search, setSearch] = React.useState("");

  // Live updates: refresh when any booking of this salon changes.
  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`cal-${salon.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `salon_id=eq.${salon.id}` },
        () => router.refresh(),
      )
      .subscribe();
    const tick = setInterval(() => setNowMin(minutesOfDay(new Date(), tz)), 60_000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(tick);
    };
  }, [salon.id, router, tz]);

  const openMin = Math.min(
    ...hours.filter((h) => !h.is_closed && h.open_time).map((h) => toMin(h.open_time!)),
    9 * 60,
  );
  const closeMin = Math.max(
    ...hours.filter((h) => !h.is_closed && h.close_time).map((h) => toMin(h.close_time!)),
    20 * 60,
  );
  const startHour = Math.floor(openMin / 60);
  const endHour = Math.ceil(closeMin / 60) + 1;
  const gridHeight = (endHour - startHour) * 60 * PX_PER_MIN;

  const visibleStaff = staffFilter ? staff.filter((s) => s.id === staffFilter) : staff;
  const dow = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
  const weekStart = addDays(date, -dow);
  const days = view === "week" ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)) : [date];

  const filtered = bookings.filter((b) => {
    if (staffFilter && b.staffId !== staffFilter) return false;
    if (
      search &&
      !`${b.clientName} ${b.serviceName} ${b.designName ?? ""}`.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  const nav = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams({ date, view, ...(staffFilter ? { staff: staffFilter } : {}) });
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    router.push(`/dashboard/calendar?${p.toString()}`);
  };

  const columns =
    view === "day"
      ? visibleStaff.map((s) => ({ key: s.id, staff: s, day: date }))
      : days.map((d) => ({ key: d, staff: null, day: d }));
  const todayCount = bookings.filter((b) => isoDate(new Date(b.startsAt), tz) === today).length;

  return (
    <>
      <PageHeader
        context={`${salon.name} · ${td("bookingsToday", { count: todayCount })}${pendingCount ? ` · ${td("pendingCount", { count: pendingCount })}` : ""}`}
        title={tdash("calendar")}
        actions={
          <>
            <label className="relative inline-flex items-center">
              <Search
                className="text-muted pointer-events-none absolute start-3.5 size-5"
                strokeWidth={1.75}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tc("search")}
                className="field h-11 w-44 ps-10 text-sm"
                aria-label={tc("search")}
              />
            </label>
            {canEdit && (
              <Button onClick={() => setNewOpen(true)}>
                <Plus className="size-5" strokeWidth={1.75} />
                {t("newBooking")}
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="-ms-3 flex items-center">
          <IconButton
            aria-label={tb("prevWeek")}
            onClick={() => nav({ date: addDays(date, view === "week" ? -7 : -1) })}
          >
            <ChevronLeft className="rtl:-scale-x-100" />
          </IconButton>
          <button
            type="button"
            onClick={() => nav({ date: today })}
            className="text-foreground hover:text-accent min-h-11 px-1 text-[15px] font-medium"
          >
            {tc("today")}
          </button>
          <IconButton
            aria-label={tb("nextWeek")}
            onClick={() => nav({ date: addDays(date, view === "week" ? 7 : 1) })}
          >
            <ChevronRight className="rtl:-scale-x-100" />
          </IconButton>
        </div>
        <h2 className="font-display text-[28px] leading-none">
          {view === "day"
            ? fmtLongDate(`${date}T12:00:00Z`, locale, "UTC")
            : `${fmtDayShort(days[0], locale)} – ${fmtDayShort(days[6], locale)}`}
        </h2>
        <div className="ms-auto flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="flex items-center gap-4 text-sm">
            <span className="inline-flex items-center gap-2">
              <Dot tone="success" />
              {tb("confirmed")}
            </span>
            <span className="inline-flex items-center gap-2">
              <Dot tone="pending" />
              {tb("awaitingSalon")}
            </span>
            <span className="inline-flex items-center gap-2">
              <Dot tone="accent" />
              {tb("completed")}
            </span>
          </span>
          <label className="relative inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium">
            {staffFilter ? staff.find((s) => s.id === staffFilter)?.name : t("allStaff")}
            <Select
              value={staffFilter ?? ""}
              onChange={(e) => nav({ staff: e.target.value || null })}
              className="absolute inset-0 h-full opacity-0"
              wrapperClassName="absolute inset-0"
              aria-label={t("allStaff")}
            >
              <option value="">{t("allStaff")}</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </label>
          <Tabs
            value={view}
            onChange={(v) => nav({ view: v })}
            items={[
              { value: "day", label: t("day") },
              { value: "week", label: t("week") },
            ]}
          />
        </div>
      </div>

      <div className="dashboard-table mt-6">
        <div
          className="min-w-[640px]"
          style={{
            display: "grid",
            gridTemplateColumns: `56px repeat(${Math.max(1, columns.length)}, minmax(160px, 1fr))`,
          }}
        >
          <div />
          {columns.map((c) => (
            <div key={c.key} className="flex items-center gap-3 px-3 pb-3">
              {c.staff ? (
                <>
                  <Avatar name={c.staff.name} size={40} />
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-semibold">{c.staff.name}</div>
                    <div className="text-muted text-[13px]">
                      {columnSummary(
                        filtered.filter(
                          (b) => b.staffId === c.staff!.id && isoDate(new Date(b.startsAt), tz) === c.day,
                        ),
                        locale,
                        td,
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className={cn("text-[15px] font-semibold", c.day === today && "text-accent")}>
                  {fmtDayShort(c.day, locale)}
                  <div className="text-muted text-[13px] font-normal">
                    {columnSummary(
                      filtered.filter((b) => isoDate(new Date(b.startsAt), tz) === c.day),
                      locale,
                      td,
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          <div className="relative" style={{ height: gridHeight }}>
            {Array.from({ length: endHour - startHour }, (_, i) => (
              <div
                key={i}
                className="text-muted absolute -translate-y-1/2 text-[13px] tabular-nums"
                style={{ top: i * 60 * PX_PER_MIN }}
                dir="ltr"
              >
                {String(startHour + i).padStart(2, "0")}:00
              </div>
            ))}
            {days.includes(today) && nowMin >= startHour * 60 && nowMin <= endHour * 60 && (
              <div
                className="text-accent absolute -translate-y-1/2 text-[13px] font-medium tabular-nums"
                style={{ top: (nowMin - startHour * 60) * PX_PER_MIN }}
                dir="ltr"
              >
                {String(Math.floor(nowMin / 60)).padStart(2, "0")}:{String(nowMin % 60).padStart(2, "0")}
              </div>
            )}
          </div>

          {columns.map((c) => {
            const items = filtered.filter(
              (b) => isoDate(new Date(b.startsAt), tz) === c.day && (!c.staff || b.staffId === c.staff.id),
            );
            const dayRow = hours.find((h) => h.weekday === new Date(`${c.day}T12:00:00Z`).getUTCDay());
            const closed = !dayRow || dayRow.is_closed;
            return (
              <div key={c.key} className="relative" style={{ height: gridHeight }}>
                {Array.from({ length: endHour - startHour }, (_, i) => (
                  <div
                    key={i}
                    className="border-border absolute inset-x-0 border-t"
                    style={{ top: i * 60 * PX_PER_MIN }}
                  />
                ))}
                {closed && <div className="bg-surface-2/60 absolute inset-0" aria-hidden />}
                {!closed && dayRow && (
                  <>
                    <div
                      className="bg-surface-2/60 absolute inset-x-0 top-0"
                      style={{ height: (toMin(dayRow.open_time!) - startHour * 60) * PX_PER_MIN }}
                    />
                    <div
                      className="bg-surface-2/60 absolute inset-x-0 bottom-0"
                      style={{ height: (endHour * 60 - toMin(dayRow.close_time!)) * PX_PER_MIN }}
                    />
                  </>
                )}
                {c.day === today && nowMin >= startHour * 60 && nowMin <= endHour * 60 && (
                  <div
                    className="bg-accent absolute inset-x-0 z-10 h-px"
                    style={{ top: (nowMin - startHour * 60) * PX_PER_MIN }}
                  />
                )}
                {items.map((b) => {
                  const s = minutesOfDay(b.startsAt, tz);
                  const e = Math.max(s + 20, minutesOfDay(b.endsAt, tz));
                  const top = (s - startHour * 60) * PX_PER_MIN;
                  const height = (e - s) * PX_PER_MIN - 2;
                  const tn = tone(b.status);
                  const compact = height < 44;
                  return (
                    <Link
                      key={b.id}
                      href={`/dashboard/bookings/${b.id}`}
                      className={cn("cal-block inset-x-1 hover:brightness-95", tn.bg)}
                      style={{ top, height }}
                      title={`${b.clientName} · ${b.serviceName}`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className={cn("size-[7px] shrink-0 rounded-full", tn.dot)} />
                        <b className="truncate font-semibold">{b.clientName}</b>
                        <span className="text-muted shrink-0 tabular-nums" dir="ltr">
                          {fmtTime(b.startsAt, locale, tz)}–{fmtTime(b.endsAt, locale, tz)}
                        </span>
                      </div>
                      {!compact && (
                        <div className="truncate">
                          {b.serviceName}
                          {b.designName ? ` · ${b.designName}` : ""}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {canEdit && (
        <NewBookingDialog
          key={date}
          open={newOpen}
          onClose={() => setNewOpen(false)}
          salon={salon}
          staff={staff}
          services={services}
          date={date}
          onCreated={() => router.refresh()}
        />
      )}
    </>
  );
}

function toMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function fmtDayShort(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

function columnSummary(items: CalBooking[], locale: string, td: ReturnType<typeof useTranslations>) {
  const mins = items.reduce(
    (s, b) => s + (new Date(b.endsAt).getTime() - new Date(b.startsAt).getTime()) / 60000,
    0,
  );
  return `${td("bookingsCount", { count: items.length })} · ${durationLabel(Math.round(mins), locale)}`;
}

export function NewBookingDialog({
  open,
  onClose,
  salon,
  staff,
  services,
  date,
  onCreated,
  clientDefaults,
}: {
  open: boolean;
  onClose: () => void;
  salon: { id: string; timezone: string; currency: string };
  staff: { id: string; name: string }[];
  services: { id: string; name: string; durationMin: number; price: number }[];
  date: string;
  onCreated: () => void;
  clientDefaults?: { name: string; phone: string };
}) {
  const t = useTranslations("calendar");
  const tb = useTranslations("ui.booking");
  const tc = useTranslations("common");
  const td = useTranslations("ui.dash");
  const locale = useLocale();
  const [clientName, setClientName] = React.useState(clientDefaults?.name ?? "");
  const [phone, setPhone] = React.useState(clientDefaults?.phone ?? "");
  const [serviceId, setServiceId] = React.useState(services[0]?.id ?? "");
  const [staffId, setStaffId] = React.useState(staff[0]?.id ?? "");
  const [day, setDay] = React.useState(date);
  const [time, setTime] = React.useState("10:00");
  const [notes, setNotes] = React.useState("");
  const [silent, setSilent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const startsAt = zonedIso(day, time, salon.timezone);
      await api.post(`/api/dashboard/${salon.id}/bookings`, {
        serviceId,
        staffId: staffId || null,
        startsAt,
        clientName: clientName.trim(),
        clientPhone: phone.trim(),
        notes: notes.trim() || undefined,
        locale,
        silent,
      });
      onCreated();
      onClose();
    } catch (err) {
      if (isApiError(err, "slot_taken") || isApiError(err, "slot_unavailable")) setError(t("moveFailed"));
      else if (isApiError(err, "invalid_phone") || isApiError(err, "validation")) setError(tb("name"));
      else setError(tc("somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  const service = services.find((s) => s.id === serviceId);

  return (
    <Dialog open={open} onClose={onClose} title={t("newBooking")} description={t("walkIn")}>
      <form onSubmit={submit} className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <Label htmlFor="nb-name">{tb("name")}</Label>
            <Input
              id="nb-name"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              required
              minLength={2}
            />
          </div>
          <div>
            <Label htmlFor="nb-phone">{tc("phone")}</Label>
            <Input
              id="nb-phone"
              type="tel"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="nb-service">{tb("service")}</Label>
            <Select id="nb-service" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {durationLabel(s.durationMin, locale)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="nb-staff">{tb("technician")}</Label>
            <Select id="nb-staff" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value="">{t("allStaff")}</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="nb-day">{tc("date")}</Label>
            <Input id="nb-day" type="date" value={day} onChange={(e) => setDay(e.target.value)} dir="ltr" />
          </div>
          <div>
            <Label htmlFor="nb-time">{tc("time")}</Label>
            <Input
              id="nb-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              dir="ltr"
              step={300}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="nb-notes">{tc("notes")}</Label>
          <Textarea
            id="nb-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-14"
          />
        </div>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={silent}
            onChange={(e) => setSilent(e.target.checked)}
            className="size-[18px]"
          />
          {td("silentBooking")}
        </label>
        {error && <Notice tone="danger">{error}</Notice>}
        <div className="flex items-center justify-between">
          <span className="text-muted text-sm">
            {service
              ? `${durationLabel(service.durationMin, locale)} · ${service.price} ${salon.currency}`
              : ""}
          </span>
          <Button type="submit" loading={busy}>
            {tc("create")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Local salon time → ISO instant (DST-safe via Intl round trip). */
export function zonedIso(date: string, time: string, tz: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(guess));
  const get = (k: string) => Number(parts.find((p) => p.type === k)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"));
  return new Date(guess - (asUtc - guess)).toISOString();
}
