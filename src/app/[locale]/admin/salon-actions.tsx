"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, Notice } from "@/components/ui/primitives";
import { Label, Select, Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { api } from "@/lib/client/api";

export interface AdminSalon {
  id: string;
  slug: string;
  name: string;
  status: "pending" | "active" | "suspended";
  directoryApproved: boolean;
  plan: "trial" | "basic" | "pro";
}

/** Approve / suspend / change plan / impersonate — shared by Approvals and Salons. */
export function SalonActions({
  salon,
  compact,
  onDone,
}: {
  salon: AdminSalon;
  compact?: boolean;
  onDone?: () => void;
}) {
  const t = useTranslations("admin");
  const ta = useTranslations("ui.admin");
  const tc = useTranslations("common");
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [reasonFor, setReasonFor] = React.useState<null | "suspend" | "impersonate" | "reject">(null);
  const [reason, setReason] = React.useState("");
  const [plan, setPlan] = React.useState(salon.plan);
  const [error, setError] = React.useState<string | null>(null);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      toast.success(ok);
      setReasonFor(null);
      setReason("");
      onDone?.();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : tc("somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  const approve = () =>
    run(
      () => api.post(`/api/admin/salons/${salon.id}/status`, { status: "active", directoryApproved: true }),
      t("approve"),
    );
  const unapprove = () =>
    run(
      () => api.post(`/api/admin/salons/${salon.id}/status`, { status: "active", directoryApproved: false }),
      t("unapprove"),
    );
  const activate = () =>
    run(() => api.post(`/api/admin/salons/${salon.id}/status`, { status: "active" }), t("activate"));
  const suspend = () =>
    run(
      () =>
        api.post(`/api/admin/salons/${salon.id}/status`, {
          status: "suspended",
          reason: reason.trim() || undefined,
        }),
      t("suspend"),
    );
  const changePlan = () =>
    run(() => api.post(`/api/admin/salons/${salon.id}/plan`, { plan }), t("changePlan"));
  const impersonate = () =>
    run(async () => {
      await api.post("/api/admin/impersonation", { salonId: salon.id, reason: reason.trim() });
      window.location.assign(
        new URL(window.location.pathname.replace(/\/admin.*/, "/dashboard"), window.location.origin).href,
      );
    }, t("impersonate"));

  return (
    <div className={compact ? "flex flex-wrap items-center gap-x-5" : "space-y-6"}>
      {!compact && (
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <Label htmlFor={`plan-${salon.id}`}>{t("changePlan")}</Label>
            <Select
              id={`plan-${salon.id}`}
              value={plan}
              onChange={(e) => setPlan(e.target.value as AdminSalon["plan"])}
            >
              <option value="trial">Trial</option>
              <option value="basic">Basic</option>
              <option value="pro">Pro</option>
            </Select>
          </div>
          <Button variant="link" disabled={busy || plan === salon.plan} onClick={changePlan}>
            {tc("apply")}
          </Button>
        </div>
      )}
      {error && <Notice tone="danger">{error}</Notice>}
      <div className={compact ? "contents" : "flex flex-wrap items-center justify-between gap-4"}>
        <div className="flex flex-wrap items-center gap-x-5">
          {salon.status !== "suspended" ? (
            <Button variant="danger" size="md" disabled={busy} onClick={() => setReasonFor("suspend")}>
              {salon.status === "pending" ? ta("reject") : t("suspend")}
            </Button>
          ) : (
            <Button variant="link" size="md" disabled={busy} onClick={activate}>
              {t("activate")}
            </Button>
          )}
          {salon.status === "active" && salon.directoryApproved && (
            <Button variant="ghost" size="md" disabled={busy} onClick={unapprove}>
              {t("unapprove")}
            </Button>
          )}
          <Button variant="ghost" size="md" disabled={busy} onClick={() => setReasonFor("impersonate")}>
            {t("impersonate")}
          </Button>
        </div>
        {(salon.status !== "active" || !salon.directoryApproved) && (
          <Button size={compact ? "md" : "lg"} loading={busy} onClick={approve}>
            {t("approve")}
          </Button>
        )}
      </div>

      <Dialog
        open={reasonFor !== null}
        onClose={() => setReasonFor(null)}
        title={reasonFor === "impersonate" ? t("impersonate") : t("suspend")}
        description={reasonFor === "impersonate" ? ta("impersonateNote") : undefined}
        size="sm"
      >
        <Label htmlFor="adm-reason">{ta("reason")}</Label>
        <Textarea
          id="adm-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={300}
          autoFocus
        />
        {error && (
          <Notice tone="danger" className="mt-3">
            {error}
          </Notice>
        )}
        <div className="mt-6 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setReasonFor(null)}>
            {tc("cancel")}
          </Button>
          <Button
            loading={busy}
            disabled={reasonFor === "impersonate" && reason.trim().length < 3}
            onClick={reasonFor === "impersonate" ? impersonate : suspend}
            className={reasonFor === "impersonate" ? "" : "bg-danger hover:bg-danger"}
          >
            {reasonFor === "impersonate" ? ta("startImpersonation") : t("suspend")}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
