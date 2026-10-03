"use client";

import * as React from "react";
import { ArrowUpDown, ChevronDown, ChevronRight, Search, Sparkles, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import type { DirectoryItem } from "@/lib/salons/directory";
import type { NextSlot } from "@/lib/salons/next-slots";
import { Avatar, FilterToggle, EmptyState, Tabs } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { openState } from "@/lib/hours";
import { fmtDay, fmtTime, isoDate, money } from "@/lib/format";
import { publicEnv } from "@/lib/env";

type Sort = "recommended" | "nearest" | "topRated";

export function ExploreList({
  items,
  cities,
  nextSlots,
  initialCity,
  initialQuery,
  locale,
}: {
  items: DirectoryItem[];
  cities: { city: string; count: number }[];
  nextSlots: Record<string, NextSlot[]>;
  initialCity: string;
  initialQuery: string;
  locale: string;
}) {
  const t = useTranslations("ui.explore");
  const tc = useTranslations("common");
  const router = useRouter();
  const [q, setQ] = React.useState(initialQuery);
  const [openNow, setOpenNow] = React.useState(false);
  const [rating, setRating] = React.useState(false);
  const [arReady, setArReady] = React.useState(false);
  const [instant, setInstant] = React.useState(false);
  const [sort, setSort] = React.useState<Sort>("recommended");
  const [view, setView] = React.useState<"list" | "map">("list");
  const [limit, setLimit] = React.useState(10);
  const [pos, setPos] = React.useState<{ lat: number; lng: number } | null>(null);

  const now = React.useMemo(() => new Date(), []);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = items.filter((s) => {
      if (needle) {
        const hay = [s.name, s.area, s.city, s.description, ...s.categories]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (openNow && !openState(s.hours, s.timezone, now).open) return false;
      if (rating && !(s.ratingAvg >= 4.5 && s.ratingCount > 0)) return false;
      if (arReady && s.designCount === 0) return false;
      if (instant && s.bookingMode !== "instant") return false;
      return true;
    });
    if (pos) {
      list = list.map((s) => ({
        ...s,
        distanceKm:
          s.lat !== null && s.lng !== null
            ? Math.round(haversineKm(pos.lat, pos.lng, s.lat, s.lng) * 10) / 10
            : null,
      }));
    }
    if (sort === "nearest") list = [...list].sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
    if (sort === "topRated")
      list = [...list].sort((a, b) => b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount);
    return list;
  }, [items, q, openNow, rating, arReady, instant, sort, pos, now]);

  const visible = filtered.slice(0, limit);
  const sortLabel = { recommended: t("recommended"), nearest: t("nearest"), topRated: t("topRated") }[sort];

  function requestLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        setSort("nearest");
      },
      () => undefined,
      { maximumAge: 300_000, timeout: 8000 },
    );
  }

  return (
    <>
      <header className="flex h-[52px] items-center justify-between">
        <h1 className="font-display text-[34px] leading-none">{t("title")}</h1>
        <Tabs
          value={view}
          onChange={setView}
          label={t("view")}
          items={[
            { value: "list", label: t("list") },
            { value: "map", label: t("map") },
          ]}
        />
      </header>

      <label className="border-border-strong mt-2 flex items-center gap-2.5 border-b">
        <Search className="text-muted size-5" strokeWidth={1.75} />
        <span className="sr-only">{t("search")}</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="text-foreground placeholder:text-muted-2 h-12 min-w-0 flex-1 bg-transparent text-base focus-visible:outline-none"
        />
      </label>

      <div
        role="group"
        aria-label={t("filters")}
        className="no-scrollbar -me-6 mt-1 flex gap-[18px] overflow-x-auto pe-6"
      >
        <FilterToggle pressed={openNow} onClick={() => setOpenNow((v) => !v)}>
          {t("openNow")}
        </FilterToggle>
        <FilterToggle pressed={rating} onClick={() => setRating((v) => !v)}>
          {t("rating45")}
        </FilterToggle>
        <FilterToggle pressed={arReady} onClick={() => setArReady((v) => !v)}>
          {t("arReadyFilter")}
        </FilterToggle>
        <FilterToggle pressed={instant} onClick={() => setInstant((v) => !v)}>
          {t("instant")}
        </FilterToggle>
      </div>

      <div className="flex items-center justify-between">
        <label className="relative inline-flex min-h-11 items-center gap-1.5 text-sm font-medium">
          <span>{initialCity ? t("area", { area: initialCity }) : t("allAreas")}</span>
          <ChevronDown className="text-muted size-4" />
          <select
            aria-label={t("category")}
            value={initialCity}
            onChange={(e) =>
              router.replace(
                e.target.value ? `/explore?city=${encodeURIComponent(e.target.value)}` : "/explore",
              )
            }
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            <option value="">{t("allAreas")}</option>
            {cities.map((c) => (
              <option key={c.city} value={c.city}>
                {c.city} ({c.count})
              </option>
            ))}
          </select>
        </label>
        <label className="relative inline-flex min-h-11 items-center gap-1.5 text-sm font-medium">
          <ArrowUpDown className="text-muted size-4" />
          <span>{t("sort", { sort: sortLabel })}</span>
          <select
            aria-label={t("sort", { sort: "" })}
            value={sort}
            onChange={(e) => {
              const v = e.target.value as Sort;
              setSort(v);
              if (v === "nearest" && !pos) requestLocation();
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            <option value="recommended">{t("recommended")}</option>
            <option value="nearest">{t("nearest")}</option>
            <option value="topRated">{t("topRated")}</option>
          </select>
        </label>
      </div>

      {view === "map" && (
        <p className="text-muted mt-2 text-sm">{publicEnv.mapboxToken ? t("mapSoon") : t("mapSoon")}</p>
      )}

      {visible.length === 0 ? (
        <EmptyState
          title={t("noResults")}
          description={t("noResultsBody")}
          action={
            <Button
              variant="link"
              onClick={() => {
                setQ("");
                setOpenNow(false);
                setRating(false);
                setArReady(false);
                setInstant(false);
                if (initialCity) router.replace("/explore");
              }}
            >
              {t("clearFilters")}
            </Button>
          }
        />
      ) : (
        <div className="mt-2">
          {visible.map((s) => (
            <SalonCard key={s.id} s={s} slots={nextSlots[s.id] ?? []} locale={locale} />
          ))}
        </div>
      )}

      {filtered.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((n) => n + 20)}
          className="text-accent hover:text-foreground mt-2 inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-medium"
        >
          {t("showAll", { count: filtered.length })}
          <ChevronRight className="size-4 rtl:-scale-x-100" />
        </button>
      )}

      {!pos && (
        <button
          type="button"
          onClick={requestLocation}
          className="text-muted hover:text-foreground mt-1 inline-flex min-h-11 items-center self-start text-sm"
        >
          {t("useLocation")}
        </button>
      )}
      <span className="sr-only">{tc("loading")}</span>
    </>
  );
}

