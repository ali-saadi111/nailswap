"use client";

import * as React from "react";
import { Check, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Salon } from "@/lib/supabase/types";
import { PageHeader } from "@/components/shell/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, SwitchRow, Textarea } from "@/components/ui/input";
import { Avatar, Dialog, Notice } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toaster";
import { api, isApiError } from "@/lib/client/api";
import { BRAND_COLORS, uploadMedia } from "@/lib/client/dashboard";
import { prettyPhone } from "@/lib/format";
import { cn } from "@/lib/utils";

type Member = {
  userId: string;
  role: "owner" | "manager" | "staff";
  name: string | null;
  phone: string | null;
  staffName: string | null;
};
type Template = { kind: string; locale: string; body: string };

const SECTIONS = ["profile", "booking", "public", "notifications", "team"] as const;
const TEMPLATE_KINDS = [
  "booking_confirmation",
  "booking_pending",
  "booking_reminder_24h",
  "booking_reminder_2h",
  "booking_cancelled",
] as const;

export function SettingsForm({
  salon,
  host,
  logoUrl: initialLogo,
  coverUrl: initialCover,
  role,
  plan,
  members,
  templates,
}: {
  salon: Salon;
  host: string;
  logoUrl: string | null;
  coverUrl: string | null;
  role: string;
  plan: { removeBranding: boolean; seats: number; code: string };
  members: Member[];
  templates: Template[];
}) {
  const t = useTranslations("settings");
  const td = useTranslations("ui.dash");
  const tc = useTranslations("common");
  const to = useTranslations("onboarding");
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const owner = role === "owner" || role === "admin";

  const initial = React.useMemo(
    () => ({
      name: salon.name,
      phone: salon.phone ?? "",
      whatsapp_number: salon.whatsapp_number ?? "",
      instagram: salon.instagram ?? "",
      website: salon.website ?? "",
      email: salon.email ?? "",
      description: salon.description ?? "",
      address: salon.address ?? "",
      area: salon.area ?? "",
      city: salon.city ?? "",
      booking_mode: salon.booking_mode,
      min_lead_time_min: salon.min_lead_time_min,
      cancel_cutoff_hours: salon.cancel_cutoff_hours,
      reschedule_cutoff_hours: salon.reschedule_cutoff_hours,
      max_advance_days: salon.max_advance_days,
      slot_interval_min: salon.slot_interval_min,
      deposit_required: salon.deposit_required,
      deposit_amount: Number(salon.deposit_amount),
      brand_color: salon.brand_color,
      logo_path: salon.logo_path,
      cover_path: salon.cover_path,
      remove_branding: salon.remove_branding,
      default_locale: salon.default_locale,
      languages: salon.languages as string[],
      currency: salon.currency,
    }),
    [salon],
  );
  const [form, setForm] = React.useState(initial);
  const [logoUrl, setLogoUrl] = React.useState(initialLogo);
  const [coverUrl, setCoverUrl] = React.useState(initialCover);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [section, setSection] = React.useState<(typeof SECTIONS)[number]>("profile");
  const [tpl, setTpl] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(
      templates.filter((x) => x.locale === salon.default_locale).map((x) => [x.kind, x.body]),
    ),
  );
  const [tplDirty, setTplDirty] = React.useState(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const dirtyKeys = (Object.keys(form) as (keyof typeof form)[]).filter(
    (k) => JSON.stringify(form[k]) !== JSON.stringify(initial[k]),
  );
  const dirty = dirtyKeys.length + (tplDirty ? 1 : 0);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const { error: e } = await supabase
        .from("salons")
        .update({
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          whatsapp_number: form.whatsapp_number.trim() || null,
          instagram: form.instagram.trim().replace(/^@/, "") || null,
          website: form.website.trim() || null,
          email: form.email.trim() || null,
          description: form.description.trim() || null,
          address: form.address.trim() || null,
          area: form.area.trim() || null,
          city: form.city.trim() || null,
          booking_mode: form.booking_mode,
          min_lead_time_min: form.min_lead_time_min,
          cancel_cutoff_hours: form.cancel_cutoff_hours,
          reschedule_cutoff_hours: form.reschedule_cutoff_hours,
          max_advance_days: form.max_advance_days,
          slot_interval_min: form.slot_interval_min,
          deposit_required: form.deposit_required,
          deposit_amount: form.deposit_required ? form.deposit_amount : 0,
          brand_color: form.brand_color,
          logo_path: form.logo_path,
          cover_path: form.cover_path,
          remove_branding: plan.removeBranding ? form.remove_branding : false,
          default_locale: form.default_locale as never,
          languages: form.languages as never,
          currency: form.currency,
        })
        .eq("id", salon.id);
      if (e) throw e;
      if (tplDirty) {
        const rows = TEMPLATE_KINDS.filter((k) => tpl[k]?.trim()).map((k) => ({
          salon_id: salon.id,
          kind: k as never,
          locale: form.default_locale as never,
          body: tpl[k].trim(),
        }));
        if (rows.length) {
          const { error: e2 } = await supabase
            .from("salon_notification_templates")
            .upsert(rows, { onConflict: "salon_id,kind,locale" });
          if (e2) throw e2;
        }
        setTplDirty(false);
      }
      toast.success(t("saved"));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : tc("somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  async function upload(kind: "logo" | "cover", file: File) {
    try {
      const r = await uploadMedia(salon.id, file, kind);
      if (kind === "logo") {
        set("logo_path", r.path);
        setLogoUrl(r.url);
      } else {
        set("cover_path", r.path);
        setCoverUrl(r.url);
      }
    } catch {
      toast.error(tc("somethingWrong"));
    }
  }

  async function changeRole(m: Member, roleNew: "manager" | "staff") {
    try {
      await api.patch(`/api/dashboard/${salon.id}/members/${m.userId}`, { role: roleNew });
      router.refresh();
    } catch {
      toast.error(tc("somethingWrong"));
    }
  }
  async function removeMember(m: Member) {
    if (!confirm(`${tc("remove")} ${m.name ?? m.phone}?`)) return;
    try {
      await api.del(`/api/dashboard/${salon.id}/members/${m.userId}`);
      router.refresh();
    } catch {
      toast.error(tc("somethingWrong"));
    }
  }

  const sectionLabels: Record<(typeof SECTIONS)[number], string> = {
    profile: td("salonProfile"),
    booking: t("booking"),
    public: td("publicPage"),
    notifications: t("notifications"),
    team: t("team"),
  };
  const hoursOptions = [1, 2, 4, 12, 24, 48];
  const noticeOptions = [0, 30, 60, 120, 240, 1440];
  const advanceOptions = [7, 14, 30, 60, 90];

  return (
    <>
      <PageHeader
        context={salon.name}
        title={t("title")}
        actions={
          <>
            {dirty > 0 && <span className="text-muted text-[15px]">{td("unsaved", { count: dirty })}</span>}
            {dirty > 0 && (
              <Button
                variant="ghost"
                onClick={() => {
                  setForm(initial);
                  setTplDirty(false);
                }}
              >
                {td("discard")}
              </Button>
            )}
            <Button onClick={save} loading={busy} disabled={dirty === 0}>
              <Check className="size-5" strokeWidth={2} />
              {td("saveChanges")}
            </Button>
          </>
        }
      />
      {error && (
        <Notice tone="danger" className="mb-6">
          {error}
        </Notice>
      )}

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav className="hidden lg:block">
          <ul className="sticky top-9 space-y-1">
            {SECTIONS.map((s) => (
              <li key={s}>
                <a
                  href={`#${s}`}
                  onClick={() => setSection(s)}
                  aria-current={section === s ? "page" : undefined}
                  className="nav-item"
                >
                  {sectionLabels[s]}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="grid grid-cols-1 gap-x-16 gap-y-14 xl:grid-cols-2">
          <section id="profile" className="scroll-mt-8 space-y-6">
            <div>
              <h2 className="font-display text-[28px] leading-none">{td("salonProfile")}</h2>
              <p className="text-muted mt-2 text-[15px]">{td("salonProfileSub")}</p>
            </div>
            <div>
              <Label htmlFor="st-name">{to("salonName")}</Label>
              <Input
                id="st-name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                maxLength={80}
              />
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <Label htmlFor="st-phone">{tc("phone")}</Label>
                <Input
                  id="st-phone"
                  dir="ltr"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="st-ig">{to("instagram")}</Label>
                <Input
                  id="st-ig"
                  dir="ltr"
                  value={form.instagram}
                  onChange={(e) => set("instagram", e.target.value)}
                  placeholder="@"
                />
              </div>
              <div>
                <Label htmlFor="st-wa">{to("whatsapp")}</Label>
                <Input
                  id="st-wa"
                  dir="ltr"
                  value={form.whatsapp_number}
                  onChange={(e) => set("whatsapp_number", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="st-email">{tc("email")}</Label>
                <Input
                  id="st-email"
                  dir="ltr"
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="st-about">{td("about")}</Label>
              <Textarea
                id="st-about"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                maxLength={400}
              />
            </div>
            <div className="grid grid-cols-[1fr_1fr_1fr] gap-6">
              <div className="col-span-3">
                <Label htmlFor="st-address">{to("address")}</Label>
                <Input
                  id="st-address"
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="st-area">{to("area")}</Label>
                <Input id="st-area" value={form.area} onChange={(e) => set("area", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="st-city">{to("city")}</Label>
                <Input id="st-city" value={form.city} onChange={(e) => set("city", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="st-currency">{t("currency")}</Label>
                <Select
                  id="st-currency"
                  value={form.currency}
                  onChange={(e) => set("currency", e.target.value)}
                >
                  <option value="USD">USD</option>
                  <option value="LBP">LBP</option>
                </Select>
              </div>
            </div>

            <div id="booking" className="scroll-mt-8 pt-8">
              <h2 className="font-display text-[28px] leading-none">{t("booking")}</h2>
              <p className="text-muted mt-2 text-[15px]">{td("bookingRulesSub")}</p>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <Label htmlFor="st-mode">{t("bookingMode")}</Label>
                <Select
                  id="st-mode"
                  value={form.booking_mode}
                  onChange={(e) => set("booking_mode", e.target.value as "instant" | "approval")}
                >
                  <option value="instant">{t("instant")}</option>
                  <option value="approval">{t("approval")}</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="st-interval">{t("slotInterval")}</Label>
                <Select
                  id="st-interval"
                  value={form.slot_interval_min}
                  onChange={(e) => set("slot_interval_min", Number(e.target.value))}
                >
                  {[10, 15, 20, 30, 45, 60].map((n) => (
                    <option key={n} value={n}>
                      {tc("min", { count: n })}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="st-lead">{t("leadTime")}</Label>
                <Select
                  id="st-lead"
                  value={form.min_lead_time_min}
                  onChange={(e) => set("min_lead_time_min", Number(e.target.value))}
                >
                  {noticeOptions.map((n) => (
                    <option key={n} value={n}>
                      {n >= 60 ? tc("hours", { count: n / 60 }) : tc("min", { count: n })}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="st-cancel">{t("cancelCutoff")}</Label>
                <Select
                  id="st-cancel"
                  value={form.cancel_cutoff_hours}
                  onChange={(e) => set("cancel_cutoff_hours", Number(e.target.value))}
                >
                  {hoursOptions.map((n) => (
                    <option key={n} value={n}>
                      {td("hoursBefore", { count: n })}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="st-resched">{t("rescheduleCutoff")}</Label>
                <Select
                  id="st-resched"
                  value={form.reschedule_cutoff_hours}
                  onChange={(e) => set("reschedule_cutoff_hours", Number(e.target.value))}
                >
                  {hoursOptions.map((n) => (
                    <option key={n} value={n}>
                      {td("hoursBefore", { count: n })}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="st-advance">{t("advance")}</Label>
                <Select
                  id="st-advance"
                  value={form.max_advance_days}
                  onChange={(e) => set("max_advance_days", Number(e.target.value))}
                >
                  {advanceOptions.map((n) => (
                    <option key={n} value={n}>
                      {td("daysAhead", { count: n })}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <SwitchRow
              title={t("deposit")}
              description={td("depositHint")}
              checked={form.deposit_required}
              onChange={(v) => set("deposit_required", v)}
            />
            {form.deposit_required && (
              <div className="max-w-[240px]">
                <Label htmlFor="st-deposit">{t("depositAmount")}</Label>
                <Input
                  id="st-deposit"
                  type="number"
                  min={0}
                  dir="ltr"
                  value={form.deposit_amount}
                  onChange={(e) => set("deposit_amount", Number(e.target.value))}
                />
              </div>
            )}
          </section>

          <section className="space-y-6">
            <div id="public" className="scroll-mt-8">
              <h2 className="font-display text-[28px] leading-none">{td("publicPage")}</h2>
            </div>
            <div>
              <div className="text-muted text-[13px]">{to("slug")}</div>
              <div className="border-border-strong flex h-12 items-center border-b text-base" dir="ltr">
                <span className="font-medium">{salon.slug}</span>
                <span className="text-muted ms-auto">.{host.split(".").slice(1).join(".")}</span>
              </div>
            </div>
            <div className="flex items-center gap-5">
              <Avatar name={salon.name} src={logoUrl} size={64} serif />
              <div className="flex-1">
                <div className="text-[15px] font-medium">{to("logo")}</div>
                <div className="text-muted text-[13px]">{td("logoHint")}</div>
              </div>
              <label className="text-accent hover:text-foreground inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-[15px] font-medium">
                <Upload className="size-5" strokeWidth={1.75} />
                {td("replace")}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => e.target.files?.[0] && upload("logo", e.target.files[0])}
                />
              </label>
            </div>
            <div className="flex items-center gap-5">
              <div className="rounded-media bg-nude h-20 w-[150px] shrink-0 overflow-hidden">
                {coverUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coverUrl} alt="" className="size-full object-cover" />
                )}
              </div>
              <div className="flex-1">
                <div className="text-[15px] font-medium">{to("cover")}</div>
                <div className="text-muted text-[13px]">{td("coverHint")}</div>
              </div>
              <label className="text-accent hover:text-foreground inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-[15px] font-medium">
                <Upload className="size-5" strokeWidth={1.75} />
                {td("replace")}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => e.target.files?.[0] && upload("cover", e.target.files[0])}
                />
              </label>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[15px] font-medium">{to("brandColor")}</span>
              <div className="flex items-center gap-3">
                {BRAND_COLORS.slice(0, 5).map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    aria-pressed={form.brand_color === c}
                    onClick={() => set("brand_color", c)}
                    className={cn(
                      "size-9 rounded-full",
                      form.brand_color === c && "ring-2 ring-offset-4 ring-offset-[var(--background)]",
                    )}
                    style={{ background: c, ["--tw-ring-color" as string]: c }}
                  />
                ))}
                <input
                  type="color"
                  aria-label={to("brandColor")}
                  value={form.brand_color}
                  onChange={(e) => set("brand_color", e.target.value)}
                  className="size-9 cursor-pointer rounded-full border-0 bg-transparent p-0"
                />
              </div>
            </div>
            <SwitchRow
              title={t("removeBranding")}
              description={plan.removeBranding ? td("removeBrandingHint") : t("removeBrandingPro")}
              checked={form.remove_branding && plan.removeBranding}
              disabled={!plan.removeBranding}
              onChange={(v) => set("remove_branding", v)}
            />

            <div id="notifications" className="scroll-mt-8 pt-8">
              <h2 className="font-display text-[28px] leading-none">{t("notifications")}</h2>
              <p className="text-muted mt-2 text-[15px]">{t("templatesHint")}</p>
            </div>
            <div className="space-y-5">
              {TEMPLATE_KINDS.map((k) => (
                <div key={k}>
                  <Label htmlFor={`tpl-${k}`}>{td(`tpl_${k}` as never)}</Label>
                  <Textarea
                    id={`tpl-${k}`}
                    value={tpl[k] ?? ""}
                    placeholder={td("tplDefault")}
                    onChange={(e) => {
                      setTpl((c) => ({ ...c, [k]: e.target.value }));
                      setTplDirty(true);
                    }}
                    className="min-h-14"
                    maxLength={600}
                  />
                </div>
              ))}
            </div>

            <div id="team" className="scroll-mt-8 pt-8">
              <div className="flex items-end justify-between">
                <h2 className="font-display text-[28px] leading-none">{t("team")}</h2>
                {owner && (
                  <button
                    type="button"
                    onClick={() => setInviteOpen(true)}
                    className="text-accent hover:text-foreground text-[15px] font-medium"
                  >
                    {t("inviteMember")}
                  </button>
                )}
              </div>
              <p className="text-muted mt-2 text-[15px]">
                {td("seatsUsed", { used: members.length, seats: plan.seats })}
              </p>
            </div>
            <ul>
              {members.map((m) => (
                <li key={m.userId} className="border-border flex min-h-[60px] items-center gap-3 border-b">
                  <Avatar name={m.name ?? m.phone ?? "?"} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px]">{m.name ?? prettyPhone(m.phone)}</span>
                    {m.staffName && <span className="text-muted block text-[13px]">{m.staffName}</span>}
                  </span>
                  {m.role === "owner" || !owner ? (
                    <span className="text-muted text-[15px]">
                      {t(`role${m.role.charAt(0).toUpperCase()}${m.role.slice(1)}` as never)}
                    </span>
                  ) : (
                    <>
                      <Select
                        value={m.role}
                        onChange={(e) => changeRole(m, e.target.value as "manager" | "staff")}
                        className="h-10 w-auto border-transparent text-[15px]"
                        wrapperClassName="inline-block"
                      >
                        <option value="manager">{t("roleManager")}</option>
                        <option value="staff">{t("roleStaff")}</option>
                      </Select>
                      <button
                        type="button"
                        onClick={() => removeMember(m)}
                        className="text-muted hover:text-danger min-h-11 text-sm"
                      >
                        {tc("remove")}
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        salonId={salon.id}
        onDone={() => router.refresh()}
      />
    </>
  );
}

export function InviteDialog({
  open,
  onClose,
  salonId,
  onDone,
  staffId,
}: {
  open: boolean;
  onClose: () => void;
  salonId: string;
  onDone: () => void;
  staffId?: string;
}) {
  const t = useTranslations("settings");
  const ts = useTranslations("staffPage");
  const tc = useTranslations("common");
  const [phone, setPhone] = React.useState("");
  const [name, setName] = React.useState("");
  const [role, setRole] = React.useState<"manager" | "staff">("staff");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/dashboard/${salonId}/members`, {
        phone: phone.trim(),
        fullName: name.trim() || undefined,
        role,
        staffId,
      });
      toast.success(ts("invited"));
      onDone();
      onClose();
      setPhone("");
      setName("");
    } catch (err) {
      setError(
        isApiError(err, "seat_limit")
          ? ts("seatsFull")
          : isApiError(err, "already_exists")
            ? tc("somethingWrong")
            : tc("somethingWrong"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={t("inviteMember")} size="sm">
      <form onSubmit={submit} className="space-y-6">
        <div>
          <Label htmlFor="inv-phone">{ts("invitePhone")}</Label>
          <Input
            id="inv-phone"
            type="tel"
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="inv-name">{tc("name")}</Label>
          <Input id="inv-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        {!staffId && (
          <div>
            <Label htmlFor="inv-role">{t("members")}</Label>
            <Select
              id="inv-role"
              value={role}
              onChange={(e) => setRole(e.target.value as "manager" | "staff")}
            >
              <option value="staff">{t("roleStaff")}</option>
              <option value="manager">{t("roleManager")}</option>
            </Select>
          </div>
        )}
        {error && <Notice tone="danger">{error}</Notice>}
        <div className="flex justify-end">
          <Button type="submit" loading={busy}>
            {ts("invite")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
