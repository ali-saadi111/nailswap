"use client";

import * as React from "react";
import { MoreHorizontal, Plus, Star, Upload } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/shell/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Avatar, Dialog, Kpi, Notice, StatusDot, Switch, SwitchRow } from "@/components/ui/primitives-switch";
import { Input, Label, Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { api } from "@/lib/client/api";
import { STAFF_COLORS, uploadMedia } from "@/lib/client/dashboard";
import { durationLabel, pct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { InviteDialog } from "../settings/settings-form";

export interface StaffMember {
  id: string;
  name: string;
  bio: string | null;
  color: string;
  avatarUrl: string | null;
  acceptsOnline: boolean;
  isActive: boolean;
  userId: string | null;
  role: string | null;
  serviceIds: string[];
  rules: { id: string; weekday: number; kind: "work" | "break"; start: string; end: string }[];
  bookedMin: number;
  scheduledMin: number;
  rating: number | null;
  reviewCount: number;
}

const WEEK = [1, 2, 3, 4, 5, 6, 0];

export function StaffView({
  salon,
  staff,
  services,
  totals,
  seats,
  owner,
  weekStart,
}: {
  salon: { id: string; name: string; timezone: string };
  staff: StaffMember[];
  services: { id: string; name: string }[];
  totals: {
    bookedMin: number;
    scheduledMin: number;
    rating: number | null;
    reviewCount: number;
    fromTryon: number | null;
  };
  seats: number;
  owner: boolean;
  weekStart: string;
}) {
  const t = useTranslations("staffPage");
  const td = useTranslations("ui.dash");
  const tc = useTranslations("common");
  const tdash = useTranslations("dashboard");
  const tset = useTranslations("settings");
  const locale = useLocale();
  const [editing, setEditing] = React.useState<string | null | "new">(null);
  const [inviteFor, setInviteFor] = React.useState<string | null>(null);
  const active = staff.filter((s) => s.isActive);
  const days = WEEK.map((wd, i) => {
    const d = new Date(`${weekStart}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return {
      wd,
      label: new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", timeZone: "UTC" }).format(d),
    };
  });
  const letters = WEEK.map((wd) =>
    new Intl.DateTimeFormat(locale, { weekday: "narrow" }).format(new Date(Date.UTC(2024, 0, 7 + wd))),
  );

  return (
    <>
      <PageHeader
        context={`${salon.name} · ${td("people", { count: active.length })}`}
        title={tdash("staff")}
        actions={
          <>
            <Link
              href="/dashboard/settings#team"
              className="text-accent hover:text-foreground text-[15px] font-medium"
            >
              {td("rolesPermissions")}
            </Link>
            <Button onClick={() => setEditing("new")}>
              <Plus className="size-5" strokeWidth={1.75} />
              {t("newStaff")}
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap gap-3">
        <Kpi
          value={durationLabel(totals.bookedMin, locale)}
          label={td("bookedThisWeek")}
          hint={td("ofScheduled", { hours: durationLabel(totals.scheduledMin, locale) })}
          deltaTone="muted"
        />
        <Kpi
          value={totals.rating ? totals.rating.toFixed(1) : "–"}
          label={td("avgRating")}
          hint={td("fromReviews", { count: totals.reviewCount })}
          deltaTone="muted"
        />
        <Kpi
          value={totals.fromTryon !== null ? pct(totals.fromTryon, locale) : "–"}
          label={td("bookingsFromTryon")}
        />
      </div>
      <p className="text-muted mt-4 text-[13px]">
        {t("seatsUsed", { used: staff.filter((s) => s.userId).length, seats })}
      </p>

      <div className="dashboard-table mt-8">
        <div className="min-w-[900px]">
          <div className="table-head grid-cols-[minmax(200px,1.3fr)_180px_minmax(160px,1.2fr)_150px_90px_110px_44px]">
            <span>{td("member")}</span>
            <span>{td("workingDays")}</span>
            <span>{tdash("services")}</span>
            <span>{td("thisWeek")}</span>
            <span>{td("rating")}</span>
            <span>{tc("status")}</span>
            <span />
          </div>
          {staff.map((s) => {
            const workDays = new Set(s.rules.filter((r) => r.kind === "work").map((r) => r.weekday));
            const util = s.scheduledMin ? Math.min(1, s.bookedMin / s.scheduledMin) : null;
            return (
              <div
                key={s.id}
                className="data-row h-auto min-h-[88px] grid-cols-[minmax(200px,1.3fr)_180px_minmax(160px,1.2fr)_150px_90px_110px_44px] py-3"
              >
                <button
                  type="button"
                  onClick={() => setEditing(s.id)}
                  className="flex items-center gap-4 text-start"
                >
                  <Avatar name={s.name} src={s.avatarUrl} size={52} />
                  <span className="min-w-0">
                    <span className="block truncate text-[17px] font-semibold">{s.name}</span>
                    <span className="text-muted block truncate text-[13px]">
                      {s.bio ??
                        (s.role
                          ? tset(`role${s.role.charAt(0).toUpperCase()}${s.role.slice(1)}` as never)
                          : td("notInvited"))}
                    </span>
                  </span>
                </button>
                <span className="flex gap-2 text-[15px]" dir="ltr">
                  {WEEK.map((wd, i) => (
                    <span
                      key={wd}
                      className={cn("w-4 text-center", workDays.has(wd) ? "font-semibold" : "text-muted-2")}
                    >
                      {letters[i]}
                    </span>
                  ))}
                </span>
                <span className="text-muted truncate text-[15px]">
                  {services
                    .filter((x) => s.serviceIds.includes(x.id))
                    .map((x) => x.name)
                    .join(", ") || "–"}
                </span>
                <span className="text-[15px] tabular-nums">
                  {durationLabel(s.bookedMin, locale)} / {durationLabel(s.scheduledMin, locale)}
                  {util !== null && <span className="text-muted"> · {pct(util, locale)}</span>}
                </span>
                <span className="inline-flex items-center gap-1 text-[15px]">
                  <Star className="text-accent size-4 fill-current" strokeWidth={1.5} />
                  {s.rating ? s.rating.toFixed(1) : td("newLabel")}
                </span>
                <StatusDot tone={s.isActive ? (s.acceptsOnline ? "success" : "pending") : "hollow"}>
                  {!s.isActive ? td("inactive") : s.acceptsOnline ? td("activeLabel") : td("offline")}
                </StatusDot>
                <button
                  type="button"
                  aria-label={tc("actions")}
                  onClick={() => setEditing(s.id)}
                  className="text-foreground hover:text-accent inline-flex size-11 items-center justify-center"
                >
                  <MoreHorizontal className="size-5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <section className="dashboard-card mt-14">
        <div className="flex flex-wrap items-end justify-between gap-y-2">
          <h2 className="font-display text-[28px] leading-none">
            {td("weekHours")}{" "}
            <span className="text-muted font-sans text-[15px]">
              {days[0].label} – {days[6].label}
            </span>
          </h2>
        </div>
        <div className="dashboard-table mt-4">
          <div className="min-w-[800px]">
            <div className="table-head grid-cols-[180px_repeat(7,1fr)]">
              <span />
              {days.map((d) => (
                <span key={d.wd}>{d.label}</span>
              ))}
            </div>
            {active.map((s) => (
              <div key={s.id} className="data-row h-14 grid-cols-[180px_repeat(7,1fr)]">
                <span className="truncate text-[15px]">{s.name}</span>
                {WEEK.map((wd) => {
                  const work = s.rules.filter((r) => r.weekday === wd && r.kind === "work");
                  return (
                    <span
                      key={wd}
                      className={cn("text-[15px] tabular-nums", work.length ? "" : "text-muted")}
                      dir="ltr"
                    >
                      {work.length
                        ? work
                            .map((r) => `${r.start.replace(/:00$/, "")}–${r.end.replace(/:00$/, "")}`)
                            .join(", ")
                        : td("off")}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </section>

      {editing && (
        <StaffEditor
          key={editing}
          salon={salon}
          member={editing === "new" ? null : (staff.find((s) => s.id === editing) ?? null)}
          services={services}
          owner={owner}
          onClose={() => setEditing(null)}
          onInvite={(id) => setInviteFor(id)}
        />
      )}
      {inviteFor && (
        <InviteDialog
          open
          onClose={() => setInviteFor(null)}
          salonId={salon.id}
          staffId={inviteFor}
          onDone={() => undefined}
        />
      )}
    </>
  );
}

function StaffEditor({
  salon,
  member,
  services,
  owner,
  onClose,
  onInvite,
}: {
  salon: { id: string };
  member: StaffMember | null;
  services: { id: string; name: string }[];
  owner: boolean;
  onClose: () => void;
  onInvite: (staffId: string) => void;
}) {
  const t = useTranslations("staffPage");
  const td = useTranslations("ui.dash");
  const tc = useTranslations("common");
  const tdash = useTranslations("dashboard");
  const tset = useTranslations("settings");
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [f, setF] = React.useState({
    name: member?.name ?? "",
    bio: member?.bio ?? "",
    color: member?.color ?? STAFF_COLORS[0],
    acceptsOnline: member?.acceptsOnline ?? true,
    isActive: member?.isActive ?? true,
    avatarPath: null as string | null,
    avatarUrl: member?.avatarUrl ?? null,
    serviceIds: member?.serviceIds ?? services.map((s) => s.id),
    schedule: WEEK.map((wd) => {
      const w = member?.rules.find((r) => r.weekday === wd && r.kind === "work");
      const b = member?.rules.find((r) => r.weekday === wd && r.kind === "break");
      return {
        weekday: wd,
        on: Boolean(w) || (!member && wd !== 1),
        start: w?.start ?? "10:00",
        end: w?.end ?? "19:00",
        breakStart: b?.start ?? "",
        breakEnd: b?.end ?? "",
      };
    }),
  });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((c) => ({ ...c, [k]: v }));

  async function save() {
    if (f.name.trim().length < 2) return setError(t("displayName"));
    setBusy(true);
    setError(null);
    try {
      const row = {
        salon_id: salon.id,
        display_name: f.name.trim(),
        bio: f.bio.trim() || null,
        color: f.color,
        accepts_online_booking: f.acceptsOnline,
        is_active: f.isActive,
        ...(f.avatarPath ? { avatar_path: f.avatarPath } : {}),
      };
      let id = member?.id;
      if (id) {
        const { error: e } = await supabase.from("staff").update(row).eq("id", id);
        if (e) throw e;
      } else {
        const { data, error: e } = await supabase.from("staff").insert(row).select("id").single();
        if (e) throw e;
        id = data.id;
      }
      await supabase.from("staff_services").delete().eq("staff_id", id);
      if (f.serviceIds.length)
        await supabase
          .from("staff_services")
          .insert(f.serviceIds.map((service_id) => ({ staff_id: id!, service_id })));
      await supabase.from("staff_schedule_rules").delete().eq("staff_id", id);
      const rules = f.schedule.flatMap((d) =>
        d.on
          ? [
              {
                staff_id: id!,
                weekday: d.weekday,
                kind: "work" as const,
                start_time: d.start,
                end_time: d.end,
              },
              ...(d.breakStart && d.breakEnd
                ? [
                    {
                      staff_id: id!,
                      weekday: d.weekday,
                      kind: "break" as const,
                      start_time: d.breakStart,
                      end_time: d.breakEnd,
                    },
                  ]
                : []),
            ]
          : [],
      );
      if (rules.length) {
        const { error: e } = await supabase.from("staff_schedule_rules").insert(rules);
        if (e) throw e;
      }
      toast.success(tc("save"));
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : tc("somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  async function removeMember() {
    if (!member?.userId || !confirm(tc("remove") + "?")) return;
    await api
      .del(`/api/dashboard/${salon.id}/members/${member.userId}`)
      .catch(() => toast.error(tc("somethingWrong")));
    router.refresh();
  }

  const timeCls = "field h-10 w-[88px] text-sm tabular-nums";

  return (
    <Dialog
      open
      onClose={onClose}
      title={member ? member.name : t("newStaff")}
      description={member ? t("editStaff") : undefined}
      sheet
      size="lg"
    >
      <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar name={f.name || "?"} src={f.avatarUrl} size={56} />
            <label className="text-accent hover:text-foreground inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-[15px] font-medium">
              <Upload className="size-5" strokeWidth={1.75} />
              {td("photo")}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const r = await uploadMedia(salon.id, file, "staff");
                    set("avatarPath", r.path);
                    set("avatarUrl", r.url);
                  } catch {
                    toast.error(tc("somethingWrong"));
                  }
                }}
              />
            </label>
          </div>
          <div>
            <Label htmlFor="sf-name">{t("displayName")}</Label>
            <Input
              id="sf-name"
              value={f.name}
              onChange={(e) => set("name", e.target.value)}
              autoFocus={!member}
            />
          </div>
          <div>
            <Label htmlFor="sf-bio">{t("bio")}</Label>
            <Textarea
              id="sf-bio"
              value={f.bio}
              onChange={(e) => set("bio", e.target.value)}
              className="min-h-14"
              maxLength={120}
            />
          </div>
          <div>
            <div className="text-muted mb-2 text-[13px]">{t("color")}</div>
            <div className="flex gap-3">
              {STAFF_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  aria-pressed={f.color === c}
                  onClick={() => set("color", c)}
                  className={cn(
                    "size-8 rounded-full",
                    f.color === c && "ring-2 ring-offset-4 ring-offset-[var(--overlay)]",
                  )}
                  style={{ background: c, ["--tw-ring-color" as string]: c }}
                />
              ))}
            </div>
          </div>
          <div>
            <div className="text-muted text-[13px]">{t("services")}</div>
            <div className="mt-1 flex flex-wrap gap-x-5">
              {services.map((s) => (
                <label key={s.id} className="inline-flex min-h-10 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={f.serviceIds.includes(s.id)}
                    onChange={(e) =>
                      set(
                        "serviceIds",
                        e.target.checked ? [...f.serviceIds, s.id] : f.serviceIds.filter((x) => x !== s.id),
                      )
                    }
                    className="size-[18px]"
                  />
                  {s.name}
                </label>
              ))}
            </div>
          </div>
          <SwitchRow
            title={t("acceptsOnline")}
            checked={f.acceptsOnline}
            onChange={(v) => set("acceptsOnline", v)}
          />
          {member && (
            <SwitchRow title={td("activeLabel")} checked={f.isActive} onChange={(v) => set("isActive", v)} />
          )}
          {member && (
            <div className="border-border border-t pt-4">
              <div className="text-muted text-[13px]">{t("linked")}</div>
              {member.userId ? (
                <div className="mt-1 flex items-center justify-between text-[15px]">
                  <span>
                    {member.role
                      ? tset(`role${member.role.charAt(0).toUpperCase()}${member.role.slice(1)}` as never)
                      : "–"}
                  </span>
                  {owner && (
                    <button
                      type="button"
                      onClick={removeMember}
                      className="text-muted hover:text-danger text-sm"
                    >
                      {tc("remove")}
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onInvite(member.id)}
                  className="text-accent hover:text-foreground mt-1 min-h-11 text-[15px] font-medium"
                >
                  {t("invite")}
                </button>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="text-[15px] font-semibold">{t("schedule")}</div>
          <div className="mt-2">
            {f.schedule.map((d, i) => (
              <div
                key={d.weekday}
                className="border-border flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 border-b py-1"
              >
                <span className="w-24 text-[15px]">{tc(`weekdays.${d.weekday}` as never)}</span>
                <Switch
                  checked={d.on}
                  onChange={(v) =>
                    set(
                      "schedule",
                      f.schedule.map((r, j) => (j === i ? { ...r, on: v } : r)),
                    )
                  }
                  label={tc(`weekdays.${d.weekday}` as never)}
                />
                {d.on ? (
                  <span className="ms-auto flex flex-wrap items-center gap-2" dir="ltr">
                    <input
                      type="time"
                      value={d.start}
                      onChange={(e) =>
                        set(
                          "schedule",
                          f.schedule.map((r, j) => (j === i ? { ...r, start: e.target.value } : r)),
                        )
                      }
                      className={timeCls}
                      aria-label={t("work")}
                    />
                    <span className="text-muted">–</span>
                    <input
                      type="time"
                      value={d.end}
                      onChange={(e) =>
                        set(
                          "schedule",
                          f.schedule.map((r, j) => (j === i ? { ...r, end: e.target.value } : r)),
                        )
                      }
                      className={timeCls}
                      aria-label={t("work")}
                    />
                    <span className="text-muted ms-2 text-[13px]">{t("break")}</span>
                    <input
                      type="time"
                      value={d.breakStart}
                      onChange={(e) =>
                        set(
                          "schedule",
                          f.schedule.map((r, j) => (j === i ? { ...r, breakStart: e.target.value } : r)),
                        )
                      }
                      className={timeCls}
                      aria-label={t("break")}
                    />
                    <input
                      type="time"
                      value={d.breakEnd}
                      onChange={(e) =>
                        set(
                          "schedule",
                          f.schedule.map((r, j) => (j === i ? { ...r, breakEnd: e.target.value } : r)),
                        )
                      }
                      className={timeCls}
                      aria-label={t("break")}
                    />
                  </span>
                ) : (
                  <span className="text-muted ms-auto text-[15px]">{t("dayOff")}</span>
                )}
              </div>
            ))}
          </div>
          <p className="text-muted mt-3 text-[13px]">{td("timeOffHint")}</p>
        </div>
      </div>
      {error && (
        <Notice tone="danger" className="mt-6">
          {error}
        </Notice>
      )}
      <div className="mt-8 flex items-center justify-end gap-6">
        <Button variant="ghost" onClick={onClose}>
          {tc("cancel")}
        </Button>
        <Button onClick={save} loading={busy}>
          {td("saveChanges")}
        </Button>
      </div>
      <span className="sr-only">{tdash("staff")}</span>
    </Dialog>
  );
}