function SalonCard({ s, slots, locale }: { s: DirectoryItem; slots: NextSlot[]; locale: string }) {
  const t = useTranslations("ui.explore");
  const tc = useTranslations("common");
  const today = isoDate(new Date(), s.timezone);
  return (
    <article className="border-border flex items-start gap-3.5 border-b pt-[18px] pb-2">
      <Link href={`/s/${s.slug}`} className="shrink-0">
        <Avatar name={s.name} src={s.logoUrl} size={48} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate text-base leading-[22px] font-semibold">
            <Link href={`/s/${s.slug}`} className="hover:text-accent">
              {s.name}
            </Link>
          </h3>
          {s.fromPrice !== null && (
            <span className="text-muted shrink-0 text-sm">
              {tc("from").toLowerCase()}{" "}
              <b className="text-foreground font-semibold">{money(s.fromPrice, "USD", locale)}</b>
            </span>
          )}
        </div>
        <div className="text-muted mt-0.5 text-[13px]">
          {[s.area ?? s.city, s.distanceKm !== null ? t("km", { km: s.distanceKm }) : null]
            .filter(Boolean)
            .join(" · ")}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-[13px]">
          {s.ratingCount > 0 ? (
            <>
              <Star className="text-accent size-3.5 fill-current" strokeWidth={1.5} />
              <b className="font-semibold">{s.ratingAvg.toFixed(1)}</b>
              <span className="text-muted">({s.ratingCount})</span>
            </>
          ) : (
            <span className="text-muted">{t("designs", { count: s.designCount })}</span>
          )}
          {s.designCount > 0 && (
            <span className="text-muted ms-3 inline-flex items-center gap-1">
              <Sparkles className="text-accent size-3.5" strokeWidth={1.75} />
              {t("arReady")}
            </span>
          )}
        </div>
        {slots.length > 0 && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-4">
            <span className="text-muted text-[13px]">{t("next")}</span>
            {slots.map((sl) => {
              const day = isoDate(new Date(sl.startsAt), s.timezone);
              const label =
                day === today
                  ? `${tc("today")} ${fmtTime(sl.startsAt, locale, s.timezone)}`
                  : `${fmtDay(sl.startsAt, locale, s.timezone, { weekday: "short" })} ${fmtTime(sl.startsAt, locale, s.timezone)}`;
              return (
                <Link
                  key={sl.startsAt}
                  href={`/s/${s.slug}/book?serviceId=${sl.serviceId}&date=${day}&startsAt=${encodeURIComponent(sl.startsAt)}`}
                  className="text-accent hover:text-foreground min-h-11 text-sm leading-[44px] font-medium"
                  dir="ltr"
                >
                  {label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </article>
  );
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
