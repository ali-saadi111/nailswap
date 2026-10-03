"use client";

import * as React from "react";
import { Check, ChevronLeft, Navigation, Plus, Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Salon } from "@/lib/supabase/types";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Label, Select, Switch, Textarea } from "@/components/ui/input";
import { Notice } from "@/components/ui/primitives";
import { api, isApiError } from "@/lib/client/api";
import { BRAND_COLORS, DEFAULT_SERVICES, STAFF_COLORS, uploadMedia } from "@/lib/client/dashboard";
import { refreshMe } from "@/lib/client/use-me";
import { slugify } from "@/lib/utils";
import { cn } from "@/lib/utils";

type HourRow = { weekday: number; open_time: string | null; close_time: string | null; is_closed: boolean };

interface Existing {
  hours: HourRow[];
  services: { id: string; name: string; category: string; price: number; duration_min: number }[];
  staff: { id: string; display_name: string; color: string }[];
  designs: { id: string; name: string; cover_path: string | null }[];
}

const STEP_KEYS = ["details", "location", "services", "designs", "staff", "live"] as const;
const WEEK = [1, 2, 3, 4, 5, 6, 0];

export function Wizard({
  locale,
  salon: initialSalon,
  publicUrl,
  initialStep,
  existing,
}: {
  locale: string;
  salon: Salon | null;
  publicUrl: string | null;
  initialStep?: number;
  existing: Existing;
}) {
  const t = useTranslations("onboarding");
  const td = useTranslations("ui.dash.wizard");
  const tc = useTranslations("common");
  const tcat = useTranslations("catalog");
  const tcats = useTranslations("catalog.serviceCategories");
  const texp = useTranslations("explore.categories");
  const tstaff = useTranslations("staffPage");
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [salon, setSalon] = React.useState<Salon | null>(initialSalon);
  const startStep =
    initialStep ?? (initialSalon ? Math.min(5, Math.max(0, initialSalon.onboarding_step)) : 0);
  const [step, setStep] = React.useState(startStep);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Step 1
  const [name, setName] = React.useState(initialSalon?.name ?? "");
  const [slug, setSlug] = React.useState(initialSalon?.slug ?? "");
  const [slugTouched, setSlugTouched] = React.useState(Boolean(initialSalon));
  const [slugCheck, setSlugCheck] = React.useState<{
    slug: string;
    state: "checking" | "free" | "taken";
  } | null>(null);
  const slugNeedsCheck = slug.length >= 3 && !(salon && salon.slug === slug);
  const slugState: "idle" | "checking" | "free" | "taken" = !slugNeedsCheck
    ? "idle"
    : slugCheck?.slug === slug
      ? slugCheck.state
      : "checking";
  const [phone, setPhone] = React.useState(initialSalon?.phone ?? "");
  const [whatsapp, setWhatsapp] = React.useState(initialSalon?.whatsapp_number ?? "");
  const [instagram, setInstagram] = React.useState(initialSalon?.instagram ?? "");
  const [brand, setBrand] = React.useState(initialSalon?.brand_color ?? BRAND_COLORS[0]);
  const [description, setDescription] = React.useState(initialSalon?.description ?? "");
  const [logoPath, setLogoPath] = React.useState(initialSalon?.logo_path ?? null);
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null);

  // Step 2
  const [address, setAddress] = React.useState(initialSalon?.address ?? "");
  const [area, setArea] = React.useState(initialSalon?.area ?? "");
  const [city, setCity] = React.useState(initialSalon?.city ?? "Beirut");
  const [coords, setCoords] = React.useState<{ lat: number; lng: number } | null>(
    initialSalon?.lat !== null && initialSalon?.lat !== undefined && initialSalon.lng !== null
      ? { lat: initialSalon.lat, lng: initialSalon.lng }
      : null,
  );
  const [hours, setHours] = React.useState<HourRow[]>(() =>
    WEEK.map((wd) => {
      const h = existing.hours.find((x) => x.weekday === wd);
      return h
        ? {
            ...h,
            open_time: h.open_time?.slice(0, 5) ?? "10:00",
            close_time: h.close_time?.slice(0, 5) ?? "20:00",
          }
        : { weekday: wd, open_time: "10:00", close_time: "20:00", is_closed: wd === 1 };
    }),
  );

  // Step 3
  const [services, setServices] = React.useState(() =>
    existing.services.length
      ? existing.services.map((s) => ({
          key: s.id,
          name: s.name,
          category: s.category,
          price: s.price,
          duration: s.duration_min,
          on: true,
          existing: true,
        }))
      : DEFAULT_SERVICES.map((s, i) => ({
          key: `d${i}`,
          name: s.name,
          category: s.category as string,
          price: s.price,
          duration: s.duration,
          on: true,
          existing: false,
        })),
  );

  // Step 4
  const [designs, setDesigns] = React.useState<
    { id?: string; name: string; path: string | null; url: string | null; category: string }[]
  >(
    existing.designs.map((d) => ({
      id: d.id,
      name: d.name,
      path: d.cover_path,
      url: null,
      category: "minimal",
    })),
  );
  const [uploading, setUploading] = React.useState(false);

  // Step 5
  const [staff, setStaff] = React.useState<{ id?: string; name: string; phone: string; color: string }[]>(
    existing.staff.length
      ? existing.staff.map((s) => ({ id: s.id, name: s.display_name, phone: "", color: s.color }))
      : [{ name: "", phone: "", color: STAFF_COLORS[0] }],
  );

  React.useEffect(() => {
    if (!slugNeedsCheck) return;
    const id = setTimeout(async () => {
      const { data } = await supabase.from("salons").select("id").eq("slug", slug).maybeSingle();
      setSlugCheck({ slug, state: data && data.id !== salon?.id ? "taken" : "free" });
    }, 400);
    return () => clearTimeout(id);
  }, [slug, slugNeedsCheck, salon, supabase]);

  async function persistStep(n: number) {
    if (!salon) return;
    await supabase
      .from("salons")
      .update({ onboarding_step: Math.max(salon.onboarding_step, n) })
      .eq("id", salon.id);
  }

  function fail(err: unknown) {
    if (isApiError(err, "already_exists")) setError(t("slugTaken"));
    else setError(err instanceof Error && err.message ? err.message : tc("somethingWrong"));
  }

  async function saveDetails() {
    if (name.trim().length < 2) return setError(t("salonName"));
    if (slugState === "taken") return setError(t("slugTaken"));
    setBusy(true);
    setError(null);
    try {
      let current = salon;
      if (!current) {
        const r = await api.post<{ salon: { id: string } }>("/api/dashboard/salons", {
          name: name.trim(),
          slug: slug || undefined,
          city: city || undefined,
          defaultLocale: locale,
          brandColor: brand,
        });
        await refreshMe();
        const { data } = await supabase.from("salons").select("*").eq("id", r.salon.id).single();
        current = data;
        setSalon(data);
      }
      if (!current) throw new Error("salon_missing");
      const { error: e } = await supabase
        .from("salons")
        .update({
          name: name.trim(),
          slug: slug || current.slug,
          phone: phone.trim() || null,
          whatsapp_number: whatsapp.trim() || null,
          instagram: instagram.trim().replace(/^@/, "") || null,
          brand_color: brand,
          description: description.trim() || null,
          logo_path: logoPath,
          onboarding_step: Math.max(current.onboarding_step, 1),
        })
        .eq("id", current.id);
      if (e) throw e;
      setSalon({ ...current, name: name.trim(), slug: slug || current.slug });
      setStep(1);
      router.refresh();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function saveLocation() {
    if (!salon) return;
    setBusy(true);
    setError(null);
    try {
      const { error: e1 } = await supabase
        .from("salons")
        .update({
          address: address.trim() || null,
          area: area.trim() || null,
          city: city.trim() || null,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
        })
        .eq("id", salon.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("salon_hours").upsert(
        hours.map((h) => ({
          salon_id: salon.id,
          weekday: h.weekday,
          is_closed: h.is_closed,
          open_time: h.is_closed ? null : h.open_time,
          close_time: h.is_closed ? null : h.close_time,
        })),
        { onConflict: "salon_id,weekday" },
      );
      if (e2) throw e2;
      await persistStep(2);
      setStep(2);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function saveServices() {
    if (!salon) return;
    const chosen = services.filter((s) => s.on && s.name.trim());
    if (!chosen.length) return setError(t("servicesHint"));
    setBusy(true);
    setError(null);
    try {
      const fresh = chosen.filter((s) => !s.existing);
      if (fresh.length) {
        const { error: e } = await supabase.from("services").insert(
          fresh.map((s, i) => ({
            salon_id: salon.id,
            name: s.name.trim(),
            category: s.category as never,
            price: s.price,
            duration_min: s.duration,
            sort_order: i,
          })),
        );
        if (e) throw e;
      }
      await persistStep(3);
      setStep(3);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function onDesignFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (!salon) return;
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const f of files) {
        const r = await uploadMedia(salon.id, f, "design");
        setDesigns((d) => [
          ...d,
          {
            name: f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
            path: r.path,
            url: r.url,
            category: "minimal",
          },
        ]);
      }
    } catch (err) {
      fail(err);
    } finally {
      setUploading(false);
    }
  }

  async function saveDesigns() {
    if (!salon) return;
    setBusy(true);
    setError(null);
    try {
      const fresh = designs.filter((d) => !d.id && d.name.trim());
      if (fresh.length) {
        const { error: e } = await supabase.from("designs").insert(
          fresh.map((d, i) => ({
            salon_id: salon.id,
            name: d.name.trim(),
            slug: `${slugify(d.name)}-${Math.random().toString(36).slice(2, 6)}`,
            category: d.category as never,
            cover_path: d.path,
            is_visible: true,
            sort_order: i,
          })),
        );
        if (e) throw e;
      }
      await persistStep(4);
      setStep(4);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function saveStaff() {
    if (!salon) return;
    const rows = staff.filter((s) => s.name.trim());
    if (!rows.length) return setError(t("teamHint"));
    setBusy(true);
    setError(null);
    try {
      const { data: svc } = await supabase.from("services").select("id").eq("salon_id", salon.id);
      for (const [i, s] of rows.entries()) {
        if (s.id) continue;
        const { data: created, error: e } = await supabase
          .from("staff")
          .insert({ salon_id: salon.id, display_name: s.name.trim(), color: s.color, sort_order: i })
          .select("id")
          .single();
        if (e) throw e;
        if (svc?.length)
          await supabase
            .from("staff_services")
            .insert(svc.map((x) => ({ staff_id: created.id, service_id: x.id })));
        const work = hours
          .filter((h) => !h.is_closed)
          .map((h) => ({
            staff_id: created.id,
            weekday: h.weekday,
            kind: "work" as const,
            start_time: h.open_time!,
            end_time: h.close_time!,
          }));
        if (work.length) await supabase.from("staff_schedule_rules").insert(work);
        if (s.phone.trim()) {
          await api
            .post(`/api/dashboard/${salon.id}/members`, {
              phone: s.phone.trim(),
              fullName: s.name.trim(),
              role: "staff",
              staffId: created.id,
            })
            .catch(() => undefined);
        }
      }
      await persistStep(5);
      await goLive();
      setStep(5);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function goLive() {
    if (!salon || salon.onboarding_completed_at) return;
    const at = new Date().toISOString();
    await supabase
      .from("salons")
      .update({ onboarding_completed_at: at, onboarding_step: 6 })
      .eq("id", salon.id);
    setSalon({ ...salon, onboarding_completed_at: at });
    router.refresh();
  }

  const stepLabels = t.raw("steps") as string[];
  const labels = [
    stepLabels[0],
    td("locationTitle"),
    stepLabels[1],
    stepLabels[4],
    stepLabels[2],
    stepLabels[6],
  ];
  const subtitles = [
    t("brandingTitle"),
    td("locationSub"),
    t("servicesHint"),
    t("designsHint"),
    t("teamHint"),
    t("liveBody"),
  ];
  const titles = [
    td("detailsHeading"),
    td("locationHeading"),
    t("servicesTitle"),
    t("designsTitle"),
    t("teamTitle"),
    t("liveTitle"),
  ];
  const progress = ((step + 1) / STEP_KEYS.length) * 100;
  const timeInput = "field h-11 w-[92px] text-[15px] tabular-nums";

  return (
    <div className="lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-12">
      <aside className="mb-8 lg:mb-0">
        <div className="text-muted text-[15px] leading-6">
          {salon ? td("setupFor", { name: salon.name }) : t("subtitle")}
        </div>
        <ol className="mt-8 space-y-6">
          {labels.map((label, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li key={i} className="flex items-start gap-4">
                <span
                  className={cn(
                    "w-5 shrink-0 text-center text-[15px] font-medium",
                    done ? "text-success" : active ? "text-foreground" : "text-muted",
                  )}
                >
                  {done ? <Check className="mx-auto size-[18px]" strokeWidth={2.2} /> : i + 1}
                </span>
                <div>
                  <button
                    type="button"
                    disabled={!salon || i > Math.max(step, salon.onboarding_step)}
                    onClick={() => setStep(i)}
                    className={cn(
                      "text-start text-[17px] leading-6",
                      active ? "font-semibold" : done ? "text-foreground" : "text-muted",
                      "disabled:cursor-default",
                    )}
                  >
                    {label}
                  </button>
                  <div className="text-muted text-[13px] leading-5">{subtitles[i]}</div>
                </div>
              </li>
            );
          })}
        </ol>
      </aside>

      <section className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-muted text-[15px]">
              {td("stepLabel", { step: step + 1, title: labels[step] })}
            </div>
            <h1 className="font-display mt-1 text-[32px] leading-[1.1] lg:text-[38px]">{titles[step]}</h1>
            <p className="text-muted mt-2 max-w-[640px] text-[15px] leading-6">{subtitles[step]}</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-muted text-sm">
              {td("stepOf", { step: step + 1, total: STEP_KEYS.length })}
            </span>
            <span className="bg-border relative h-1 w-40 rounded-full">
              <span
                className="bg-accent absolute inset-y-0 start-0 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </span>
            {salon && (
              <Link href="/dashboard" className="text-accent hover:text-foreground text-[15px] font-medium">
                {td("saveExit")}
              </Link>
            )}
          </div>
        </div>

        <div className="mt-10 max-w-[760px]">
          {step === 0 && (
            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <Label htmlFor="ob-name">{t("salonName")}</Label>
                  <Input
                    id="ob-name"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (!slugTouched) setSlug(slugify(e.target.value).slice(0, 50));
                    }}
                    maxLength={80}
                    autoFocus
                  />
                </div>
                <div>
                  <Label htmlFor="ob-slug">{t("slug")}</Label>
                  <div className="flex items-baseline gap-1" dir="ltr">
                    <Input
                      id="ob-slug"
                      value={slug}
                      onChange={(e) => {
                        setSlugTouched(true);
                        setSlug(slugify(e.target.value));
                      }}
                      maxLength={50}
                      className="min-w-0"
                    />
                    <span className="text-muted shrink-0 text-base">.nailswap.app</span>
                  </div>
                  <p
                    className={cn(
                      "mt-1.5 text-[13px]",
                      slugState === "taken"
                        ? "text-danger"
                        : slugState === "free"
                          ? "text-success"
                          : "text-muted",
                    )}
                  >
                    {slugState === "taken"
                      ? t("slugTaken")
                      : slugState === "free"
                        ? td("slugFree", { slug })
                        : t("slugHint", { slug: slug || "yoursalon" })}
                  </p>
                </div>
                <div>
                  <Label htmlFor="ob-phone">{tc("phone")}</Label>
                  <Input
                    id="ob-phone"
                    type="tel"
                    dir="ltr"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="ob-wa">{t("whatsapp")}</Label>
                  <Input
                    id="ob-wa"
                    type="tel"
                    dir="ltr"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="ob-ig">{t("instagram")}</Label>
                  <Input
                    id="ob-ig"
                    dir="ltr"
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    placeholder="@yoursalon"
                  />
                </div>
                <div>
                  <Label htmlFor="ob-city">{t("city")}</Label>
                  <Input id="ob-city" value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
              </div>
              <div>
                <Label htmlFor="ob-desc">{td("about")}</Label>
                <Textarea
                  id="ob-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={400}
                />
              </div>
              <div className="flex flex-wrap items-center gap-10">
                <div>
                  <div className="text-muted mb-2 text-[13px]">{t("brandColor")}</div>
                  <div className="flex items-center gap-3">
                    {BRAND_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={c}
                        aria-pressed={brand === c}
                        onClick={() => setBrand(c)}
                        className={cn(
                          "size-9 rounded-full",
                          brand === c && "ring-2 ring-offset-4 ring-offset-[var(--background)]",
                        )}
                        style={{ background: c, ["--tw-ring-color" as string]: c }}
                      />
                    ))}
                    <input
                      type="color"
                      aria-label={t("brandColor")}
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      className="size-9 cursor-pointer rounded-full border-0 bg-transparent p-0"
                    />
                  </div>
                </div>
                <div>
                  <div className="text-muted mb-2 text-[13px]">{t("logo")}</div>
                  <label className="text-accent hover:text-foreground inline-flex min-h-11 cursor-pointer items-center gap-2 text-[15px] font-medium">
                    {logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoUrl} alt="" className="size-11 rounded-full object-cover" />
                    ) : (
                      <Upload className="size-5" strokeWidth={1.75} />
                    )}
                    {logoPath ? tc("edit") : tc("add")}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      disabled={!salon}
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f || !salon) return;
                        try {
                          const r = await uploadMedia(salon.id, f, "logo");
                          setLogoPath(r.path);
                          setLogoUrl(r.url);
                        } catch (err) {
                          fail(err);
                        }
                      }}
                    />
                  </label>
                  {!salon && <div className="text-muted text-[12px]">{td("logoAfterCreate")}</div>}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid grid-cols-1 gap-12 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <h2 className="font-display text-2xl">{t("address")}</h2>
                <div className="mt-5 space-y-6">
                  <div>
                    <Label htmlFor="ob-address">{td("street")}</Label>
                    <Input id="ob-address" value={address} onChange={(e) => setAddress(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="ob-area">{t("area")}</Label>
                      <Input id="ob-area" value={area} onChange={(e) => setArea(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="ob-city2">{t("city")}</Label>
                      <Input id="ob-city2" value={city} onChange={(e) => setCity(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted text-sm">
                      {coords
                        ? td("pinSet", { lat: coords.lat.toFixed(4), lng: coords.lng.toFixed(4) })
                        : td("pinHint")}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        navigator.geolocation?.getCurrentPosition((p) =>
                          setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
                        )
                      }
                      className="text-accent hover:text-foreground inline-flex min-h-11 shrink-0 items-center gap-1.5 text-[15px] font-medium"
                    >
                      <Navigation className="size-5" strokeWidth={1.75} />
                      {td("useLocation")}
                    </button>
                  </div>
                  <div>
                    <div className="text-muted text-[13px]">{td("pageLink")}</div>
                    <div className="border-border-strong flex h-12 items-center border-b text-base" dir="ltr">
                      <span className="text-muted">https://</span>
                      <span className="font-medium">{salon?.slug}</span>
                      <span className="text-muted ms-auto">.nailswap.app</span>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-2xl">{td("weeklyHours")}</h2>
                  <button
                    type="button"
                    onClick={() =>
                      setHours((h) =>
                        h.map((r) =>
                          r.weekday === 2
                            ? r
                            : {
                                ...r,
                                open_time: h[1].open_time,
                                close_time: h[1].close_time,
                                is_closed: h[1].is_closed,
                              },
                        ),
                      )
                    }
                    className="text-accent hover:text-foreground text-[15px] font-medium"
                  >
                    {td("copyToAll", { day: tc("weekdays.2") })}
                  </button>
                </div>
                <div className="mt-3">
                  {hours.map((h, i) => (
                    <div
                      key={h.weekday}
                      className="border-border flex min-h-[60px] items-center gap-4 border-b"
                    >
                      <span className="w-28 text-[15px]">{tc(`weekdays.${h.weekday}` as never)}</span>
                      <Switch
                        checked={!h.is_closed}
                        onChange={(v) =>
                          setHours((cur) => cur.map((r, j) => (j === i ? { ...r, is_closed: !v } : r)))
                        }
                        label={tc(`weekdays.${h.weekday}` as never)}
                      />
                      <div className="ms-auto flex items-center gap-2" dir="ltr">
                        {h.is_closed ? (
                          <span className="text-muted text-[15px]">{td("closedAllDay")}</span>
                        ) : (
                          <>
                            <input
                              type="time"
                              value={h.open_time ?? ""}
                              onChange={(e) =>
                                setHours((cur) =>
                                  cur.map((r, j) => (j === i ? { ...r, open_time: e.target.value } : r)),
                                )
                              }
                              className={timeInput}
                            />
                            <span className="text-muted">–</span>
                            <input
                              type="time"
                              value={h.close_time ?? ""}
                              onChange={(e) =>
                                setHours((cur) =>
                                  cur.map((r, j) => (j === i ? { ...r, close_time: e.target.value } : r)),
                                )
                              }
                              className={timeInput}
                            />
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-muted mt-4 text-sm">{td("holidaysLater")}</p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="table-head grid-cols-[1fr_120px_100px_100px_44px] px-0">
                <span>{t("servicesTitle")}</span>
                <span>{td("type")}</span>
                <span>{tc("price")}</span>
                <span>{tc("duration")}</span>
                <span />
              </div>
              {services.map((s, i) => (
                <div
                  key={s.key}
                  className={cn(
                    "border-border grid min-h-14 grid-cols-[1fr_120px_100px_100px_44px] items-center gap-x-4 border-b py-1",
                    !s.on && "opacity-50",
                  )}
                >
                  <input
                    value={s.name}
                    disabled={s.existing}
                    onChange={(e) =>
                      setServices((cur) => cur.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))
                    }
                    className="field focus:border-accent h-10 border-transparent text-[15px]"
                  />
                  <Select
                    value={s.category}
                    disabled={s.existing}
                    onChange={(e) =>
                      setServices((cur) =>
                        cur.map((r, j) => (j === i ? { ...r, category: e.target.value } : r)),
                      )
                    }
                    className="h-10 border-transparent text-sm"
                  >
                    {[
                      "gel",
                      "acrylic",
                      "biab",
                      "extensions",
                      "removal",
                      "manicure",
                      "pedicure",
                      "nail_art",
                      "other",
                    ].map((c) => (
                      <option key={c} value={c}>
                        {tcats(c as never)}
                      </option>
                    ))}
                  </Select>
                  <input
                    type="number"
                    min={0}
                    value={s.price}
                    disabled={s.existing}
                    onChange={(e) =>
                      setServices((cur) =>
                        cur.map((r, j) => (j === i ? { ...r, price: Number(e.target.value) } : r)),
                      )
                    }
                    className="field focus:border-accent h-10 border-transparent text-[15px] tabular-nums"
                    dir="ltr"
                  />
                  <input
                    type="number"
                    min={10}
                    step={5}
                    value={s.duration}
                    disabled={s.existing}
                    onChange={(e) =>
                      setServices((cur) =>
                        cur.map((r, j) => (j === i ? { ...r, duration: Number(e.target.value) } : r)),
                      )
                    }
                    className="field focus:border-accent h-10 border-transparent text-[15px] tabular-nums"
                    dir="ltr"
                  />
                  {s.existing ? (
                    <Check className="text-success size-5" />
                  ) : (
                    <Switch
                      checked={s.on}
                      onChange={(v) =>
                        setServices((cur) => cur.map((r, j) => (j === i ? { ...r, on: v } : r)))
                      }
                      label={s.name}
                    />
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setServices((cur) => [
                    ...cur,
                    {
                      key: `n${Date.now()}`,
                      name: "",
                      category: "other",
                      price: 0,
                      duration: 45,
                      on: true,
                      existing: false,
                    },
                  ])
                }
                className="text-accent hover:text-foreground mt-3 inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium"
              >
                <Plus className="size-5" strokeWidth={1.75} />
                {tcat("newService")}
              </button>
            </div>
          )}

          {step === 3 && (
            <div>
              <label className="text-accent hover:text-foreground inline-flex min-h-11 cursor-pointer items-center gap-2 text-[15px] font-medium">
                <Upload className="size-5" strokeWidth={1.75} />
                {uploading ? tc("loading") : tcat("photos")}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={onDesignFiles}
                  disabled={uploading}
                />
              </label>
              {designs.length > 0 && (
                <div className="mt-6 grid grid-cols-2 gap-6 md:grid-cols-4">
                  {designs.map((d, i) => (
                    <div key={d.id ?? d.path ?? i} className="min-w-0">
                      <div className="rounded-media bg-surface-2 aspect-square overflow-hidden">
                        {(d.url || d.path) && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={
                              d.url ??
                              `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/public-media/${d.path}`
                            }
                            alt=""
                            className="size-full object-cover"
                          />
                        )}
                      </div>
                      <input
                        value={d.name}
                        disabled={Boolean(d.id)}
                        onChange={(e) =>
                          setDesigns((cur) =>
                            cur.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)),
                          )
                        }
                        className="field mt-2 h-10 text-[15px]"
                      />
                      {!d.id && (
                        <div className="flex items-center justify-between">
                          <Select
                            value={d.category}
                            onChange={(e) =>
                              setDesigns((cur) =>
                                cur.map((r, j) => (j === i ? { ...r, category: e.target.value } : r)),
                              )
                            }
                            className="h-10 text-sm"
                            wrapperClassName="flex-1"
                          >
                            {["french", "chrome", "ombre", "art_3d", "minimal", "bridal", "seasonal"].map(
                              (c) => (
                                <option key={c} value={c}>
                                  {texp(c as never)}
                                </option>
                              ),
                            )}
                          </Select>
                          <button
                            type="button"
                            aria-label={tc("remove")}
                            onClick={() => setDesigns((cur) => cur.filter((_, j) => j !== i))}
                            className="text-muted hover:text-danger inline-flex size-11 items-center justify-center"
                          >
                            <X className="size-5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div>
              {staff.map((s, i) => (
                <div
                  key={s.id ?? i}
                  className="border-border grid min-h-16 grid-cols-[44px_1fr_1fr_44px] items-center gap-4 border-b py-2"
                >
                  <span
                    className="inline-flex size-9 items-center justify-center rounded-full text-[13px] font-medium text-white"
                    style={{ background: s.color }}
                  >
                    {(s.name.trim()[0] ?? "?").toUpperCase()}
                  </span>
                  <input
                    value={s.name}
                    disabled={Boolean(s.id)}
                    placeholder={tstaff("displayName")}
                    onChange={(e) =>
                      setStaff((cur) => cur.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))
                    }
                    className="field h-10 text-[15px]"
                  />
                  <input
                    value={s.phone}
                    disabled={Boolean(s.id)}
                    placeholder={tstaff("invitePhone")}
                    dir="ltr"
                    onChange={(e) =>
                      setStaff((cur) => cur.map((r, j) => (j === i ? { ...r, phone: e.target.value } : r)))
                    }
                    className="field h-10 text-[15px]"
                  />
                  {!s.id && staff.length > 1 && (
                    <button
                      type="button"
                      aria-label={tc("remove")}
                      onClick={() => setStaff((cur) => cur.filter((_, j) => j !== i))}
                      className="text-muted hover:text-danger inline-flex size-11 items-center justify-center"
                    >
                      <X className="size-5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setStaff((cur) => [
                    ...cur,
                    { name: "", phone: "", color: STAFF_COLORS[cur.length % STAFF_COLORS.length] },
                  ])
                }
                className="text-accent hover:text-foreground mt-3 inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium"
              >
                <Plus className="size-5" strokeWidth={1.75} />
                {tstaff("newStaff")}
              </button>
            </div>
          )}

          {step === 5 && salon && (
            <div className="max-w-[520px]">
              <div className="border-border-strong flex h-12 items-center border-b text-base" dir="ltr">
                <span className="font-medium">{publicUrl ?? `${salon.slug}.nailswap.app`}</span>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-8">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/dashboard/${salon.id}/qr?format=png&size=512&target=try&locale=${locale}`}
                  alt="QR"
                  width={160}
                  height={160}
                  className="rounded-media"
                />
                <div className="space-y-3">
                  <a
                    href={`/api/dashboard/${salon.id}/qr?format=png&size=1024&target=try&locale=${locale}`}
                    download={`${salon.slug}-qr.png`}
                    className="text-accent hover:text-foreground block text-[15px] font-medium"
                  >
                    {t("downloadQr")}
                  </a>
                  <a
                    href={publicUrl ?? `/${locale}/s/${salon.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent hover:text-foreground block text-[15px] font-medium"
                  >
                    {t("openPage")}
                  </a>
                </div>
              </div>
              <p className="text-muted mt-8 text-sm leading-6">{t("submitDirectory")}</p>
              <ButtonLink href="/dashboard" size="lg" className="mt-8">
                {t("goDashboard")}
              </ButtonLink>
            </div>
          )}

          {error && (
            <Notice tone="danger" className="mt-6">
              {error}
            </Notice>
          )}

          {step < 5 && (
            <div className="mt-12 flex items-center justify-between gap-4">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  className="text-foreground hover:text-accent inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium"
                >
                  <ChevronLeft className="size-5 rtl:-scale-x-100" strokeWidth={1.75} />
                  {tc("back")}
                </button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-6">
                <span className="text-muted hidden text-[15px] sm:inline">
                  {td("nextLabel", { title: labels[step + 1] })}
                </span>
                {(step === 3 || step === 4) && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (step === 3) return saveDesigns();
                      await goLive();
                      setStep(5);
                    }}
                    className="text-foreground hover:text-accent text-[15px] font-medium"
                  >
                    {tc("skip")}
                  </button>
                )}
                <Button
                  size="lg"
                  loading={busy}
                  onClick={() => [saveDetails, saveLocation, saveServices, saveDesigns, saveStaff][step]()}
                >
                  {td("saveContinue")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
