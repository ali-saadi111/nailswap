"use client";

import { useMemo, useState } from "react";
import { MapPin, LocateFixed, Search, ArrowUpRight, Star, Camera, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { DirectoryItem } from "@/lib/salons/directory";
import { openState } from "@/lib/hours";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Avatar, StatusDot } from "@/components/ui/primitives";
import { NailHeroRow } from "@/components/nails/nail";
import { SalonMap } from "./salon-map";

/**
 * Home (Blush Immersive): a full-bleed try-on hero with a frosted call to action, then salon
 * discovery — search pill, filter chips, the map in a rounded media frame and salon cards.
 */
export function DiscoverSalons({
  items,
  loadError = false,
  initialQuery = "",
}: {
  items: DirectoryItem[];
  loadError?: boolean;
  initialQuery?: string;
}) {
  const t = useTranslations("discovery");
  const th = useTranslations("ui.home");
  const locale = useLocale();
  const [query, setQuery] = useState(initialQuery);
  const [city, setCity] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const filtered = useMemo(
    () =>
      items.filter(
        (s) =>
          (!city || s.city === city) &&
          (!onlyOpen || openState(s.hours, s.timezone).open) &&
          `${s.name} ${s.city ?? ""} ${s.area ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [items, query, city, onlyOpen],
  );
  const active = filtered.find((s) => s.id === selected) ?? filtered[0];
  function locate() {
    if (!navigator.geolocation) return setLocationError(true);
    setLocating(true);
    setLocationError(false);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPosition({ lat: p.coords.latitude, lng: p.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocationError(true);
        setLocating(false);
      },
      { timeout: 10000 },
    );
  }
  const cities = Array.from(new Set(items.map((s) => s.city).filter(Boolean))) as string[];

  return (
    <div className="pb-3">
      {/* ── Hero: the product is the picture ─────────────────────────────── */}
      <section
        aria-labelledby="home-hero-title"
        className="bg-hero relative -mx-6 -mt-3 flex min-h-[420px] flex-col overflow-hidden rounded-b-[36px] px-3 pt-4 pb-3 md:mx-0 md:mt-2 md:min-h-[380px] md:rounded-[36px]"
      >
        <div className="flex items-center justify-between gap-3 px-1">
          <span className="glass inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-bold">
            <Sparkles className="text-accent size-4" strokeWidth={2.2} />
            {t("eyebrow")}
          </span>
          <Link
            href="/dashboard"
            className="glass hover:text-accent inline-flex h-10 items-center rounded-full px-4 text-[13px] font-bold"
          >
            {t("merchant")}
          </Link>
        </div>

        <div aria-hidden className="flex flex-1 items-end justify-center px-6 pt-8 pb-6">
          <NailHeroRow size={54} gap={12} className="max-w-[360px] flex-1 -rotate-6" />
        </div>

        <div className="glass rounded-[28px] p-4 md:max-w-md">
          <p className="text-accent-hover text-[13px] font-bold">{th("steps")}</p>
          <h1
            id="home-hero-title"
            className="font-display mt-1 text-[28px] leading-[1.05] font-extrabold md:text-[32px]"
          >
            {th("title")}
          </h1>
          <div className="mt-4 flex gap-2.5">
            <Link
              href="/try"
              className="bg-accent text-accent-contrast hover:bg-accent-hover inline-flex h-[52px] flex-1 items-center justify-center gap-2 rounded-full text-base font-bold"
            >
              <Camera className="size-5" strokeWidth={2} />
              {th("tryCta")}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Find a salon ──────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between gap-4 pt-7 pb-3">
        <div>
          <h2 className="font-display text-[26px] leading-tight md:text-3xl">{t("title")}</h2>
          <p className="text-muted mt-1 text-sm">{t("subtitle")}</p>
        </div>
      </div>

      <label className="bg-surface flex h-14 items-center gap-2.5 rounded-full ps-5 pe-1.5 shadow-sm">
        <Search className="text-muted size-5 shrink-0" strokeWidth={2} />
        <input
          aria-label={t("search")}
          placeholder={t("search")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="placeholder:text-muted-2 h-12 min-w-0 flex-1 bg-transparent text-[15px] font-semibold outline-none"
        />
        <button
          type="button"
          onClick={locate}
          disabled={locating}
          aria-label={t("nearMe")}
          title={t("nearMe")}
          className="bg-accent-soft text-accent hover:bg-accent hover:text-accent-contrast inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-60"
        >
          <LocateFixed className="size-5" strokeWidth={2} />
        </button>
      </label>

      <div className="no-scrollbar -me-6 mt-3 mb-4 flex items-center gap-2 overflow-x-auto pe-6">
        <button
          type="button"
          onClick={() => setOnlyOpen(!onlyOpen)}
          aria-pressed={onlyOpen}
          className={cn(
            "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-bold transition-colors",
            onlyOpen ? "bg-foreground text-background" : "bg-surface text-foreground hover:text-accent",
          )}
        >
          {t("openNow")}
        </button>
        <label className="bg-surface relative inline-flex h-10 shrink-0 items-center rounded-full text-sm font-bold">
          <span className="sr-only">{t("area")}</span>
          <select
            value={city}
            aria-label={t("area")}
            onChange={(e) => setCity(e.target.value)}
            className="h-10 cursor-pointer appearance-none rounded-full bg-transparent ps-4 pe-9 outline-none"
          >
            <option value="">{t("allAreas")}</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <MapPin className="text-muted pointer-events-none absolute end-3 size-4" strokeWidth={2} />
        </label>
        {cities.slice(0, 4).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCity(city === c ? "" : c)}
            aria-pressed={city === c}
            className={cn(
              "inline-flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-bold transition-colors",
              city === c ? "bg-foreground text-background" : "bg-surface text-foreground hover:text-accent",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {locationError && (
        <p role="status" className="text-muted mb-3 text-sm">
          {t("locationError")}
        </p>
      )}
      {loadError && (
        <p role="alert" className="text-danger mb-4 text-sm font-semibold">
          {t("loadError")}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-[1fr_340px]">
        <div className="relative h-[56dvh] min-h-[400px] md:sticky md:top-4 md:h-[68dvh]">
          <SalonMap
            items={filtered}
            selected={active?.id ?? null}
            onSelect={setSelected}
            position={position}
          />
          {active && (
            <div className="glass absolute inset-x-3 bottom-3 z-10 rounded-[26px] p-3 shadow-lg md:hidden">
              <div className="flex items-center gap-3">
                <Avatar name={active.name} src={active.logoUrl} size={48} />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-extrabold">{active.name}</h2>
                  <p className="text-muted mt-0.5 truncate text-[13px] font-semibold">
                    {[active.area, active.city].filter(Boolean).join(", ")}
                    {active.ratingCount ? ` · ★ ${active.ratingAvg.toFixed(1)}` : ""}
                  </p>
                </div>
              </div>
              <Link
                href={`/s/${active.slug}`}
                className="bg-accent text-accent-contrast hover:bg-accent-hover mt-3 flex min-h-12 items-center justify-center gap-2 rounded-full text-[15px] font-bold"
              >
                {t("viewSalon")}
                <ArrowUpRight className="size-4 rtl:-scale-x-100" strokeWidth={2.2} />
              </Link>
            </div>
          )}
        </div>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1 text-sm">
            <span className="font-extrabold">{t("salonCount", { count: filtered.length })}</span>
            <span className="text-muted font-semibold">{t("tapPin")}</span>
          </div>
          {active && (
            <article
              className="bg-surface hidden overflow-hidden rounded-[28px] shadow-sm md:block"
              aria-live="polite"
            >
              {(active.featuredCovers[0] || active.coverUrl) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={active.featuredCovers[0] || active.coverUrl!}
                  alt={active.name}
                  className="h-44 w-full object-cover"
                />
              )}
              <div className="p-4">
                <h2 className="text-lg font-extrabold">{active.name}</h2>
                <p className="text-muted mt-1 flex items-center gap-1 text-sm font-semibold">
                  <MapPin className="size-3.5" />
                  {[active.area, active.city].filter(Boolean).join(", ")}
                </p>
                <div className="mt-3 flex items-center justify-between text-sm font-bold">
                  <span className="flex items-center gap-1">
                    <Star className="text-accent size-4 fill-current" strokeWidth={1.5} />
                    {active.ratingCount
                      ? `${active.ratingAvg.toFixed(1)} (${active.ratingCount})`
                      : t("newSalon")}
                  </span>
                  {active.fromPrice !== null && (
                    <span>{t("from", { price: money(active.fromPrice, "USD", locale) })}</span>
                  )}
                </div>
                <Link
                  href={`/s/${active.slug}`}
                  className="bg-accent text-accent-contrast hover:bg-accent-hover mt-4 flex min-h-12 items-center justify-center gap-2 rounded-full px-4 text-[15px] font-bold"
                >
                  {t("viewSalon")}
                  <ArrowUpRight className="size-4 rtl:-scale-x-100" strokeWidth={2.2} />
                </Link>
              </div>
            </article>
          )}
          {filtered
            .filter((s) => s.id !== active?.id)
            .map((s) => {
              const open = openState(s.hours, s.timezone).open;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelected(s.id)}
                  className="bg-surface hover:text-accent flex w-full items-center gap-3 rounded-[22px] p-3 text-start transition-colors"
                >
                  <Avatar name={s.name} src={s.logoUrl} size={48} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-extrabold">{s.name}</span>
                    <span className="text-muted mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] font-semibold">
                      <span>{s.area ?? s.city}</span>
                      {s.ratingCount > 0 && <span>★ {s.ratingAvg.toFixed(1)}</span>}
                      {s.fromPrice !== null && (
                        <span>{t("from", { price: money(s.fromPrice, "USD", locale) })}</span>
                      )}
                    </span>
                    {open && (
                      <StatusDot tone="success" className="mt-1 text-[12px] font-bold">
                        {t("openNow")}
                      </StatusDot>
                    )}
                  </span>
                  <ArrowUpRight className="text-muted size-4 shrink-0 rtl:-scale-x-100" />
                </button>
              );
            })}
          {!filtered.length && (
            <div className="bg-surface rounded-[26px] p-5 text-center">
              <p className="font-semibold">{t("empty")}</p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setCity("");
                  setOnlyOpen(false);
                }}
                className="text-accent hover:text-foreground mt-2 min-h-11 font-bold"
              >
                {t("reset")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
