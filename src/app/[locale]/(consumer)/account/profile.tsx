"use client";

import * as React from "react";
import { Bookmark, CalendarDays, ChevronRight, HelpCircle, LogOut } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Avatar, Dialog, Notice, StatusDot } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { api } from "@/lib/client/api";
import { clearMe, refreshMe } from "@/lib/client/use-me";
import { prettyPhone } from "@/lib/format";

export function Profile({
  user,
  looksCount,
  upcomingCount,
}: {
  user: {
    id: string;
    phone: string;
    email: string | null;
    fullName: string | null;
    avatarUrl: string | null;
    preferredLocale: string;
    createdAt: string | null;
  };
  looksCount: number;
  upcomingCount: number;
}) {
  const t = useTranslations("ui.account");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [editing, setEditing] = React.useState(!user.fullName);
  const [name, setName] = React.useState(user.fullName ?? "");
  const [email, setEmail] = React.useState(user.email ?? "");
  const [busy, setBusy] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.patch("/api/auth/me", {
        fullName: name.trim() || undefined,
        email: email.trim() ? email.trim() : null,
        preferredLocale: "en",
      });
      await refreshMe();
      toast.success(t("saved"));
      setEditing(false);
      router.refresh();
    } catch {
      setError(tc("somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await api.post("/api/auth/logout").catch(() => undefined);
    clearMe();
    window.location.assign(new URL(`/${locale}/logout`, window.location.origin).href);
  }

  async function deleteData() {
    setBusy(true);
    try {
      const { looks } = await api.get<{ looks: { id: string; jobId: string | null }[] }>(
        "/api/account/looks",
      );
      await Promise.all(looks.map((l) => api.del(`/api/account/looks/${l.id}`).catch(() => undefined)));
      await Promise.all(
        [...new Set(looks.map((l) => l.jobId).filter(Boolean))].map((id) =>
          api.del(`/api/tryon/jobs/${id}`).catch(() => undefined),
        ),
      );
      toast.success(t("deleted"));
      setConfirmDelete(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="flex h-[52px] items-center justify-between">
        <h1 className="font-display text-[34px] leading-none">{t("profile")}</h1>
      </header>

      <div className="mt-5 flex items-start gap-4">
        <Avatar name={user.fullName ?? user.phone} src={user.avatarUrl} size={64} serif />
        <div className="min-w-0 flex-1">
          <div className="text-lg leading-6 font-semibold">{user.fullName ?? t("noName")}</div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm leading-5">
            <span dir="ltr">{prettyPhone(user.phone)}</span>
            <StatusDot tone="success">{t("verified")}</StatusDot>
          </div>
          {user.email && <div className="mt-1 text-sm leading-5">{user.email}</div>}
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-accent hover:text-foreground -mt-2.5 min-h-11 text-sm font-medium"
          >
            {t("edit")}
          </button>
        )}
      </div>

      {editing && (
        <form onSubmit={save} className="mt-6 space-y-6">
          <div>
            <Label htmlFor="pf-name">{t("name")}</Label>
            <Input
              id="pf-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              maxLength={80}
            />
          </div>
          <div>
            <Label htmlFor="pf-email">{t("email")}</Label>
            <Input
              id="pf-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              dir="ltr"
            />
          </div>
          {error && <Notice tone="danger">{error}</Notice>}
          <div className="flex items-center gap-6">
            <Button type="submit" loading={busy}>
              {t("save")}
            </Button>
            {user.fullName && (
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                {tc("cancel")}
              </Button>
            )}
          </div>
        </form>
      )}

      <div className="mt-8">
        <Link
          href="/account/looks"
          className="border-border hover:text-accent flex min-h-13 items-center gap-3.5 border-b text-[15px]"
        >
          <Bookmark className="text-accent size-5" strokeWidth={1.75} />
          <span className="flex-1">{t("savedLooks")}</span>
          <span className="text-muted text-[13px]">{looksCount}</span>
          <ChevronRight className="text-muted size-[18px] rtl:-scale-x-100" strokeWidth={1.75} />
        </Link>
        <Link
          href="/account/bookings"
          className="border-border hover:text-accent flex min-h-13 items-center gap-3.5 border-b text-[15px]"
        >
          <CalendarDays className="text-accent size-5" strokeWidth={1.75} />
          <span className="flex-1">{t("bookings")}</span>
          <span className="text-muted text-[13px]">{t("upcomingCount", { count: upcomingCount })}</span>
          <ChevronRight className="text-muted size-[18px] rtl:-scale-x-100" strokeWidth={1.75} />
        </Link>
        <a
          href="mailto:help@nailswap.app"
          className="border-border hover:text-accent flex min-h-13 items-center gap-3.5 border-b text-[15px]"
        >
          <HelpCircle className="text-accent size-5" strokeWidth={1.75} />
          <span className="flex-1">{t("help")}</span>
          <ChevronRight className="text-muted size-[18px] rtl:-scale-x-100" strokeWidth={1.75} />
        </a>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={signOut}
          className="text-foreground hover:text-accent inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium"
        >
          <LogOut className="size-5 rtl:-scale-x-100" strokeWidth={1.75} />
          {t("signOut")}
        </button>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="text-muted hover:text-danger min-h-11 text-sm"
        >
          {t("deleteAccount")}
        </button>
      </div>
      <p className="text-muted mt-1 text-[13px]">{t("deleteHint")}</p>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t("deleteAccount")}
        description={t("deleteConfirm")}
        sheet
        size="sm"
      >
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
            {tc("cancel")}
          </Button>
          <Button loading={busy} onClick={deleteData} className="bg-danger hover:bg-danger">
            {tc("delete")}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
