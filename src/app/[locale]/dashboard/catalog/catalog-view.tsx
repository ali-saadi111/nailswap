"use client";

import * as React from "react";
import { Hand, Plus, Search, Sparkles, Upload } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/shell/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Dialog, FilterToggle, Notice, StatusDot, Tabs } from "@/components/ui/primitives";
import { Input, Label, Select, SwitchRow, Textarea } from "@/components/ui/input";
import { Nail, NailGroup, fillForDesign, fillForPolish } from "@/components/nails/nail";
import { toast } from "@/components/ui/toaster";
import { uploadMedia } from "@/lib/client/dashboard";
import { money, num } from "@/lib/format";
import { slugify, cn } from "@/lib/utils";

export interface DesignRow {
  id: string;
  slug: string;
  name: string;
  category: string;
  shape: string | null;
  length: string | null;
  price_addon: number;
  duration_addon_min: number;
  cover_path: string | null;
  coverUrl: string | null;
  prompt_text: string | null;
  tags: string[];
  is_visible: boolean;
  is_featured: boolean;
  sort_order: number;
  tryon_count: number;
  booking_count: number;
  serviceIds: string[];
  polishIds: string[];
}
export interface PolishRow {
  id: string;
  brand: string;
  collection: string | null;
  shade_name: string;
  shade_code: string | null;
  finish: string;
  hex_color: string;
  in_stock: boolean;
  swatch_path: string | null;
  swatchUrl: string | null;
  sort_order: number;
}
export interface ServiceRow {
  id: string;
  name: string;
  category: string;
  price: number;
  duration_min: number;
  buffer_min: number;
  is_active: boolean;
  supports_tryon: boolean;
  sort_order: number;
  description: string | null;
}

type Tab = "designs" | "polishes" | "services";
const CATEGORIES = ["french", "chrome", "ombre", "art_3d", "minimal", "bridal", "seasonal"];
const SHAPES = ["almond", "round", "square", "squoval", "coffin", "stiletto"];
const LENGTHS = ["short", "medium", "long"];
const FINISHES = ["glossy", "matte", "chrome", "cat_eye", "glitter", "shimmer", "french_tip"];
const SERVICE_CATS = [
  "gel",
  "acrylic",
  "biab",
  "extensions",
  "removal",
  "manicure",
  "pedicure",
  "nail_art",
  "other",
];

