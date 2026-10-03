"use client";

import * as React from "react";
import { Bookmark, CalendarPlus, Download, MessageCircle, Plus, Search, Upload } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/shell/dashboard-shell";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  Dialog,
  FilterToggle,
  Kpi,
  Notice,
  StatusDot,
  bookingTone,
} from "@/components/ui/primitives";
import { Input, Label, Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { api } from "@/lib/client/api";
import { fmtDay, fmtTimeRange, money, nowMs, prettyPhone } from "@/lib/format";
import { cn } from "@/lib/utils";
import { NewBookingDialog } from "../calendar/calendar-view";

export interface ClientRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  visits: number;
  noShows: number;
  lastVisitAt: string | null;
  createdAt: string;
  spent: number;
}

type Tag = "vip" | "new" | "regular" | "lapsed";
const PAGE = 25;

function tagOf(c: ClientRow): Tag {
  const days = c.lastVisitAt ? (Date.now() - new Date(c.lastVisitAt).getTime()) / 86400000 : null;
  if (c.visits >= 6) return days !== null && days > 120 ? "lapsed" : "vip";
  if (c.visits <= 1 && Date.now() - new Date(c.createdAt).getTime() < 45 * 86400000) return "new";
  if (days !== null && days > 90) return "lapsed";
  return "regular";
}

function maskPhone(p: string) {
  const pretty = prettyPhone(p);
  return pretty.replace(/(\+\d+ \d+) (\d+) (\d+)$/, "$1 ••• $3");
}

