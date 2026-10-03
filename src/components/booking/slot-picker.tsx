"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { FilterToggle } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { fmtDay, fmtTime, isoDate, minutesOfDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DayAvailability, Slot } from "./types";

export interface SlotPickerProps {
  /** Endpoint prefix: `/api/salons/{slug}` or `/api/bookings/manage/{token}`. */
  endpoint: string;
  /** Query params added to both availability and slots requests (serviceId, designId). */
  query: Record<string, string | undefined>;
  timezone: string;
  maxAdvanceDays: number;
  staff: { id: string; displayName: string }[];
  staffId: string | null;
  onStaffChange: (id: string | null) => void;
  value: Slot | null;
  onChange: (slot: Slot | null) => void;
  initialDate?: string;
  showStaff?: boolean;
}

function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function startOfWeek(date: string) {
  // Weeks start on Monday.
  const d = new Date(`${date}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  return addDays(date, -day);
}

/**
 * Week strip (selected day = filled cocoa circle) + times grouped Morning / Afternoon / Evening
 * (selected = cocoa pill, unavailable = struck-through). Fetches availability for the visible
 * fortnight and the slots of the selected day.
 */
export function SlotPicker(props: SlotPickerProps) {
  const {
    endpoint,
    query,
    timezone,
    staff,
    staffId,
    onStaffChange,
    value,
    onChange,
    showStaff = true,
  } = props;
  const t = useTranslations("ui.booking");
  const tc = useTranslations("common");
  const locale = useLocale();
  const today = React.useMemo(() => isoDate(new Date(), timezone), [timezone]);
  const [date, setDate] = React.useState(props.initialDate ?? today);
  const [weekStart, setWeekStart] = React.useState(() => startOfWeek(props.initialDate ?? today));
  const [days, setDays] = React.useState<Record<string, DayAvailability>>({});
  const [slotStore, setSlotStore] = React.useState<{ key: string; slots: Slot[] } | null>(null);
  const lastDay = addDays(today, Math.max(1, props.maxAdvanceDays));

  const qs = React.useCallback(
    (extra: Record<string, string | undefined>) => {
      const p = new URLSearchParams();
      for (const [k, v] of Object.entries({ ...query, ...extra })) if (v) p.set(k, v);
      if (staffId) p.set("staffId", staffId);
      return p.toString();
    },
    [query, staffId],
  );

  // Availability for the visible week and the one after it.
  React.useEffect(() => {
    let cancelled = false;
    const from = weekStart < today ? today : weekStart;
    api
      .get<{ days: DayAvailability[] }>(`${endpoint}/availability?${qs({ from, days: "14" })}`)
      .then((r) => {
        if (cancelled) return;
        setDays((prev) => {
          const next = { ...prev };
          for (const d of r.days) next[d.date] = d;
          return next;
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [endpoint, qs, weekStart, today]);

  // Slots for the selected day (keyed so a stale response never shows for a new day).
  const slotKey = `${endpoint}|${qs({ date })}`;
  React.useEffect(() => {
    let cancelled = false;
    api
      .get<{ slots: Slot[] }>(`${endpoint}/slots?${qs({ date })}`)
      .then((r) => {
        if (cancelled) return;
        setSlotStore({ key: slotKey, slots: r.slots });
        if (value && !r.slots.some((s) => s.startsAt === value.startsAt)) onChange(null);
      })
      .catch(() => !cancelled && setSlotStore({ key: slotKey, slots: [] }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotKey]);
  const slots = slotStore?.key === slotKey ? slotStore.slots : null;
  const loadingSlots = slots === null;

  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${week[0]}T00:00:00Z`));
  const rangeLabel = `${new Date(`${week[0]}T00:00:00Z`).getUTCDate()}–${new Date(`${week[6]}T00:00:00Z`).getUTCDate()} ${new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(new Date(`${week[6]}T00:00:00Z`))}`;

  const groups = React.useMemo(() => {
    const g: Record<"morning" | "afternoon" | "evening", Slot[]> = {
      morning: [],
      afternoon: [],
      evening: [],
    };
    for (const s of slots ?? []) {
      const m = minutesOfDay(s.startsAt, timezone);
      if (m < 12 * 60) g.morning.push(s);
      else if (m < 17 * 60) g.afternoon.push(s);
      else g.evening.push(s);
    }
    return g;
  }, [slots, timezone]);

  const nextAvailable = Object.values(days)
    .filter((d) => d.count > 0 && d.date > date)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  return (
    <div>
      {showStaff && staff.length > 0 && (
        <div
          role="radiogroup"
          aria-label={t("with")}
          className="no-scrollbar mt-3 flex items-center gap-4 overflow-x-auto"
        >
          <span className="text-muted w-10 shrink-0 text-[13px]">{t("with")}</span>
          <FilterToggle role="radio" pressed={staffId === null} onClick={() => onStaffChange(null)}>
            {t("any")}
          </FilterToggle>
          {staff.map((s) => (
            <FilterToggle
              key={s.id}
              role="radio"
              pressed={staffId === s.id}
              onClick={() => onStaffChange(s.id)}
            >
              {s.displayName.split(" ")[0]}
            </FilterToggle>
          ))}
        </div>
      )}

      <div className="-me-3 mt-4 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold">
          {monthLabel} <span className="text-muted text-sm font-normal">· {rangeLabel}</span>
        </h2>
        <div className="flex">
          <button
            type="button"
            aria-label={t("prevWeek")}
            disabled={weekStart <= startOfWeek(today)}
            onClick={() => setWeekStart((w) => addDays(w, -7))}
            className="text-foreground hover:text-accent inline-flex size-11 items-center justify-center disabled:opacity-30"
          >
            <ChevronLeft className="size-5 rtl:-scale-x-100" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            aria-label={t("nextWeek")}
            disabled={addDays(weekStart, 7) > lastDay}
            onClick={() => setWeekStart((w) => addDays(w, 7))}
            className="text-foreground hover:text-accent inline-flex size-11 items-center justify-center disabled:opacity-30"
          >
            <ChevronRight className="size-5 rtl:-scale-x-100" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <div role="radiogroup" aria-label={t("dayLabel")} className="-mx-1.5 mt-1 grid grid-cols-7">
        {week.map((d) => {
          const info = days[d];
          const past = d < today;
          const beyond = d > lastDay;
          const closed = past || beyond || (info !== undefined && info.count === 0);
          const selected = d === date;
          const dt = new Date(`${d}T00:00:00Z`);
          return (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-disabled={closed}
              disabled={past || beyond}
              onClick={() => !closed && setDate(d)}
              className="flex h-[70px] flex-col items-center gap-1.5 bg-transparent"
            >
              <span
                className={cn(
                  "text-xs font-medium",
                  selected ? "text-accent" : closed ? "text-muted-2" : "text-muted",
                )}
              >
                {new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(dt)}
              </span>
              <span
                className={cn(
                  "inline-flex size-10 items-center justify-center rounded-full text-base font-medium",
                  selected
                    ? "bg-accent text-accent-contrast"
                    : closed
                      ? "text-muted-2 line-through"
                      : "text-foreground",
                )}
              >
                {dt.getUTCDate()}
              </span>
            </button>
          );
        })}
      </div>

      <div className="text-muted mt-5 text-[13px]">
        {fmtDay(`${date}T12:00:00Z`, locale, "UTC")}
        {staffId && staff.find((s) => s.id === staffId)
          ? ` · ${t("with").toLowerCase()} ${staff.find((s) => s.id === staffId)!.displayName}`
          : ""}
      </div>

      {loadingSlots && <div className="text-muted mt-3 text-sm">{tc("loading")}</div>}
      {!loadingSlots && slots && slots.length === 0 && (
        <div className="text-muted mt-3 text-sm">
          {t("noSlots")}
          {nextAvailable && (
            <>
              {" "}
              <button
                type="button"
                onClick={() => {
                  setDate(nextAvailable.date);
                  setWeekStart(startOfWeek(nextAvailable.date));
                }}
                className="text-accent hover:text-foreground font-medium"
              >
                {t("nextAvailable", { date: fmtDay(`${nextAvailable.date}T12:00:00Z`, locale, "UTC") })}
              </button>
            </>
          )}
        </div>
      )}

      {!loadingSlots && slots && slots.length > 0 && (
        <div className="-me-2 mt-1.5 flex flex-col gap-1.5">
          {(["morning", "afternoon", "evening"] as const).map((key) =>
            groups[key].length ? (
              <div key={key} className="flex items-center">
                <span className="text-muted w-[88px] shrink-0 text-sm">{t(key)}</span>
                <div className="grid flex-1 grid-cols-4 gap-1.5">
                  {groups[key].map((s) => {
                    const sel = value?.startsAt === s.startsAt;
                    return (
                      <button
                        key={s.startsAt}
                        type="button"
                        aria-pressed={sel}
                        onClick={() => onChange(sel ? null : s)}
                        className={cn(
                          "h-11 rounded-full text-[15px] font-medium tabular-nums transition-colors",
                          sel ? "bg-accent text-accent-contrast" : "text-foreground hover:text-accent",
                        )}
                        dir="ltr"
                      >
                        {fmtTime(s.startsAt, locale, timezone)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}