export function CatalogView({
  salon,
  initialTab,
  designs,
  polishes,
  services,
}: {
  salon: { id: string; name: string; currency: string; slug: string };
  initialTab: Tab;
  designs: DesignRow[];
  polishes: PolishRow[];
  services: ServiceRow[];
}) {
  const t = useTranslations("catalog");
  const td = useTranslations("ui.dash");
  const tc = useTranslations("common");
  const tcat = useTranslations("explore.categories");
  const tdash = useTranslations("dashboard");
  const tfin = useTranslations("tryon.finishes");
  const tsc = useTranslations("catalog.serviceCategories");
  const tob = useTranslations("onboarding");
  const [tab, setTab] = React.useState<Tab>(initialTab);
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState<"all" | "published" | "draft" | "ar">("all");
  const [editing, setEditing] = React.useState<{ kind: Tab; id: string | null } | null>(null);
  const locale = useLocale();

  const dList = designs.filter((d) => {
    if (filter === "published" && !d.is_visible) return false;
    if (filter === "draft" && d.is_visible) return false;
    if (filter === "ar" && !(d.polishIds.length || d.shape)) return false;
    if (search && !`${d.name} ${d.tags.join(" ")}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const pList = polishes.filter(
    (p) =>
      !search ||
      `${p.brand} ${p.shade_name} ${p.collection ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  );
  const sList = services.filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()));

  const addLabel = tab === "designs" ? t("newDesign") : tab === "polishes" ? t("newPolish") : t("newService");

  return (
    <>
      <PageHeader
        context={salon.name}
        title={tdash("catalog")}
        actions={
          <>
            <label className="relative inline-flex items-center">
              <Search className="text-muted pointer-events-none absolute start-0 size-5" strokeWidth={1.75} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={td("searchDesigns")}
                className="field h-11 w-56 ps-7 text-base"
                aria-label={tc("search")}
              />
            </label>
            <Button onClick={() => setEditing({ kind: tab, id: null })}>
              <Plus className="size-5" strokeWidth={1.75} />
              {addLabel}
            </Button>
          </>
        }
      />

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: "designs", label: tdash("catalog"), count: designs.length },
          { value: "polishes", label: tdash("polishes"), count: polishes.length },
          { value: "services", label: tdash("services"), count: services.length },
        ]}
      />

      {tab === "designs" && (
        <>
          <div className="mt-2 flex flex-wrap gap-x-6">
            <FilterToggle pressed={filter === "all"} onClick={() => setFilter("all")}>
              {tc("all")}
            </FilterToggle>
            <FilterToggle pressed={filter === "published"} onClick={() => setFilter("published")}>
              {td("published")}{" "}
              <span className="text-muted font-normal">· {designs.filter((d) => d.is_visible).length}</span>
            </FilterToggle>
            <FilterToggle pressed={filter === "draft"} onClick={() => setFilter("draft")}>
              {td("drafts")}{" "}
              <span className="text-muted font-normal">· {designs.filter((d) => !d.is_visible).length}</span>
            </FilterToggle>
            <FilterToggle pressed={filter === "ar"} onClick={() => setFilter("ar")}>
              {td("arReady")}
            </FilterToggle>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-9 md:grid-cols-3 xl:grid-cols-4">
            {dList.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setEditing({ kind: "designs", id: d.id })}
                className="group min-w-0 text-start"
              >
                {d.coverUrl ? (
                  <span className="rounded-media bg-surface-2 block aspect-[4/3] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={d.coverUrl} alt="" className="size-full object-cover" />
                  </span>
                ) : (
                  <NailGroup shape={d.shape} fill={fillForDesign(d)} size={28} gap={8} className="h-12" />
                )}
                <span
                  className={cn(
                    "mt-3 block truncate text-[17px] font-semibold",
                    editing?.id === d.id && "text-accent",
                  )}
                >
                  {d.name}
                </span>
                <span className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
                  <StatusDot tone={d.is_visible ? "success" : "hollow"}>
                    {d.is_visible ? td("published") : td("draft")}
                  </StatusDot>
                  <span className="text-muted inline-flex items-center gap-1">
                    <Hand className="size-3.5" strokeWidth={1.75} />
                    {num(d.tryon_count, locale)}
                  </span>
                  {(d.polishIds.length > 0 || d.shape) && (
                    <span className="text-accent inline-flex items-center gap-1">
                      <Sparkles className="size-3.5" strokeWidth={1.75} />
                      {td("arReady")}
                    </span>
                  )}
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setEditing({ kind: "designs", id: null })}
              className="text-start"
            >
              <span className="text-accent inline-flex items-center gap-1.5 text-[17px] font-medium">
                <Plus className="size-5" strokeWidth={1.75} />
                {t("newDesign")}
              </span>
              <span className="text-muted mt-1 block text-[13px]">{td("newDesignHint")}</span>
            </button>
          </div>
        </>
      )}

      {tab === "polishes" && (
        <div className="mt-4">
          <div className="table-head grid-cols-[44px_minmax(0,1.3fr)_minmax(0,1fr)_110px_90px_100px]">
            <span />
            <span>{t("shadeName")}</span>
            <span>{t("brand")}</span>
            <span>{td("finish")}</span>
            <span>{t("hex")}</span>
            <span>{tc("status")}</span>
          </div>
          {pList.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setEditing({ kind: "polishes", id: p.id })}
              className="table-row h-14 w-full grid-cols-[44px_minmax(0,1.3fr)_minmax(0,1fr)_110px_90px_100px] text-start"
            >
              <Nail
                fill={fillForPolish({ hexColor: p.hex_color, finish: p.finish })}
                width={16}
                height={23}
              />
              <span className="truncate text-[15px] font-medium">{p.shade_name}</span>
              <span className="text-muted truncate">
                {p.brand}
                {p.collection ? ` · ${p.collection}` : ""}
              </span>
              <span>{tfin(p.finish as never)}</span>
              <span className="text-muted tabular-nums" dir="ltr">
                {p.hex_color}
              </span>
              <StatusDot tone={p.in_stock ? "success" : "hollow"}>
                {p.in_stock ? t("inStock") : t("outOfStock")}
              </StatusDot>
            </button>
          ))}
          {pList.length === 0 && <div className="text-muted py-8 text-[15px]">{tob("polishesHint")}</div>}
        </div>
      )}

      {tab === "services" && (
        <div className="mt-4">
          <div className="table-head grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_100px_100px_90px_100px]">
            <span>{t("serviceName")}</span>
            <span>{t("serviceCategory")}</span>
            <span>{tc("price")}</span>
            <span>{tc("duration")}</span>
            <span>{t("buffer")}</span>
            <span>{tc("status")}</span>
          </div>
          {sList.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setEditing({ kind: "services", id: s.id })}
              className="table-row h-14 w-full grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_100px_100px_90px_100px] text-start"
            >
              <span className="truncate text-[15px] font-medium">{s.name}</span>
              <span className="text-muted">{tsc(s.category as never)}</span>
              <span className="tabular-nums">{money(s.price, salon.currency, locale)}</span>
              <span className="tabular-nums">{tc("min", { count: s.duration_min })}</span>
              <span className="text-muted tabular-nums">
                {s.buffer_min ? tc("min", { count: s.buffer_min }) : "–"}
              </span>
              <StatusDot tone={s.is_active ? "success" : "hollow"}>
                {s.is_active ? t("active") : td("inactive")}
              </StatusDot>
            </button>
          ))}
        </div>
      )}

      {editing?.kind === "designs" && (
        <DesignEditor
          key={editing.id ?? "new"}
          salon={salon}
          design={designs.find((d) => d.id === editing.id) ?? null}
          services={services}
          polishes={polishes}
          onClose={() => setEditing(null)}
        />
      )}
      {editing?.kind === "polishes" && (
        <PolishEditor
          key={editing.id ?? "new"}
          salon={salon}
          polish={polishes.find((p) => p.id === editing.id) ?? null}
          onClose={() => setEditing(null)}
        />
      )}
      {editing?.kind === "services" && (
        <ServiceEditor
          key={editing.id ?? "new"}
          salon={salon}
          service={services.find((s) => s.id === editing.id) ?? null}
          onClose={() => setEditing(null)}
        />
      )}
      <span className="sr-only">{CATEGORIES.map((c) => tcat(c as never)).join(" ")}</span>
    </>
  );
}

