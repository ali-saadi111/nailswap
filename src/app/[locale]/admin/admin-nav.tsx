"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { DashboardShell } from "@/components/shell/dashboard-shell";
import { Avatar, Dot } from "@/components/ui/primitives";

export function AdminNav({
  locale,
  counts,
  adminName,
  children,
}: {
  locale: string;
  counts: { pending: number; payments: number; moderation: number };
  adminName: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("admin");
  const ta = useTranslations("ui.admin");
  const td = useTranslations("ui.dash");
  const tc = useTranslations("common");
  return (
    <DashboardShell
      groups={[
        {
          label: td("groupOperations"),
          items: [
            { href: "/admin", label: ta("overview"), exact: true },
            { href: "/admin/approvals", label: ta("approvals"), count: counts.pending || undefined },
            { href: "/admin/payments", label: t("payments"), count: counts.payments || undefined },
            { href: "/admin/moderation", label: t("moderation"), count: counts.moderation || undefined },
            { href: "/admin/impersonation", label: ta("impersonation") },
          ],
        },
        {
          label: ta("platform"),
          items: [
            { href: "/admin/salons", label: t("salons") },
            { href: "/admin/users", label: ta("users") },
            { href: "/admin/settings", label: tc("settings") },
          ],
        },
      ]}
      ctx={{
        variant: "admin",
        footer: (
          <div className="space-y-4">
            <div className="text-muted flex items-center gap-2 text-sm">
              <Dot tone="success" />
              {ta("environment", { env: process.env.NODE_ENV === "production" ? "Production" : "Local" })}
            </div>
            <div className="flex items-center gap-3">
              <Avatar name={adminName} size={44} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-medium">{adminName}</div>
                <div className="text-muted text-[13px]">{ta("platformAdmin")}</div>
              </div>
              <a
                href={`/${locale}/logout`}
                aria-label={tc("signOut")}
                className="text-foreground hover:text-accent inline-flex size-11 items-center justify-center"
              >
                <LogOut className="size-5 rtl:-scale-x-100" strokeWidth={1.75} />
              </a>
            </div>
          </div>
        ),
      }}
    >
      {children}
    </DashboardShell>
  );
}
