"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/shell/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, SwitchRow, Textarea } from "@/components/ui/input";
import { Dialog, Notice } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toaster";
import { fmtDateTime, money } from "@/lib/format";

export function AdminSettings({
  flags,
  announcements,
  audit,
  plans,
}: {
  flags: { key: string; enabled: boolean; description: string | null; updated_at: string }[];
  announcements: {
    id: string;
    title: string;
    body: string;
    level: string;
    audience: string;
    starts_at: string;
    ends_at: string | null;
    created_at: string;
  }[];
  audit: {
    id: number;
    action: string;
    targetType: string | null;
    targetId: string | null;
    createdAt: string;
    admin: string;
  }[];
  plans: {
    code: string;
    name: string;
    price_usd: number;
    ai_quota_monthly: number;
    staff_seats: number;
    is_active: boolean;
  }[];
}) {
  const t = useTranslations("admin");
  const ta = useTranslations("ui.admin");
  const tc = useTranslations("common");
  const tb = useTranslations("billing");
  const locale = useLocale();
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [newOpen, setNewOpen] = React.useState(false);
  const [form, setForm] = React.useState({ title: "", body: "", level: "info", audience: "salons" });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function toggleFlag(key: string, enabled: boolean) {
    const { error: e } = await supabase.from("feature_flags").update({ enabled }).eq("key", key);
    if (e) toast.error(tc("somethingWrong"));
    else router.refresh();
  }

  async function createAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from("announcements").insert({
      title: form.title.trim(),
      body: form.body.trim(),
      level: form.level,
      audience: form.audience,
    });
    setBusy(false);
    if (err) return setError(err.message);
    setNewOpen(false);
    setForm({ title: "", body: "", level: "info", audience: "salons" });
    router.refresh();
  }

  async function endAnnouncement(id: string) {
    await supabase.from("announcements").update({ ends_at: new Date().toISOString() }).eq("id", id);
    router.refresh();
  }

  return (
    <>
      <PageHeader
        context={ta("platformSettingsSub")}
        title={tc("settings")}
        actions={<Button onClick={() => setNewOpen(true)}>{t("newAnnouncement")}</Button>}
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="dashboard-card">
          <h2 className="font-display text-[28px] leading-none">{t("flags")}</h2>
          <div className="mt-4">
            {flags.map((f) => (
              <SwitchRow
                key={f.key}
                title={f.key}
                description={f.description ?? undefined}
                checked={f.enabled}
                onChange={(v) => toggleFlag(f.key, v)}
              />
            ))}
            {flags.length === 0 && <p className="text-muted py-4 text-sm">–</p>}
          </div>

          <h2 className="font-display mt-14 text-[28px] leading-none">{tb("plans")}</h2>
          <div className="dashboard-table dashboard-table mt-4">
            <div className="table-head grid-cols-[1fr_100px_120px_90px_90px]">
              <span>{ta("plan")}</span>
              <span>{tc("price")}</span>
              <span>{ta("aiQuota")}</span>
              <span>{ta("seats")}</span>
              <span>{tc("status")}</span>
            </div>
            {plans.map((p) => (
              <div key={p.code} className="data-row h-13 grid-cols-[1fr_100px_120px_90px_90px]">
                <span className="text-[15px] font-medium">{p.name}</span>
                <span className="tabular-nums">{money(p.price_usd, "USD", locale)}</span>
                <span className="tabular-nums">{p.ai_quota_monthly}</span>
                <span className="tabular-nums">{p.staff_seats}</span>
                <span className="text-muted">{p.is_active ? ta("status_active") : ta("inactive")}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="dashboard-card">
          <h2 className="font-display text-[28px] leading-none">{t("announcements")}</h2>
          <ul className="mt-4">
            {announcements.map((a) => {
              const live = !a.ends_at || new Date(a.ends_at) > new Date();
              return (
                <li key={a.id} className="border-border border-b py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[15px] font-semibold">{a.title}</div>
                      <p className="text-muted mt-1 text-sm leading-5">{a.body}</p>
                      <div className="text-muted mt-1 text-[13px]">
                        {a.level} · {a.audience} · {fmtDateTime(a.created_at, locale)}
                      </div>
                    </div>
                    {live ? (
                      <button
                        type="button"
                        onClick={() => endAnnouncement(a.id)}
                        className="text-muted hover:text-danger shrink-0 text-sm"
                      >
                        {ta("endNow")}
                      </button>
                    ) : (
                      <span className="text-muted shrink-0 text-sm">{ta("ended")}</span>
                    )}
                  </div>
                </li>
              );
            })}
            {announcements.length === 0 && <li className="text-muted py-4 text-sm">–</li>}
          </ul>

          <h2 id="audit" className="font-display mt-14 scroll-mt-8 text-[28px] leading-none">
            {t("audit")}
          </h2>
          <ul className="mt-4">
            {audit.map((a) => (
              <li
                key={a.id}
                className="border-border flex min-h-12 items-center justify-between gap-4 border-b text-sm"
              >
                <span className="min-w-0 truncate">
                  <b className="font-semibold">{a.admin}</b>{" "}
                  <span className="text-muted">{a.action.replace(/[._]/g, " ")}</span>
                  {a.targetType && <span className="text-muted"> · {a.targetType}</span>}
                </span>
                <span className="text-muted shrink-0 tabular-nums" dir="ltr">
                  {fmtDateTime(a.createdAt, locale)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <Dialog open={newOpen} onClose={() => setNewOpen(false)} title={t("newAnnouncement")} size="md">
        <form onSubmit={createAnnouncement} className="space-y-6">
          <div>
            <Label htmlFor="an-title">{ta("announcementTitle")}</Label>
            <Input
              id="an-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              maxLength={120}
            />
          </div>
          <div>
            <Label htmlFor="an-body">{ta("announcementBody")}</Label>
            <Textarea
              id="an-body"
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              required
              maxLength={600}
            />
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <Label htmlFor="an-level">{ta("level")}</Label>
              <Select
                id="an-level"
                value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value })}
              >
                <option value="info">info</option>
                <option value="warning">warning</option>
                <option value="critical">critical</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="an-aud">{ta("audience")}</Label>
              <Select
                id="an-aud"
                value={form.audience}
                onChange={(e) => setForm({ ...form, audience: e.target.value })}
              >
                <option value="salons">salons</option>
                <option value="clients">clients</option>
                <option value="all">all</option>
              </Select>
            </div>
          </div>
          {error && <Notice tone="danger">{error}</Notice>}
          <div className="flex justify-end">
            <Button type="submit" loading={busy}>
              {tc("create")}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