/* ── Design editor (side pane on wide screens, sheet otherwise) ─────────── */
function DesignEditor({
  salon,
  design,
  services,
  polishes,
  onClose,
}: {
  salon: { id: string; currency: string; slug: string };
  design: DesignRow | null;
  services: ServiceRow[];
  polishes: PolishRow[];
  onClose: () => void;
}) {
  const t = useTranslations("catalog");
  const td = useTranslations("ui.dash");
  const tc = useTranslations("common");
  const tcat = useTranslations("explore.categories");
  const tsh = useTranslations("tryon.shapes");
  const tln = useTranslations("tryon.lengths");
  const ttry = useTranslations("tryon");
  const locale = useLocale();
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [f, setF] = React.useState({
    name: design?.name ?? "",
    category: design?.category ?? "minimal",
    shape: design?.shape ?? "almond",
    length: design?.length ?? "medium",
    price_addon: design?.price_addon ?? 0,
    duration_addon_min: design?.duration_addon_min ?? 0,
    prompt_text: design?.prompt_text ?? "",
    tags: design?.tags.join(", ") ?? "",
    is_visible: design?.is_visible ?? true,
    is_featured: design?.is_featured ?? false,
    cover_path: design?.cover_path ?? null,
    coverUrl: design?.coverUrl ?? null,
    serviceIds: design?.serviceIds ?? [],
    polishIds: design?.polishIds ?? [],
  });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((c) => ({ ...c, [k]: v }));

  async function save() {
    if (f.name.trim().length < 2) return setError(t("designName"));
    setBusy(true);
    setError(null);
    try {
      const row = {
        salon_id: salon.id,
        name: f.name.trim(),
        category: f.category as never,
        shape: f.shape as never,
        length: f.length as never,
        price_addon: f.price_addon,
        duration_addon_min: f.duration_addon_min,
        prompt_text: f.prompt_text.trim() || null,
        tags: f.tags
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        is_visible: f.is_visible,
        is_featured: f.is_featured,
        cover_path: f.cover_path,
      };
      let id = design?.id;
      if (id) {
        const { error: e } = await supabase.from("designs").update(row).eq("id", id);
        if (e) throw e;
      } else {
        const { data, error: e } = await supabase
          .from("designs")
          .insert({ ...row, slug: `${slugify(f.name)}-${Math.random().toString(36).slice(2, 6)}` })
          .select("id")
          .single();
        if (e) throw e;
        id = data.id;
      }
      await supabase.from("design_services").delete().eq("design_id", id);
      if (f.serviceIds.length)
        await supabase
          .from("design_services")
          .insert(f.serviceIds.map((service_id) => ({ design_id: id!, service_id })));
      await supabase.from("design_polishes").delete().eq("design_id", id);
      if (f.polishIds.length)
        await supabase
          .from("design_polishes")
          .insert(f.polishIds.map((polish_id) => ({ design_id: id!, polish_id })));
      toast.success(tc("save"));
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : tc("somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!design || !confirm(t("deleteConfirm"))) return;
    setBusy(true);
    const { error: e } = await supabase.from("designs").delete().eq("id", design.id);
    setBusy(false);
    if (e) return setError(e.message);
    router.refresh();
    onClose();
  }

  async function onCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const r = await uploadMedia(salon.id, file, "design");
      set("cover_path", r.path);
      set("coverUrl", r.url);
    } catch {
      toast.error(tc("somethingWrong"));
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={design ? design.name : t("newDesign")}
      description={design ? t("editDesign") : undefined}
      sheet
      size="lg"
    >
      <div className="grid gap-8 md:grid-cols-[1fr_1fr]">
        <div className="space-y-6">
          <div>
            <div className="text-muted text-[13px]">{t("photos")}</div>
            <div className="mt-2 flex items-center gap-4">
              {f.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.coverUrl} alt="" className="rounded-media size-20 object-cover" />
              ) : (
                <NailGroup shape={f.shape} fill={fillForDesign({ category: f.category })} size={18} gap={5} />
              )}
              <label className="text-accent hover:text-foreground inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-[15px] font-medium">
                <Upload className="size-5" strokeWidth={1.75} />
                {f.coverUrl ? td("replace") : tc("add")}
                <input type="file" accept="image/*" className="sr-only" onChange={onCover} />
              </label>
            </div>
          </div>
          <div>
            <Label htmlFor="de-name">{t("designName")}</Label>
            <Input
              id="de-name"
              value={f.name}
              onChange={(e) => set("name", e.target.value)}
              maxLength={80}
              autoFocus={!design}
            />
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <Label htmlFor="de-cat">{t("category")}</Label>
              <Select id="de-cat" value={f.category} onChange={(e) => set("category", e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {tcat(c as never)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="de-len">{ttry("length")}</Label>
              <Select id="de-len" value={f.length} onChange={(e) => set("length", e.target.value)}>
                {LENGTHS.map((l) => (
                  <option key={l} value={l}>
                    {tln(l as never)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <div className="text-muted text-[13px]">{td("shapesOffered")}</div>
            <div className="mt-2 flex flex-wrap gap-6">
              {SHAPES.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={f.shape === s}
                  onClick={() => set("shape", s)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 text-[13px] font-medium",
                    f.shape === s ? "text-accent" : "text-muted hover:text-foreground",
                  )}
                >
                  <Nail
                    shape={s}
                    fill={f.shape === s ? fillForDesign({ category: f.category }) : "var(--surface-2)"}
                    width={20}
                    height={29}
                  />
                  {tsh(s as never)}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <Label htmlFor="de-price">{t("priceAddon")}</Label>
              <Input
                id="de-price"
                type="number"
                min={0}
                dir="ltr"
                value={f.price_addon}
                onChange={(e) => set("price_addon", Number(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="de-dur">{t("durationAddon")}</Label>
              <Select
                id="de-dur"
                value={f.duration_addon_min}
                onChange={(e) => set("duration_addon_min", Number(e.target.value))}
              >
                {[0, 5, 10, 15, 20, 30, 45, 60].map((n) => (
                  <option key={n} value={n}>
                    +{tc("min", { count: n })}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <div>
            <Label htmlFor="de-prompt">{t("promptText")}</Label>
            <Textarea
              id="de-prompt"
              value={f.prompt_text}
              onChange={(e) => set("prompt_text", e.target.value)}
              maxLength={400}
              className="min-h-20"
            />
            <p className="text-muted mt-1.5 text-[13px]">{t("promptHint")}</p>
          </div>
          <div>
            <Label htmlFor="de-tags">{t("tags")}</Label>
            <Input
              id="de-tags"
              value={f.tags}
              onChange={(e) => set("tags", e.target.value)}
              placeholder={t("tagsHint")}
            />
          </div>
          <div>
            <div className="text-muted text-[13px]">{t("linkedServices")}</div>
            <div className="mt-1 flex flex-wrap gap-x-5">
              {services.map((s) => (
                <label key={s.id} className="inline-flex min-h-10 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={f.serviceIds.includes(s.id)}
                    onChange={(e) =>
                      set(
                        "serviceIds",
                        e.target.checked ? [...f.serviceIds, s.id] : f.serviceIds.filter((x) => x !== s.id),
                      )
                    }
                    className="size-[18px]"
                  />
                  {s.name}
                </label>
              ))}
            </div>
          </div>
          {polishes.length > 0 && (
            <div>
              <div className="text-muted text-[13px]">{t("linkedPolishes")}</div>
              <div className="mt-2 flex flex-wrap gap-3">
                {polishes.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={f.polishIds.includes(p.id)}
                    title={`${p.brand} ${p.shade_name}`}
                    onClick={() =>
                      set(
                        "polishIds",
                        f.polishIds.includes(p.id)
                          ? f.polishIds.filter((x) => x !== p.id)
                          : [...f.polishIds, p.id],
                      )
                    }
                    className="flex flex-col items-center gap-1"
                  >
                    <Nail
                      fill={fillForPolish({ hexColor: p.hex_color, finish: p.finish })}
                      width={16}
                      height={23}
                    />
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        f.polishIds.includes(p.id) ? "bg-accent" : "bg-transparent",
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
          <SwitchRow
            title={td("visibleOnPage")}
            description={td("visibleHint")}
            checked={f.is_visible}
            onChange={(v) => set("is_visible", v)}
          />
          <SwitchRow title={t("featured")} checked={f.is_featured} onChange={(v) => set("is_featured", v)} />
        </div>
      </div>
      {error && (
        <Notice tone="danger" className="mt-6">
          {error}
        </Notice>
      )}
      <div className="mt-8 flex items-center justify-between">
        {design ? (
          <Button variant="danger" onClick={remove} disabled={busy}>
            {tc("delete")}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-6">
          {design && (
            <a
              href={`/${locale}/s/${salon.slug}/try?designId=${design.id}`}
              target="_blank"
              rel="noreferrer"
              className="text-foreground hover:text-accent text-[15px] font-medium"
            >
              {tc("preview")}
            </a>
          )}
          <Button onClick={save} loading={busy}>
            {td("saveChanges")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function PolishEditor({
  salon,
  polish,
  onClose,
}: {
  salon: { id: string };
  polish: PolishRow | null;
  onClose: () => void;
}) {
  const t = useTranslations("catalog");
  const td = useTranslations("ui.dash");
  const tc = useTranslations("common");
  const tf = useTranslations("tryon.finishes");
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [f, setF] = React.useState({
    brand: polish?.brand ?? "",
    collection: polish?.collection ?? "",
    shade_name: polish?.shade_name ?? "",
    shade_code: polish?.shade_code ?? "",
    finish: polish?.finish ?? "glossy",
    hex_color: polish?.hex_color ?? "#c2185b",
    in_stock: polish?.in_stock ?? true,
    swatch_path: polish?.swatch_path ?? null,
    swatchUrl: polish?.swatchUrl ?? null,
    auto: false,
  });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((c) => ({ ...c, [k]: v }));

  async function onSwatch(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const r = await uploadMedia(salon.id, file, "polish");
      setF((c) => ({
        ...c,
        swatch_path: r.path,
        swatchUrl: r.url,
        hex_color: r.hex ?? c.hex_color,
        auto: Boolean(r.hex),
      }));
    } catch {
      toast.error(tc("somethingWrong"));
    }
  }

  async function save() {
    if (!f.brand.trim() || !f.shade_name.trim()) return setError(t("shadeName"));
    setBusy(true);
    setError(null);
    const row = {
      salon_id: salon.id,
      brand: f.brand.trim(),
      collection: f.collection.trim() || null,
      shade_name: f.shade_name.trim(),
      shade_code: f.shade_code.trim() || null,
      finish: f.finish as never,
      hex_color: f.hex_color,
      in_stock: f.in_stock,
      swatch_path: f.swatch_path,
      hex_color_auto: f.auto ? f.hex_color : null,
    };
    const { error: e } = polish
      ? await supabase.from("polishes").update(row).eq("id", polish.id)
      : await supabase.from("polishes").insert(row);
    setBusy(false);
    if (e) return setError(e.message);
    toast.success(tc("save"));
    router.refresh();
    onClose();
  }

  async function remove() {
    if (!polish || !confirm(t("deleteConfirm"))) return;
    const { error: e } = await supabase.from("polishes").delete().eq("id", polish.id);
    if (e) return setError(e.message);
    router.refresh();
    onClose();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={polish ? `${polish.brand} ${polish.shade_name}` : t("newPolish")}
      sheet
      size="md"
    >
      <div className="flex items-center gap-5">
        <Nail fill={fillForPolish({ hexColor: f.hex_color, finish: f.finish })} width={32} height={46} />
        {f.swatchUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={f.swatchUrl} alt="" className="size-14 rounded-full object-cover" />
        )}
        <label className="text-accent hover:text-foreground inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-[15px] font-medium">
          <Upload className="size-5" strokeWidth={1.75} />
          {t("swatch")}
          <input type="file" accept="image/*" className="sr-only" onChange={onSwatch} />
        </label>
        {f.auto && <span className="text-success text-[13px]">{t("hexAuto")}</span>}
      </div>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <Label htmlFor="po-brand">{t("brand")}</Label>
          <Input id="po-brand" value={f.brand} onChange={(e) => set("brand", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="po-coll">{t("collection")}</Label>
          <Input id="po-coll" value={f.collection} onChange={(e) => set("collection", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="po-shade">{t("shadeName")}</Label>
          <Input id="po-shade" value={f.shade_name} onChange={(e) => set("shade_name", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="po-code">{t("shadeCode")}</Label>
          <Input
            id="po-code"
            dir="ltr"
            value={f.shade_code}
            onChange={(e) => set("shade_code", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="po-finish">{td("finish")}</Label>
          <Select id="po-finish" value={f.finish} onChange={(e) => set("finish", e.target.value)}>
            {FINISHES.map((x) => (
              <option key={x} value={x}>
                {tf(x as never)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="po-hex">{t("hex")}</Label>
          <div className="flex items-center gap-3">
            <Input
              id="po-hex"
              dir="ltr"
              value={f.hex_color}
              onChange={(e) => {
                set("hex_color", e.target.value);
                set("auto", false);
              }}
              maxLength={7}
            />
            <input
              type="color"
              aria-label={t("hex")}
              value={/^#[0-9a-fA-F]{6}$/.test(f.hex_color) ? f.hex_color : "#c2185b"}
              onChange={(e) => {
                set("hex_color", e.target.value);
                set("auto", false);
              }}
              className="size-10 shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0"
            />
          </div>
        </div>
      </div>
      <SwitchRow
        title={t("inStock")}
        checked={f.in_stock}
        onChange={(v) => set("in_stock", v)}
        className="mt-4"
      />
      {error && (
        <Notice tone="danger" className="mt-4">
          {error}
        </Notice>
      )}
      <div className="mt-8 flex items-center justify-between">
        {polish ? (
          <Button variant="danger" onClick={remove} disabled={busy}>
            {tc("delete")}
          </Button>
        ) : (
          <span />
        )}
        <Button onClick={save} loading={busy}>
          {td("saveChanges")}
        </Button>
      </div>
    </Dialog>
  );
}

function ServiceEditor({
  salon,
  service,
  onClose,
}: {
  salon: { id: string; currency: string };
  service: ServiceRow | null;
  onClose: () => void;
}) {
  const t = useTranslations("catalog");
  const td = useTranslations("ui.dash");
  const tc = useTranslations("common");
  const tcs = useTranslations("catalog.serviceCategories");
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [f, setF] = React.useState({
    name: service?.name ?? "",
    category: service?.category ?? "gel",
    price: service?.price ?? 0,
    duration_min: service?.duration_min ?? 60,
    buffer_min: service?.buffer_min ?? 0,
    is_active: service?.is_active ?? true,
    supports_tryon: service?.supports_tryon ?? true,
    description: service?.description ?? "",
  });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((c) => ({ ...c, [k]: v }));

  async function save() {
    if (f.name.trim().length < 2) return setError(t("serviceName"));
    setBusy(true);
    setError(null);
    const row = {
      salon_id: salon.id,
      name: f.name.trim(),
      category: f.category as never,
      price: f.price,
      duration_min: f.duration_min,
      buffer_min: f.buffer_min,
      is_active: f.is_active,
      supports_tryon: f.supports_tryon,
      description: f.description.trim() || null,
    };
    const { error: e } = service
      ? await supabase.from("services").update(row).eq("id", service.id)
      : await supabase.from("services").insert(row);
    setBusy(false);
    if (e) return setError(e.message);
    toast.success(tc("save"));
    router.refresh();
    onClose();
  }

  async function remove() {
    if (!service || !confirm(t("deleteConfirm"))) return;
    const { error: e } = await supabase.from("services").update({ is_active: false }).eq("id", service.id);
    if (e) return setError(e.message);
    router.refresh();
    onClose();
  }

  return (
    <Dialog open onClose={onClose} title={service ? service.name : t("newService")} sheet size="md">
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="se-name">{t("serviceName")}</Label>
          <Input
            id="se-name"
            value={f.name}
            onChange={(e) => set("name", e.target.value)}
            autoFocus={!service}
          />
        </div>
        <div>
          <Label htmlFor="se-cat">{t("serviceCategory")}</Label>
          <Select id="se-cat" value={f.category} onChange={(e) => set("category", e.target.value)}>
            {SERVICE_CATS.map((c) => (
              <option key={c} value={c}>
                {tcs(c as never)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="se-price">
            {tc("price")} ({salon.currency})
          </Label>
          <Input
            id="se-price"
            type="number"
            min={0}
            dir="ltr"
            value={f.price}
            onChange={(e) => set("price", Number(e.target.value))}
          />
        </div>
        <div>
          <Label htmlFor="se-dur">{tc("duration")}</Label>
          <Input
            id="se-dur"
            type="number"
            min={10}
            step={5}
            dir="ltr"
            value={f.duration_min}
            onChange={(e) => set("duration_min", Number(e.target.value))}
          />
        </div>
        <div>
          <Label htmlFor="se-buf">{t("buffer")}</Label>
          <Input
            id="se-buf"
            type="number"
            min={0}
            step={5}
            dir="ltr"
            value={f.buffer_min}
            onChange={(e) => set("buffer_min", Number(e.target.value))}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="se-desc">{td("about")}</Label>
          <Textarea
            id="se-desc"
            value={f.description}
            onChange={(e) => set("description", e.target.value)}
            className="min-h-14"
            maxLength={300}
          />
        </div>
      </div>
      <SwitchRow
        title={t("active")}
        checked={f.is_active}
        onChange={(v) => set("is_active", v)}
        className="mt-4"
      />
      <SwitchRow
        title={td("supportsTryon")}
        description={td("supportsTryonHint")}
        checked={f.supports_tryon}
        onChange={(v) => set("supports_tryon", v)}
      />
      {error && (
        <Notice tone="danger" className="mt-4">
          {error}
        </Notice>
      )}
      <div className="mt-8 flex items-center justify-between">
        {service ? (
          <Button variant="danger" onClick={remove} disabled={busy}>
            {td("deactivate")}
          </Button>
        ) : (
          <span />
        )}
        <Button onClick={save} loading={busy}>
          {td("saveChanges")}
        </Button>
      </div>
    </Dialog>
  );
}