export function ClientsView({
  salon,
  rows,
  total,
  newThisMonth,
  initialClientId,
  staff,
  services,
  canEdit,
}: {
  salon: { id: string; name: string; timezone: string; currency: string };
  rows: ClientRow[];
  total: number;
  newThisMonth: number;
  initialClientId: string | null;
  staff: { id: string; name: string }[];
  services: { id: string; name: string; durationMin: number; price: number }[];
  canEdit: boolean;
}) {
  const t = useTranslations("clientsPage");
  const td = useTranslations("ui.dash");
  const tc = useTranslations("common");
  const tb = useTranslations("ui.booking");
  const locale = useLocale();
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [tag, setTag] = React.useState<Tag | "all">("all");
  const [limit, setLimit] = React.useState(PAGE);
  const [selectedId, setSelectedId] = React.useState<string | null>(initialClientId ?? rows[0]?.id ?? null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [bookOpen, setBookOpen] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const tags: Record<Tag, number> = { vip: 0, new: 0, regular: 0, lapsed: 0 };
  for (const r of rows) tags[tagOf(r)]++;
  const filtered = rows.filter((r) => {
    if (tag !== "all" && tagOf(r) !== tag) return false;
    if (search && !`${r.name} ${r.phone}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const visible = filtered.slice(0, limit);
  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const tagLabel = (k: Tag) => td(`tag_${k}` as never);

  async function importCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const fd = new FormData();
    fd.append("file", f);
    try {
      const r = await api.post<{ imported: number; skipped: number }>(
        `/api/dashboard/${salon.id}/clients/import`,
        fd,
      );
      toast.success(td("imported", { imported: r.imported, skipped: r.skipped }));
      router.refresh();
    } catch {
      toast.error(tc("somethingWrong"));
    }
  }

  return (
    <>
      <PageHeader
        context={`${salon.name} · ${td("clientsCount", { count: total })} · ${td("newThisMonth", { count: newThisMonth })}`}
        title={t("title")}
        actions={
          canEdit ? (
            <>
              <a
                href={`/api/dashboard/${salon.id}/clients/export`}
                className="text-accent hover:text-foreground inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium"
              >
                <Download className="size-5" strokeWidth={1.75} />
                {tc("export")}
              </a>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="text-accent hover:text-foreground inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium"
              >
                <Upload className="size-5" strokeWidth={1.75} />
                {td("import")}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={importCsv}
              />
              <Button onClick={() => setAddOpen(true)}>
                <Plus className="size-5" strokeWidth={1.75} />
                {td("addClient")}
              </Button>
            </>
          ) : undefined
        }
      />

      <div className={cn("grid grid-cols-1 gap-12", selected && "xl:grid-cols-[minmax(0,1fr)_380px]")}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <label className="relative inline-flex items-center">
              <Search className="text-muted pointer-events-none absolute start-0 size-5" strokeWidth={1.75} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={td("nameOrPhone")}
                className="field h-11 w-64 ps-7 text-base"
                aria-label={tc("search")}
              />
            </label>
            <div className="flex flex-wrap gap-x-5">
              <FilterToggle pressed={tag === "all"} onClick={() => setTag("all")}>
                {tc("all")}
              </FilterToggle>
              {(["vip", "new", "regular", "lapsed"] as Tag[]).map((k) => (
                <FilterToggle key={k} pressed={tag === k} onClick={() => setTag(k)}>
                  {tagLabel(k)}
                  {tags[k] ? <span className="text-muted font-normal"> · {tags[k]}</span> : null}
                </FilterToggle>
              ))}
            </div>
          </div>

          <div className="mt-2 overflow-x-auto">
            <div className="min-w-[720px]">
              <div className="table-head grid-cols-[minmax(200px,1.6fr)_80px_110px_90px_80px_100px]">
                <span>{td("client")}</span>
                <span>{td("visits")}</span>
                <span>{td("lastVisit")}</span>
                <span>{td("spent")}</span>
                <span>{td("looks")}</span>
                <span>{td("tag")}</span>
              </div>
              {visible.map((c) => {
                const k = tagOf(c);
                const active = c.id === selectedId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      "table-row h-auto min-h-[72px] w-full grid-cols-[minmax(200px,1.6fr)_80px_110px_90px_80px_100px] py-2 text-start",
                      active && "bg-surface-2",
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <Avatar name={c.name} size={44} />
                      <span className="min-w-0">
                        <span
                          className={cn("block truncate text-[15px] font-semibold", active && "text-accent")}
                        >
                          {c.name}
                        </span>
                        <span className="text-muted block text-[13px]" dir="ltr">
                          {maskPhone(c.phone)}
                        </span>
                      </span>
                    </span>
                    <span className="tabular-nums">{c.visits}</span>
                    <span className="text-muted" dir="ltr">
                      {c.lastVisitAt
                        ? fmtDay(c.lastVisitAt, locale, salon.timezone, { day: "numeric", month: "short" })
                        : "–"}
                    </span>
                    <span className="tabular-nums">{money(c.spent, salon.currency, locale)}</span>
                    <span className="text-muted inline-flex items-center gap-1">
                      <Bookmark className="size-4" strokeWidth={1.75} />–
                    </span>
                    <span
                      className={cn(
                        k === "new" ? "text-success" : k === "vip" ? "text-accent" : "text-muted",
                        "font-medium",
                      )}
                    >
                      {tagLabel(k)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-muted">
              {td("showingOf", { count: visible.length, total: filtered.length })}
            </span>
            {filtered.length > limit && (
              <button
                type="button"
                onClick={() => setLimit((n) => n + PAGE)}
                className="text-accent hover:text-foreground font-medium"
              >
                {td("loadMore")}
              </button>
            )}
          </div>
        </div>

        {selected && (
          <ClientPane
            key={selected.id}
            client={selected}
            salon={salon}
            canEdit={canEdit}
            onBook={() => setBookOpen(true)}
            tagLabel={tagLabel(tagOf(selected))}
          />
        )}
      </div>

      <AddClientDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        salonId={salon.id}
        onCreated={() => router.refresh()}
      />
      {selected && (
        <NewBookingDialog
          key={selected.id}
          open={bookOpen}
          onClose={() => setBookOpen(false)}
          salon={salon}
          staff={staff}
          services={services}
          date={new Date().toISOString().slice(0, 10)}
          onCreated={() => router.refresh()}
          clientDefaults={{ name: selected.name, phone: selected.phone }}
        />
      )}
      <span className="sr-only">{tb("name")}</span>
    </>
  );
}

function ClientPane({
  client,
  salon,
  canEdit,
  onBook,
  tagLabel,
}: {
  client: ClientRow;
  salon: { id: string; timezone: string; currency: string };
  canEdit: boolean;
  onBook: () => void;
  tagLabel: string;
}) {
  const t = useTranslations("clientsPage");
  const td = useTranslations("ui.dash");
  const tc = useTranslations("common");
  const tb = useTranslations("ui.booking");
  const locale = useLocale();
  const [notes, setNotes] = React.useState(client.notes ?? "");
  const [saving, setSaving] = React.useState(false);
  const [history, setHistory] = React.useState<
    | {
        id: string;
        startsAt: string;
        endsAt: string;
        status: string;
        service: string;
        design: string | null;
        total: number;
        staff: string;
      }[]
    | null
  >(null);

  React.useEffect(() => {
    const supabase = createClient();
    supabase
      .from("bookings")
      .select(
        "id, starts_at, ends_at, status, total_price, services(name), designs(name), staff(display_name)",
      )
      .eq("client_id", client.id)
      .order("starts_at", { ascending: false })
      .limit(12)
      .then(({ data }) =>
        setHistory(
          (data ?? []).map((b) => ({
            id: b.id,
            startsAt: b.starts_at,
            endsAt: b.ends_at,
            status: b.status,
            service: b.services?.name ?? "",
            design: b.designs?.name ?? null,
            total: Number(b.total_price),
            staff: b.staff?.display_name ?? "",
          })),
        ),
      );
  }, [client.id]);

  async function saveNotes() {
    setSaving(true);
    const { error } = await createClient()
      .from("clients")
      .update({ notes: notes.trim() || null })
      .eq("id", client.id);
    setSaving(false);
    if (error) toast.error(tc("somethingWrong"));
    else toast.success(tc("save"));
  }

  const nowTs = nowMs();
  const upcoming =
    history?.filter(
      (h) => new Date(h.startsAt).getTime() > nowTs && (h.status === "new" || h.status === "confirmed"),
    ) ?? [];
  const past = history?.filter((h) => !upcoming.includes(h)) ?? [];
  const statusLabel = (s: string) =>
    s === "new"
      ? tb("awaitingSalon")
      : s === "confirmed"
        ? tb("confirmed")
        : s === "completed"
          ? tb("completed")
          : s === "no_show"
            ? tb("noShow")
            : tb("cancelledStatus");

  return (
    <aside className="border-border min-w-0 xl:border-s xl:ps-8">
      <div className="flex items-start gap-4">
        <Avatar name={client.name} size={64} serif />
        <div className="min-w-0 flex-1">
          <h2 className="font-display truncate text-[32px] leading-none">{client.name}</h2>
          <div className="text-muted mt-2 text-[13px]">
            {tagLabel} ·{" "}
            {td("since", {
              date: fmtDay(client.createdAt, locale, salon.timezone, { month: "short", year: "numeric" }),
            })}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-6">
        <a
          href={`https://wa.me/${client.phone.replace(/\D/g, "")}`}
          target="_blank"
          rel="noreferrer"
          className="text-accent hover:text-foreground inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium"
        >
          <MessageCircle className="size-5" strokeWidth={1.75} />
          {td("message")}
        </a>
        {canEdit && (
          <button
            type="button"
            onClick={onBook}
            className="text-accent hover:text-foreground inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium"
          >
            <CalendarPlus className="size-5" strokeWidth={1.75} />
            {td("newBooking")}
          </button>
        )}
      </div>
      <div className="mt-3 space-y-1 text-[15px]">
        <div dir="ltr">{prettyPhone(client.phone)}</div>
        {client.email && <div>{client.email}</div>}
      </div>
      <div className="mt-6 flex gap-10">
        <Kpi value={client.visits} label={td("visits")} />
        <Kpi value={money(client.spent, salon.currency, locale)} label={td("spent")} />
        <Kpi value={client.noShows} label={td("noShows")} />
      </div>

      {upcoming.length > 0 && (
        <div className="mt-6">
          {upcoming.map((h) => (
            <Link key={h.id} href={`/dashboard/bookings/${h.id}`} className="block">
              <div className="flex items-center gap-2 text-[15px]">
                <CalendarPlus className="text-accent size-[18px]" strokeWidth={1.75} />
                <b className="font-semibold" dir="ltr">
                  {fmtDay(h.startsAt, locale, salon.timezone)}{" "}
                  {fmtTimeRange(h.startsAt, h.endsAt, locale, salon.timezone)}
                </b>
                <span>
                  · {h.service}
                  {h.design ? ` + ${h.design}` : ""}
                </span>
              </div>
              <div className="text-muted ms-7 mt-1 text-[13px]">
                <StatusDot tone={bookingTone(h.status)}>{statusLabel(h.status)}</StatusDot> · {h.staff}
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6">
        <Label htmlFor="client-notes">{t("notes")}</Label>
        <Textarea
          id="client-notes"
          value={notes}
          placeholder={t("notesPlaceholder")}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-16"
          disabled={!canEdit}
        />
        {canEdit && notes !== (client.notes ?? "") && (
          <Button variant="link" className="mt-1" loading={saving} onClick={saveNotes}>
            {tc("save")}
          </Button>
        )}
      </div>

      <div className="border-border mt-6 border-t pt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-muted text-[13px]">{t("visitHistory")}</h3>
          <span className="text-muted text-[13px]">{past.length}</span>
        </div>
        <ul className="mt-1">
          {past.slice(0, 6).map((h) => (
            <li
              key={h.id}
              className="border-border flex min-h-11 items-center justify-between gap-3 border-b text-[15px] last:border-b-0"
            >
              <Link href={`/dashboard/bookings/${h.id}`} className="hover:text-accent min-w-0 truncate">
                <span dir="ltr">
                  {fmtDay(h.startsAt, locale, salon.timezone, { day: "numeric", month: "short" })}
                </span>{" "}
                · {h.service}
                {h.design ? ` · ${h.design}` : ""}
              </Link>
              <span
                className={cn("shrink-0 tabular-nums", h.status === "cancelled" && "text-muted line-through")}
              >
                {money(h.total, salon.currency, locale)}
              </span>
            </li>
          ))}
          {history && past.length === 0 && <li className="text-muted py-2 text-sm">–</li>}
        </ul>
      </div>
    </aside>
  );
}

function AddClientDialog({
  open,
  onClose,
  salonId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  salonId: string;
  onCreated: () => void;
}) {
  const td = useTranslations("ui.dash");
  const tc = useTranslations("common");
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const digits = phone
      .replace(/[^\d+]/g, "")
      .replace(/^\+/, "")
      .replace(/^00/, "");
    const normalised = digits.length <= 8 ? `961${digits.replace(/^0/, "")}` : digits;
    const { error: err } = await createClient()
      .from("clients")
      .insert({ salon_id: salonId, full_name: name.trim(), phone: normalised, email: email.trim() || null });
    setBusy(false);
    if (err) {
      setError(err.code === "23505" ? td("clientExists") : tc("somethingWrong"));
      return;
    }
    toast.success(tc("done"));
    onCreated();
    onClose();
    setName("");
    setPhone("");
    setEmail("");
  }

  return (
    <Dialog open={open} onClose={onClose} title={td("addClient")} size="sm">
      <form onSubmit={submit} className="space-y-6">
        <div>
          <Label htmlFor="ac-name">{tc("name")}</Label>
          <Input id="ac-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
        </div>
        <div>
          <Label htmlFor="ac-phone">{tc("phone")}</Label>
          <Input
            id="ac-phone"
            type="tel"
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="ac-email">{tc("email")}</Label>
          <Input
            id="ac-email"
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        {error && <Notice tone="danger">{error}</Notice>}
        <div className="flex justify-end">
          <Button type="submit" loading={busy}>
            {tc("create")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
