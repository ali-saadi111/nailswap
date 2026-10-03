"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { PageHeader } from "@/components/shell/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Dialog, Kpi, StatusDot, Tabs, paymentTone } from "@/components/ui/primitives";
import { Input, Label } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { api } from "@/lib/client/api";
import { fmtDateTime, money } from "@/lib/format";

export interface PaymentRow {
  id: string;
  purpose: string;
  amount: number;
  currency: string;
  method: string;
  provider: string;
  status: "pending" | "paid" | "failed" | "refunded";
  reference: string | null;
  createdAt: string;
  salonName: string;
  invoiceNumber: string | null;
}

export function PaymentsTable({ rows }: { rows: PaymentRow[] }) {
  const t = useTranslations("admin");
  const ta = useTranslations("ui.admin");
  const tb = useTranslations("billing");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [tab, setTab] = React.useState<"pending" | "all">("pending");
  const [confirm, setConfirm] = React.useState<{
    row: PaymentRow;
    status: "paid" | "failed" | "refunded";
  } | null>(null);
  const [ref, setRef] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const pending = rows.filter((r) => r.status === "pending");
  const list = tab === "pending" ? pending : rows;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const collected = rows
    .filter((r) => r.status === "paid" && new Date(r.createdAt) >= monthStart)
    .reduce((s, r) => s + r.amount, 0);

  async function apply() {
    if (!confirm) return;
    setBusy(true);
    try {
      await api.post(`/api/admin/payments/${confirm.row.id}`, {
        status: confirm.status,
        referenceNote: ref.trim() || undefined,
      });
      toast.success(t("markPaid"));
      setConfirm(null);
      setRef("");
      router.refresh();
    } catch {
      toast.error(tc("somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader context={ta("manualPaymentsSub")} title={t("payments")} />
      <div className="flex flex-wrap gap-x-14 gap-y-8">
        <Kpi value={pending.length} label={ta("awaitingConfirmation")} />
        <Kpi
          value={money(
            pending.reduce((s, r) => s + r.amount, 0),
            "USD",
            locale,
          )}
          label={ta("pendingAmount")}
        />
        <Kpi value={money(collected, "USD", locale)} label={ta("collectedMonth")} />
      </div>
      <Tabs
        className="mt-10"
        value={tab}
        onChange={setTab}
        items={[
          { value: "pending", label: t("pendingReview"), count: pending.length },
          { value: "all", label: tc("all"), count: rows.length },
        ]}
      />
      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[900px]">
          <div className="table-head grid-cols-[minmax(180px,1.4fr)_110px_120px_110px_minmax(120px,1fr)_150px_120px_180px]">
            <span>{ta("salon")}</span>
            <span>{ta("purpose")}</span>
            <span>{tb("method")}</span>
            <span className="text-end">{ta("amount")}</span>
            <span>{tb("reference")}</span>
            <span>{tc("date")}</span>
            <span>{tc("status")}</span>
            <span />
          </div>
          {list.map((r) => (
            <div
              key={r.id}
              className="table-row h-auto min-h-16 grid-cols-[minmax(180px,1.4fr)_110px_120px_110px_minmax(120px,1fr)_150px_120px_180px] py-2"
            >
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-medium">{r.salonName}</span>
                {r.invoiceNumber && (
                  <span className="text-muted block text-[13px]" dir="ltr">
                    {r.invoiceNumber}
                  </span>
                )}
              </span>
              <span className="capitalize">{r.purpose}</span>
              <span>{tb(`methods.${r.method}` as never)}</span>
              <span className="text-end tabular-nums">{money(r.amount, r.currency, locale)}</span>
              <span className="text-muted truncate" dir="ltr">
                {r.reference ?? "–"}
              </span>
              <span className="text-muted text-sm" dir="ltr">
                {fmtDateTime(r.createdAt, locale)}
              </span>
              <StatusDot tone={paymentTone(r.status)}>{ta(`pay_${r.status}` as never)}</StatusDot>
              <span className="flex items-center justify-end gap-4">
                {r.status === "pending" && (
                  <>
                    <button
                      type="button"
                      onClick={() => setConfirm({ row: r, status: "failed" })}
                      className="text-danger hover:text-foreground text-[15px] font-medium"
                    >
                      {ta("reject")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirm({ row: r, status: "paid" })}
                      className="text-accent hover:text-foreground text-[15px] font-medium"
                    >
                      {t("markPaid")}
                    </button>
                  </>
                )}
                {r.status === "paid" && (
                  <button
                    type="button"
                    onClick={() => setConfirm({ row: r, status: "refunded" })}
                    className="text-muted hover:text-danger text-sm"
                  >
                    {ta("refund")}
                  </button>
                )}
              </span>
            </div>
          ))}
          {list.length === 0 && <div className="text-muted py-8 text-[15px]">{ta("queueEmpty")}</div>}
        </div>
      </div>

      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={
          confirm
            ? `${confirm.row.salonName} · ${money(confirm.row.amount, confirm.row.currency, locale)}`
            : ""
        }
        size="sm"
      >
        {confirm && (
          <>
            <Label htmlFor="pay-ref">{tb("reference")}</Label>
            <Input id="pay-ref" value={ref} onChange={(e) => setRef(e.target.value)} dir="ltr" />
            <div className="mt-6 flex items-center justify-between">
              <Button variant="ghost" onClick={() => setConfirm(null)}>
                {tc("cancel")}
              </Button>
              <Button
                loading={busy}
                onClick={apply}
                className={confirm.status === "paid" ? "" : "bg-danger hover:bg-danger"}
              >
                {confirm.status === "paid"
                  ? t("markPaid")
                  : confirm.status === "failed"
                    ? ta("reject")
                    : ta("refund")}
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </>
  );
}
