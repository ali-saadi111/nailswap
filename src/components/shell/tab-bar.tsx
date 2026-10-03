"use client";

import { Compass, Sparkles, CalendarDays, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Wordmark } from "./wordmark";
import { useMe } from "@/lib/client/use-me";
import { cn } from "@/lib/utils";

const items = [
  {
    key: "discover",
    href: "/",
    icon: Compass,
    match: (p: string) => p === "/" || p.startsWith("/explore") || p.startsWith("/s/"),
  },
  { key: "tryOn", href: "/try", icon: Sparkles, match: (p: string) => p.startsWith("/try") },
  {
    key: "bookings",
    href: "/account/bookings",
    icon: CalendarDays,
    match: (p: string) => p.startsWith("/account/bookings") || p.startsWith("/b/"),
  },
  {
    key: "profile",
    href: "/account",
    icon: User,
    match: (p: string) => p === "/account" || p.startsWith("/account/looks"),
  },
] as const;

/**
 * Consumer navigation: Discover · Try on · Bookings · Profile.
 * Bottom tab bar on phones (icon 24 + label 11/500, active = cocoa, no top border);
 * a quiet top row with text links on wider screens.
 */
export function TabBar() {
  const t = useTranslations("ui.tabs");
  const tc = useTranslations("common");
  const pathname = usePathname();
  const { user } = useMe();

  return (
    <>
      <nav
        aria-label={t("main")}
        className="bg-background safe-bottom fixed inset-x-0 bottom-0 z-40 mx-auto flex h-[84px] w-full max-w-[640px] px-3 pt-1 md:hidden"
      >
        {items.map((it) => {
          const active = it.match(pathname);
          const Icon = it.icon;
          return (
            <Link
              key={it.key}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                active ? "text-accent" : "text-muted hover:text-foreground",
              )}
            >
              <Icon className="size-6" strokeWidth={1.75} />
              <span>{t(it.key)}</span>
            </Link>
          );
        })}
      </nav>

      <nav aria-label={t("main")} className="hidden h-16 items-center justify-between md:flex">
        <Wordmark />
        <div className="flex items-center gap-7">
          {items.map((it) => {
            const active = it.match(pathname);
            return (
              <Link
                key={it.key}
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "text-[15px] font-medium",
                  active ? "text-accent" : "text-muted hover:text-foreground",
                )}
              >
                {t(it.key)}
              </Link>
            );
          })}
          {user ? (
            <Link href="/account" className="text-foreground hover:text-accent text-[15px] font-medium">
              {user.fullName?.split(" ")[0] ?? tc("myAccount")}
            </Link>
          ) : (
            <Link href="/login" className="text-accent hover:text-foreground text-[15px] font-medium">
              {tc("signIn")}
            </Link>
          )}
        </div>
      </nav>
    </>
  );
}
