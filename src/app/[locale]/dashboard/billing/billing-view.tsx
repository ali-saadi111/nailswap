"use client";

import * as React from "react";
import { Check, Download, Mail } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/shell/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Dialog, Dot, Meter, Notice, Skeleton, StatusDot, paymentTone } from "@/components/ui/primitives";
import { Input, Label, Select } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { api, isApiError } from "@/lib/client/api";
import { fmtDay, money, num } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Plan {
  code: "trial" | "basic" | "pro";
  name: string;
  price_usd: number;
  ai_quota_monthly: number;
  staff_seats: number;
  remove_branding: boolean;
  directory_priority: number;
  trial_days: number;
}
interface Billing {
  subscription: {
    plan_code: string;
    status: string;
    current_period_end: string;
    trial_ends_at: string | null;
    grace_ends_at: string | null;
    plans: Plan | null;
  } | null;
  plans: Plan[];
  quota: { quota: number; used: number; topup_credits: number; remaining: number; period_end: string } | null;
  invoices: {
    id: string;
    number: string;
    status: string;
    currency: string;
    total: number;
    period_start: string | null;
    period_end: string | null;
    due_at: string;
    paid_at: string | null;
    created_at: string;
    pdfUrl: string;
  }[];
  payments: {
    id: string;
    purpose: string;
    amount: number;
    currency: string;
    method: string;
    status: string;
    reference_note: string | null;
    created_at: string;
  }[];
  options: {
    card: string | null;
    manualMethods: string[];
    topupPacks: { id: string; credits: number; priceUsd: number }[];
  };
}

type Purchase = { purpose: "subscription"; plan: "basic" | "pro" } | { purpose: "topup"; packId: string };

