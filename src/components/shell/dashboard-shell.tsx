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
    <nav className="flex flex-col gap-5">
      {groups.map((g, gi) => (
        <div key={gi}>
          {g.label && <div className="text-muted mb-1 text-[13px]">{g.label}</div>}
          <ul>
            {g.items.map((it) => (
              <li key={it.href}>
                <Link
                  href={it.href}
                  onClick={onNavigate}
                  aria-current={isActive(it) ? "page" : undefined}
                  className="nav-item"
                >
                  <span className="flex-1">{it.label}</span>
                  {it.count !== undefined && it.count !== 0 && (
                    <span className="text-muted text-sm tabular-nums">{it.count}</span>
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
    <div className="mt-7">
      {many ? (
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-haspopup="listbox"
            className="hover:text-accent inline-flex min-h-11 items-center gap-1.5 text-start text-[17px] font-medium"
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
        <div className="min-h-11 pt-2.5 text-[17px] font-medium">{ctx.salon.name}</div>
      )}
      <div className="text-muted mt-0.5 text-[13px]">
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
 * Dashboard / admin shell (DESIGN.md §6): 240px sidebar with no background or border, content
 * with 48px padding (24px next to the sidebar). On phones the sidebar becomes a top row with a
 * menu that opens the same navigation in a sheet.
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
    <div className="min-h-dvh">
      {banner}
      <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="no-scrollbar sticky top-0 h-dvh overflow-y-auto px-12 py-9">
            <SidebarBody groups={groups} ctx={ctx} />
          </div>
        </aside>

        <div className="flex h-14 items-center justify-between px-6 lg:hidden">
          <Wordmark suffix={ctx.variant === "admin" ? t("admin") : undefined} />
          <IconButton aria-label={t("menu")} onClick={() => setOpen(true)} className="-me-3">
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
            <div className="bg-overlay absolute inset-y-0 start-0 w-[300px] max-w-[85vw] overflow-y-auto px-8 py-6 shadow-lg">
              <div className="-me-3 mb-2 flex justify-end">
                <IconButton aria-label={t("menu")} onClick={() => setOpen(false)}>
                  <X />
                </IconButton>
              </div>
              <SidebarBody groups={groups} ctx={ctx} onNavigate={() => setOpen(false)} />
            </div>
          </div>
        )}

        <main id="main" className="min-w-0 px-6 py-6 lg:py-9 lg:ps-6 lg:pe-12">
          {children}
        </main>
      </div>
    </div>
  );
}

/** Page header: muted context line + serif title on the start; text links + one pill on the end. */
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
    <div className={cn("mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4", className)}>
      <div className="min-w-0">
        {context && <div className="text-muted text-[15px]">{context}</div>}
        <h1 className="font-display mt-1 text-[32px] leading-[1.1] lg:text-[38px]">{title}</h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-x-6 gap-y-2">{actions}</div>}
    </div>
  );
}
