"use client";

import * as React from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Wordmark } from "./wordmark";
import { IconButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
  count?: number | string;
  exact?: boolean;
}
export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export interface SidebarContext {
  /** "salon" shows the salon switcher; "admin" shows the muted "Admin" suffix. */
  variant: "salon" | "admin";
  salon?: { id: string; name: string; host: string; planLabel: string } | null;
  salons?: { id: string; name: string }[];
  switchHref?: (id: string) => string;
  footer?: React.ReactNode;
}

function NavList({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const isActive = (it: NavItem) =>
    it.exact ? pathname === it.href : pathname === it.href || pathname.startsWith(it.href + "/");
  return (
    <nav className="flex flex-col gap-6">
      {groups.map((g, gi) => (
        <div key={gi}>
          {g.label && <div className="text-muted mb-2 px-3 text-xs font-bold">{g.label}</div>}
          <ul className="space-y-1">
            {g.items.map((it) => (
              <li key={it.href}>
                <Link
                  href={it.href}
                  onClick={onNavigate}
                  aria-current={isActive(it) ? "page" : undefined}
                  className="nav-item"
                >
                  <span className="min-w-0 flex-1">{it.label}</span>
                  {it.count !== undefined && it.count !== 0 && (
                    <span className="bg-background text-foreground rounded-full px-2 py-0.5 text-xs tabular-nums">
                      {it.count}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SalonSwitcher({ ctx }: { ctx: SidebarContext }) {
  const t = useTranslations("dashboard");
  const [open, setOpen] = React.useState(false);
  if (!ctx.salon) return null;
  const many = (ctx.salons?.length ?? 0) > 1;
  return (
    <div className="bg-background mt-6 rounded-[24px] p-4">
      {many ? (
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-haspopup="listbox"
            className="hover:text-accent inline-flex min-h-11 items-center gap-1.5 text-start text-[17px] font-bold"
          >
            <span className="truncate">{ctx.salon.name}</span>
            <ChevronDown className="text-muted size-4 shrink-0" />
          </button>
          {open && (
            <ul
              role="listbox"
              aria-label={t("switchSalon")}
              className="bg-overlay absolute start-0 top-full z-20 mt-1 min-w-56 rounded-2xl py-2 shadow-lg"
            >
              {ctx.salons!.map((s) => (
                <li key={s.id}>
                  <a
                    href={ctx.switchHref?.(s.id) ?? "#"}
                    role="option"
                    aria-selected={s.id === ctx.salon!.id}
                    className={cn(
                      "hover:bg-surface-2 flex h-11 items-center px-4 text-[15px]",
                      s.id === ctx.salon!.id ? "text-accent font-medium" : "text-foreground",
                    )}
                  >
                    {s.name}
                  </a>
                </li>
              ))}
              <li>
                <Link
                  href="/dashboard/onboarding?new=1"
                  className="text-muted hover:text-foreground flex h-11 items-center px-4 text-[15px]"
                >
                  {t("newSalon")}
                </Link>
              </li>
            </ul>
          )}
        </div>
      ) : (
        <div className="min-h-11 pt-2.5 text-[17px] font-bold">{ctx.salon.name}</div>
      )}
      <div className="text-muted mt-0.5 text-[13px] break-words">
        {ctx.salon.planLabel} · <span dir="ltr">{ctx.salon.host}</span>
      </div>
    </div>
  );
}

function SidebarBody({
  groups,
  ctx,
  onNavigate,
}: {
  groups: NavGroup[];
  ctx: SidebarContext;
  onNavigate?: () => void;
}) {
  const ta = useTranslations("nav");
  return (
    <div className="flex h-full flex-col">
      <Wordmark suffix={ctx.variant === "admin" ? ta("admin") : undefined} />
      {ctx.variant === "salon" && <SalonSwitcher ctx={ctx} />}
      <div className={cn("flex-1", ctx.variant === "salon" ? "mt-7" : "mt-10")}>
        <NavList groups={groups} onNavigate={onNavigate} />
      </div>
      {ctx.footer && <div className="mt-8">{ctx.footer}</div>}
    </div>
  );
}

/**
 * Blush dashboard: surface sidebar and pill navigation on a blush ground.
 * On phones, a glass header opens the same navigation in a rounded sheet.
 */
export function DashboardShell({
  groups,
  ctx,
  banner,
  children,
}: {
  groups: NavGroup[];
  ctx: SidebarContext;
  banner?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const t = useTranslations("nav");

  return (
    <div className="dashboard-shell bg-background min-h-dvh">
      {banner}
      <div className="lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden p-4 lg:block">
          <div className="bg-surface no-scrollbar sticky top-4 h-[calc(100dvh-2rem)] overflow-y-auto rounded-[28px] px-5 py-6">
            <SidebarBody groups={groups} ctx={ctx} />
          </div>
        </aside>

        <div className="glass sticky top-0 z-40 flex min-h-16 items-center justify-between gap-3 px-5 py-2 lg:hidden">
          <Wordmark suffix={ctx.variant === "admin" ? t("admin") : undefined} />
          <IconButton aria-label={t("menu")} onClick={() => setOpen(true)} tone="surface">
            <Menu />
          </IconButton>
        </div>

        {open && (
          <div
            className="fixed inset-0 z-50 lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label={t("menu")}
          >
            <button
              type="button"
              aria-label={t("menu")}
              className="absolute inset-0 bg-[rgb(43_33_28/0.4)]"
              onClick={() => setOpen(false)}
            />
            <div className="bg-overlay absolute inset-y-3 start-3 w-[300px] max-w-[85vw] overflow-y-auto rounded-[28px] px-5 py-6 shadow-lg">
              <div className="-me-3 mb-2 flex justify-end">
                <IconButton aria-label={t("menu")} onClick={() => setOpen(false)}>
                  <X />
                </IconButton>
              </div>
              <SidebarBody groups={groups} ctx={ctx} onNavigate={() => setOpen(false)} />
            </div>
          </div>
        )}

        <main id="main" className="min-w-0 px-5 py-6 lg:py-9 lg:ps-4 lg:pe-8">
          {children}
        </main>
      </div>
    </div>
  );
}

/** Hero header: muted context, heavy title, and wrapping page actions. */
export function PageHeader({
  context,
  title,
  actions,
  className,
}: {
  context?: React.ReactNode;
  title: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-hero mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 rounded-[28px] p-5 sm:p-6",
        className,
      )}
    >
      <div className="min-w-0">
        {context && <div className="text-muted text-[15px]">{context}</div>}
        <h1 className="font-display mt-1 text-[32px] leading-tight break-words lg:text-[38px]">{title}</h1>
      </div>
      {actions && (
        <div className="flex max-w-full min-w-0 flex-wrap items-center gap-x-4 gap-y-2">{actions}</div>
      )}
    </div>
  );
}