export function BillingView({
  salon,
  owner,
  returnStatus,
}: {
  salon: { id: string; name: string; currency: string; email: string | null };
  owner: boolean;
  returnStatus: string | null;
}) {
  const t = useTranslations("billing");
  const td = useTranslations("ui.dash");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [data, setData] = React.useState<Billing | null>(null);
  const [purchase, setPurchase] = React.useState<Purchase | null>(null);

  const load = React.useCallback(
    () =>
      api
        .get<Billing>(`/api/dashboard/${salon.id}/billing`)
        .then(setData)
        .catch(() => setData(null)),
    [salon.id],
  );
  React.useEffect(() => {
    void load();
  }, [load]);
  React.useEffect(() => {
    if (returnStatus === "paid") toast.success(t("paid"));
    if (returnStatus === "failed" || returnStatus === "cancelled") toast.error(tc("somethingWrong"));
  }, [returnStatus, t, tc]);

  if (!data) {
    return (
      <>
        <PageHeader context={salon.name} title={t("title")} />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="mt-4 w-72" />
      </>
    );
  }

  const sub = data.subscription;
  const current = sub?.plans ?? data.plans.find((p) => p.code === sub?.plan_code) ?? null;
  const statusTone =
    sub?.status === "active" || sub?.status === "trialing"
      ? "success"
      : sub?.status === "grace" || sub?.status === "past_due"
        ? "pending"
        : "danger";
  const renews =
    sub?.status === "trialing" && sub.trial_ends_at ? sub.trial_ends_at : sub?.current_period_end;
  const q = data.quota;

  return (
    <>
      <PageHeader
        context={`${salon.name}${current ? ` · ${current.name}` : ""}${renews ? ` · ${td("renews", { date: fmtDay(renews, locale, undefined, { day: "numeric", month: "short", year: "numeric" }) })}` : ""}`}
        title={t("title")}
        actions={
          <a
            href={`mailto:billing@nailswap.app?subject=${encodeURIComponent(salon.name)}`}
            className="text-accent hover:text-foreground inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium"
          >
            <Mail className="size-5" strokeWidth={1.75} />
            {td("billingContact")}
          </a>
        }
      />

      <div className="grid grid-cols-1 gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)]">
        <section>
          <div className="text-muted text-[15px]">{t("currentPlan")}</div>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="font-display text-[56px] leading-none">{current?.name ?? t("trial")}</span>
            {current && current.price_usd > 0 && (
              <span className="text-[24px] font-medium">
                {money(current.price_usd, "USD", locale)}{" "}
                <span className="text-muted text-base font-normal">{t("perMonth")}</span>
              </span>
            )}
            {sub && (
              <StatusDot tone={statusTone} className="text-[15px]">
                {td(`sub_${sub.status}` as never)}
              </StatusDot>
            )}
          </div>
          {renews && (
            <p className="text-muted mt-3 text-[15px]">
              {sub?.status === "trialing"
                ? td("trialEnds", {
                    date: fmtDay(renews, locale, undefined, {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    }),
                  })
                : td("renewsLong", {
                    date: fmtDay(renews, locale, undefined, {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    }),
                  })}
            </p>
          )}
          {sub?.status === "grace" && sub.grace_ends_at && (
            <Notice tone="warning" className="mt-3">
              {td("graceNotice", { date: fmtDay(sub.grace_ends_at, locale) })}
            </Notice>
          )}
        </section>

        {q && (
          <section>
            <div className="flex items-baseline justify-between">
              <span className="text-muted text-[15px]">{td("usageCycle")}</span>
              <span className="text-muted text-[15px]">
                {td("resets", {
                  date: fmtDay(q.period_end, locale, undefined, { day: "numeric", month: "short" }),
                })}
              </span>
            </div>
            <p className="mt-2 text-[17px]">
              <b className="font-semibold">{num(q.used, locale)}</b>{" "}
              {td("ofUsed", { total: num(q.quota, locale) })}
            </p>
            <Meter value={q.used} max={q.quota} label={t("aiQuota", { count: q.quota })} className="mt-2" />
            <p className="text-muted mt-2 text-[13px]">
              {td("creditsLeft", { count: num(q.remaining, locale) })}
              {q.topup_credits > 0 ? ` · ${td("topupCredits", { count: q.topup_credits })}` : ""}
            </p>
            {owner && (
              <div className="mt-5 flex flex-wrap items-center gap-x-6">
                <span className="text-muted text-sm">{t("topups")}</span>
                {data.options.topupPacks.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPurchase({ purpose: "topup", packId: p.id })}
                    className="text-accent hover:text-foreground min-h-11 text-[15px] font-medium"
                  >
                    {t("topupPack", { credits: p.credits })} · {money(p.priceUsd, "USD", locale)}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <div className="mt-14 grid grid-cols-1 gap-x-16 gap-y-14 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section>
          <div className="flex items-end justify-between">
            <h2 className="font-display text-[28px] leading-none">{t("plans")}</h2>
            <span className="text-muted text-[15px]">{td("pricesPerMonth")}</span>
          </div>
          <div className="mt-8 grid gap-10 sm:grid-cols-3">
            {data.plans.map((p) => {
              const isCurrent = p.code === sub?.plan_code;
              const upgrade = !isCurrent && p.price_usd > (current?.price_usd ?? 0);
              return (
                <div key={p.code} className="min-w-0">
                  <div className="flex items-center gap-2.5 text-[17px] font-semibold">
                    {isCurrent && <Dot tone="accent" />}
                    {p.name}
                    {isCurrent && <span className="text-muted text-sm font-normal">{t("current")}</span>}
                  </div>
                  <div className="font-display mt-3 text-[40px] leading-none">
                    {money(p.price_usd, "USD", locale)}
                    <span className="text-muted font-sans text-base"> {t("perMonth")}</span>
                  </div>
                  <ul className="mt-4 space-y-2 text-[15px]">
                    {[
                      t("aiQuota", { count: p.ai_quota_monthly }),
                      t("arUnlimited"),
                      t("seats", { count: p.staff_seats }),
                      p.directory_priority > 1 ? t("directoryPriority") : t("directory"),
                      ...(p.remove_branding ? [t("branding")] : []),
                    ].map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="text-success mt-0.5 size-4 shrink-0" strokeWidth={2.2} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6">
                    {isCurrent ? (
                      <span className="text-muted text-[15px]">{td("yourPlan")}</span>
                    ) : p.code === "trial" ? null : owner ? (
                      upgrade ? (
                        <Button
                          onClick={() =>
                            setPurchase({ purpose: "subscription", plan: p.code as "basic" | "pro" })
                          }
                        >
                          {t("choose", { plan: p.name })}
                        </Button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setPurchase({ purpose: "subscription", plan: p.code as "basic" | "pro" })
                          }
                          className="text-accent hover:text-foreground min-h-11 text-[15px] font-medium"
                        >
                          {t("choose", { plan: p.name })}
                        </button>
                      )
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="border-border xl:border-s xl:ps-12">
          <h2 className="font-display text-[28px] leading-none">{t("invoices")}</h2>
          <div className="mt-6">
            <div className="table-head grid-cols-[minmax(0,1fr)_90px_110px_44px]">
              <span>{td("dateNumber")}</span>
              <span className="text-end">{td("amount")}</span>
              <span>{tc("status")}</span>
              <span />
            </div>
            {data.invoices.map((inv) => (
              <div
                key={inv.id}
                className="table-row h-auto min-h-[64px] grid-cols-[minmax(0,1fr)_90px_110px_44px] py-2"
              >
                <div className="min-w-0">
                  <div className="text-[15px]" dir="ltr">
                    {inv.number}
                  </div>
                  <div className="text-muted truncate text-[13px]">
                    {fmtDay(inv.created_at, locale, undefined, { day: "numeric", month: "short" })}
                    {inv.period_start
                      ? ` · ${fmtDay(inv.period_start, locale, undefined, { month: "long" })}`
                      : ""}
                  </div>
                </div>
                <span className="text-end text-[15px] tabular-nums">
                  {money(inv.total, inv.currency, locale)}
                </span>
                <StatusDot
                  tone={inv.status === "paid" ? "success" : inv.status === "open" ? "pending" : "hollow"}
                >
                  {inv.status === "paid" ? t("paid") : inv.status === "open" ? t("open") : inv.status}
                </StatusDot>
                <a
                  href={inv.pdfUrl}
                  className="text-foreground hover:text-accent inline-flex size-11 items-center justify-center"
                  aria-label={t("downloadPdf")}
                >
                  <Download className="size-5" strokeWidth={1.75} />
                </a>
              </div>
            ))}
            {data.invoices.length === 0 && <div className="text-muted py-6 text-sm">–</div>}
          </div>

          {data.payments.some((p) => p.status === "pending") && (
            <div className="mt-8">
              <h3 className="text-[15px] font-semibold">{td("pendingPayments")}</h3>
              <ul className="mt-2">
                {data.payments
                  .filter((p) => p.status === "pending")
                  .map((p) => (
                    <li
                      key={p.id}
                      className="border-border flex min-h-11 items-center justify-between gap-3 border-b text-sm"
                    >
                      <span>
                        {t(`methods.${p.method}` as never)} · {money(p.amount, p.currency, locale)}
                      </span>
                      <StatusDot tone={paymentTone(p.status)}>{td("awaitingConfirmation")}</StatusDot>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <CheckoutDialog
        key={JSON.stringify(purchase)}
        purchase={purchase}
        onClose={() => setPurchase(null)}
        salonId={salon.id}
        options={data.options}
        plans={data.plans}
        onDone={load}
      />
    </>
  );
}

function CheckoutDialog({
  purchase,
  onClose,
  salonId,
  options,
  plans,
  onDone,
}: {
  purchase: Purchase | null;
  onClose: () => void;
  salonId: string;
  options: Billing["options"];
  plans: Plan[];
  onDone: () => void;
}) {
  const t = useTranslations("billing");
  const tc = useTranslations("common");
  const locale = useLocale();
  const methods = [...(options.card ? ["card"] : []), ...options.manualMethods];
  const [method, setMethod] = React.useState(methods[0] ?? "cash");
  const [reference, setReference] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [manual, setManual] = React.useState<{
    instructions: string;
    invoiceNumber: string;
    amount: number;
    currency: string;
  } | null>(null);

  if (!purchase) return null;
  const title =
    purchase.purpose === "subscription"
      ? t("choose", { plan: plans.find((p) => p.code === purchase.plan)?.name ?? purchase.plan })
      : t("topupPack", { credits: options.topupPacks.find((p) => p.id === purchase.packId)?.credits ?? 0 });
  const amount =
    purchase.purpose === "subscription"
      ? (plans.find((p) => p.code === purchase.plan)?.price_usd ?? 0)
      : (options.topupPacks.find((p) => p.id === purchase.packId)?.priceUsd ?? 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<
        | { kind: "redirect"; redirectUrl: string }
        | { kind: "manual"; instructions: string; invoiceNumber: string; amount: number; currency: string }
      >(`/api/dashboard/${salonId}/billing/checkout`, {
        ...purchase,
        method,
        referenceNote: reference.trim() || undefined,
      });
      if (r.kind === "redirect") {
        window.location.assign(r.redirectUrl);
        return;
      }
      setManual(r);
      onDone();
    } catch (err) {
      setError(isApiError(err, "card_unavailable") ? t("payManual") : tc("somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      description={`${money(amount, "USD", locale)}${purchase.purpose === "subscription" ? ` ${t("perMonth")}` : ""}`}
      size="sm"
    >
      {manual ? (
        <div>
          <Notice tone="success">{t("submitted")}</Notice>
          <p className="mt-4 text-[15px] leading-6">{manual.instructions}</p>
          <p className="text-muted mt-3 text-sm" dir="ltr">
            {t("invoice", { number: manual.invoiceNumber })} · {money(manual.amount, manual.currency, locale)}
          </p>
          <Button className="mt-6 w-full" onClick={onClose}>
            {tc("done")}
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-6">
          <div>
            <Label htmlFor="co-method">{t("method")}</Label>
            <Select id="co-method" value={method} onChange={(e) => setMethod(e.target.value)}>
              {methods.map((m) => (
                <option key={m} value={m}>
                  {t(`methods.${m}` as never)}
                </option>
              ))}
            </Select>
          </div>
          {method !== "card" && (
            <>
              <p className="text-muted text-sm leading-5">{t("manualHint")}</p>
              <div>
                <Label htmlFor="co-ref">{t("reference")}</Label>
                <Input
                  id="co-ref"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  dir="ltr"
                />
              </div>
            </>
          )}
          {error && <Notice tone="danger">{error}</Notice>}
          <Button type="submit" className={cn("w-full")} loading={busy}>
            {method === "card" ? t("payCard") : tc("confirm")}
          </Button>
        </form>
      )}
    </Dialog>
  );
}
