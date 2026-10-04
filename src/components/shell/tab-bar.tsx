"use client";

import { Bookmark, CalendarDays, MapPin, Sparkles, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Wordmark } from "./wordmark";
import { useMe } from "@/lib/client/use-me";
import { cn } from "@/lib/utils";

const items = [
  {
    key: "discover",
    href: "/",
    icon: MapPin,
    match: (p: string) => p === "/" || p.startsWith("/explore") || p.startsWith("/s/"),
  },
  {
    key: "looks",
    href: "/account/looks",
    icon: Bookmark,
    match: (p: string) => p.startsWith("/account/looks"),
  },
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
    match: (p: string) => p === "/account",
  },
] as const;

/**
 * Consumer navigation (Blush Immersive).
 * Phones: a floating surface bar — Salons · Looks · [Try on] · Bookings · Profile — with the
 * try-on camera as a raised rose button in the middle. Wider screens: a quiet top row of pills.
 */
export function TabBar() {
  const t = useTranslations("ui.tabs");
  const tc = useTranslations("common");
  const pathname = usePathname();
  const { user } = useMe();
  const tryActive = pathname.startsWith("/try");
  const [left, right] = [items.slice(0, 2), items.slice(2)];

  const tab = (it: (typeof items)[number]) => {
    const active = it.match(pathname);
    const Icon = it.icon;
    return (
      <Link
        key={it.key}
        href={it.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-11 flex-col items-center justify-center gap-0.5 text-[11px]",
          active ? "text-accent font-extrabold" : "text-muted hover:text-foreground font-bold",
        )}
      >
        <Icon className="size-[22px]" strokeWidth={active ? 2.2 : 1.8} />
        <span>{t(it.key)}</span>
      </Link>
    );
  };

  return (
    <>
      {/* The try-on camera is full-screen: no floating bar over its controls. */}
      {!tryActive && (
        <nav
          aria-label={t("main")}
          className="consumer-tabs bg-surface fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 mx-auto grid min-h-[68px] max-w-[600px] grid-cols-5 items-center rounded-[26px] px-1 py-2 shadow-lg md:hidden"
        >
          {left.map(tab)}
          <Link
            href="/try"
            aria-label={t("tryOn")}
            aria-current={tryActive ? "page" : undefined}
            className="bg-accent text-accent-contrast hover:bg-accent-hover -mt-7 inline-flex size-[62px] items-center justify-center justify-self-center rounded-full shadow-[0_0_0_6px_var(--background),0_12px_24px_-8px_rgb(158_90_85/0.6)] transition-colors"
          >
            <Sparkles className="size-[26px]" strokeWidth={2} />
          </Link>
          {right.map(tab)}
        </nav>
      )}

      <nav
        aria-label={t("main")}
        className="hidden min-h-16 flex-wrap items-center justify-between gap-3 py-3 md:flex"
      >
        <Wordmark />
        <div className="flex flex-wrap items-center gap-2">
          {items.map((it) => {
            const active = it.match(pathname);
            return (
              <Link
                key={it.key}
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-10 items-center rounded-full px-4 text-[15px] font-bold transition-colors",
                  active ? "bg-foreground text-background" : "text-muted hover:text-foreground",
                )}
              >
                {t(it.key)}
              </Link>
            );
          })}
          <Link
            href="/try"
            className="bg-accent text-accent-contrast hover:bg-accent-hover ms-2 inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[15px] font-bold"
          >
            <Sparkles className="size-[18px]" strokeWidth={2} />
            {t("tryOn")}
          </Link>
          {user ? (
            <Link
              href="/account"
              aria-label={tc("myAccount")}
              className="bg-accent-soft text-accent ms-1 inline-flex size-10 items-center justify-center rounded-full text-sm font-extrabold"
            >
              {(user.fullName ?? tc("myAccount")).slice(0, 1).toUpperCase()}
            </Link>
          ) : (
            <Link href="/login" className="text-accent hover:text-foreground ms-1 text-[15px] font-bold">
              {tc("signIn")}
            </Link>
          )}
        </div>
      </nav>
    </>
  );
}
