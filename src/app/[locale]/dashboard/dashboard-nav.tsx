"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { DashboardShell, type NavGroup } from "@/components/shell/dashboard-shell";
import { Notice } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { fmtDay } from "@/lib/format";

export function DashboardNav({
  locale,
  salon,
  salons,
  pendingBookings,
  role,
  impersonating,
  subscription,
  isAdmin,
  children,
}: {
  locale: string;
  salon: { id: string; name: string; host: string; planLabel: string; onboardingComplete: boolean } | null;
  salons: { id: string; name: string }[];
  pendingBookings: number;
  role: string | null;
  impersonating: { salonName: string; expiresAt: string | null } | null;
  subscription: { status: string; graceEndsAt: string | null; trialEndsAt: string | null } | null;
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations("dashboard");
  const tm = useTranslations("merchant");
  const td = useTranslations("ui.dash");
  const tn = useTranslations("nav");
  const tcommon = useTranslations("common");
  const pathname = usePathname();
  const manager = role === "owner" || role === "manager" || role === "admin";

  const groups: NavGroup[] = salon
    ? [
        {
          items: [
            { href: "/dashboard/bookings", label: t("bookings"), count: pendingBookings || undefined },
            { href: "/dashboard/calendar", label: t("calendar") },
            ...(manager
              ? [
                  { href: "/dashboard/catalog", label: tm("feed") },
                  { href: "/dashboard/profile", label: tm("profile") },
                  { href: "/dashboard/staff", label: t("staff") },
                ]
              : []),
          ],
        },
      ]
    : [{ items: [{ href: "/dashboard/onboarding", label: td("setUp") }] }];

  const footer = (
    <div className="flex flex-col gap-1 text-[15px]">
      {isAdmin && (
        <Link href="/admin" className="text-muted hover:text-foreground min-h-9 leading-9 font-medium">
          {tn("admin")}
        </Link>
      )}
      <Link href="/account" className="text-muted hover:text-foreground min-h-9 leading-9 font-medium">
        {tn("account")}
      </Link>
      <a
        href={`/${locale}/logout`}
        className="text-muted hover:text-foreground min-h-9 leading-9 font-medium"
      >
        {tcommon("signOut")}
      </a>
    </div>
  );

  const banner = (
    <>
      {impersonating && (
        <ImpersonationStrip salonName={impersonating.salonName} expiresAt={impersonating.expiresAt} />
      )}
      {subscription?.status === "grace" && subscription.graceEndsAt && (
        <Notice tone="warning" className="px-6 pt-4 lg:ps-[264px]">
          {t("graceBanner", { date: fmtDay(subscription.graceEndsAt, locale) })}
        </Notice>
      )}
      {subscription?.status === "expired" && (
        <Notice tone="warning" className="px-6 pt-4 lg:ps-[264px]">
          {t("expiredBanner")}
        </Notice>
      )}
      {salon && !salon.onboardingComplete && !pathname.startsWith("/dashboard/onboarding") && (
        <Notice className="px-6 pt-4 lg:ps-[264px]">
          <Link href="/dashboard/onboarding" className="text-accent font-medium">
            {td("finishSetup")}
          </Link>
        </Notice>
      )}
    </>
  );

  return (
    <DashboardShell
      groups={groups}
      ctx={{
        variant: "salon",
        salon,
        salons,
        switchHref: (id) =>
          `/api/dashboard/switch?salon=${id}&next=${encodeURIComponent(`/${locale}/dashboard`)}`,
        footer,
      }}
      banner={banner}
    >
      {children}
    </DashboardShell>
  );
}

function ImpersonationStrip({ salonName, expiresAt }: { salonName: string; expiresAt: string | null }) {
  const td = useTranslations("ui.dash");
  const [left, setLeft] = React.useState("");
  React.useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      const m = Math.max(0, Math.floor(ms / 60000));
      const s = Math.max(0, Math.floor((ms % 60000) / 1000));
      setLeft(`${m}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  async function end() {
    await api.del("/api/admin/impersonation").catch(() => undefined);
    window.location.assign(
      new URL(
        window.location.pathname.replace(/\/dashboard.*/, "/admin/impersonation"),
        window.location.origin,
      ).href,
    );
  }
  return (
    <div className="bg-accent text-accent-contrast flex h-10 items-center justify-center gap-3 px-4 text-sm">
      <span>
        {td("viewingAs", { salon: salonName })}
        {left && <> · {td("endsIn", { time: left })}</>}
      </span>
      <button type="button" onClick={end} className="font-semibold underline-offset-4 hover:underline">
        {td("endSession")}
      </button>
    </div>
  );
}
