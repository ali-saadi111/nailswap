"use client";

import { useMemo, useState } from "react";
import { MapPin, LocateFixed, Search, ArrowUpRight, Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { DirectoryItem } from "@/lib/salons/directory";
import { openState } from "@/lib/hours";
import { money } from "@/lib/format";
import { SalonMap } from "./salon-map";

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
  return (
    <div className="pb-3">
      <div className="flex items-start justify-between gap-4 pt-3 pb-5">
        <div>
          <p className="text-accent mb-2 text-xs font-semibold tracking-[0.18em] uppercase">{t("eyebrow")}</p>
          <h1 className="font-display text-3xl md:text-4xl">{t("title")}</h1>
          <p className="text-muted mt-2 text-sm">{t("subtitle")}</p>
        </div>
        <Link href="/dashboard" className="text-accent shrink-0 pt-2 text-xs font-semibold md:text-sm">
          {t("merchant")}
        </Link>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="border-border flex min-w-[180px] flex-1 items-center gap-2 rounded-2xl border bg-white px-4">
          <Search className="text-muted size-5" />
          <input
            aria-label={t("search")}
            placeholder={t("search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-12 w-full bg-transparent text-sm outline-none"
          />
        </label>
        <select
          value={city}
          aria-label={t("area")}
          onChange={(e) => setCity(e.target.value)}
          className="border-border h-12 rounded-2xl border bg-white px-3 text-sm"
        >
          <option value="">{t("allAreas")}</option>
          {Array.from(new Set(items.map((s) => s.city).filter(Boolean))).map((c) => (
            <option key={c!} value={c!}>
              {c}
            </option>
          ))}
        </select>
        <button
          onClick={() => setOnlyOpen(!onlyOpen)}
          aria-pressed={onlyOpen}
          className={`border-border h-12 rounded-2xl border px-4 text-sm ${onlyOpen ? "bg-accent text-white" : "bg-white"}`}
        >
          {t("openNow")}
        </button>
        <button
          onClick={locate}
          disabled={locating}
          aria-label={t("nearMe")}
          title={t("nearMe")}
          className="border-border flex size-12 items-center justify-center rounded-2xl border bg-white"
        >
          <LocateFixed className="size-5" />
        </button>
      </div>
      {locationError && (
        <p role="status" className="text-muted mb-3 text-sm">
          {t("locationError")}
        </p>
      )}
      {loadError && (
        <p role="alert" className="mb-4 text-sm">
          {t("loadError")}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-[1fr_320px]">
        <div className="relative h-[56dvh] min-h-[400px] md:sticky md:top-4 md:h-[68dvh]">
          <SalonMap
            items={filtered}
            selected={active?.id ?? null}
            onSelect={setSelected}
            position={position}
          />
          {active && (
            <div className="absolute inset-x-3 bottom-8 z-10 rounded-2xl border border-white bg-white/95 p-3 shadow-lg md:hidden">
              <h2 className="truncate text-base font-semibold">{active.name}</h2>
              <p className="text-muted mt-1 text-xs">
                {[active.area, active.city].filter(Boolean).join(", ")}
              </p>
              <Link
                href={`/s/${active.slug}`}
                className="bg-accent mt-2 flex min-h-11 items-center justify-center gap-2 rounded-full text-sm font-semibold text-white"
              >
                {t("viewSalon")}
                <ArrowUpRight className="size-4" />
              </Link>
            </div>
          )}
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">{t("salonCount", { count: filtered.length })}</span>
            <span className="text-muted">{t("tapPin")}</span>
          </div>
          {active && (
            <article
              className="border-border hidden overflow-hidden rounded-3xl border bg-white shadow-sm md:block"
              aria-live="polite"
            >
              {(active.featuredCovers[0] || active.coverUrl) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={active.featuredCovers[0] || active.coverUrl!}
                  alt={active.name}
                  className="h-40 w-full object-cover"
                />
              )}
              <div className="p-4">
                <h2 className="text-lg font-semibold">{active.name}</h2>
                <p className="text-muted mt-1 flex items-center gap-1 text-sm">
                  <MapPin className="size-3.5" />
                  {[active.area, active.city].filter(Boolean).join(", ")}
                </p>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1">
                    <Star className="size-4" />
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
                  className="bg-accent mt-4 flex min-h-12 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold text-white"
                >
                  {t("viewSalon")}
                  <ArrowUpRight className="size-4" />
                </Link>
              </div>
            </article>
          )}
          {filtered
            .filter((s) => s.id !== active?.id)
            .map((s) => (
              <button
                key={s.id}
                onClick={() => setSelected(s.id)}
                className="border-border flex w-full items-center gap-3 rounded-2xl border bg-white p-3 text-start"
              >
                <MapPin className="text-accent size-5 shrink-0" />
                <span className="flex-1">
                  <span className="block text-sm font-semibold">{s.name}</span>
                  <span className="text-muted text-xs">{s.area ?? s.city}</span>
                </span>
                <ArrowUpRight className="size-4" />
              </button>
            ))}
          {!filtered.length && (
            <div className="border-border rounded-2xl border p-5">
              <p>{t("empty")}</p>
              <button
                onClick={() => {
                  setQuery("");
                  setCity("");
                  setOnlyOpen(false);
                }}
                className="text-accent mt-3 min-h-11 font-semibold"
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
