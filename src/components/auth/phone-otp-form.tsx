"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Turnstile } from "@marsidev/react-turnstile";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Notice } from "@/components/ui/primitives";
import { OtpInput } from "./otp-input";
import { api, isApiError } from "@/lib/client/api";
import { refreshMe } from "@/lib/client/use-me";
import { publicEnv } from "@/lib/env";
import { prettyPhone } from "@/lib/format";

export interface VerifyResult {
  ok: boolean;
  user: { id: string; phone: string; fullName: string | null; isPlatformAdmin: boolean };
  isNew: boolean;
  salons: { id?: string; slug?: string; name?: string; role: string }[];
}

const COUNTRIES = [
  { code: "961", label: "LB +961" },
  { code: "971", label: "AE +971" },
  { code: "966", label: "SA +966" },
  { code: "33", label: "FR +33" },
  { code: "44", label: "UK +44" },
  { code: "1", label: "US +1" },
];

type Step = "phone" | "code" | "name";

/**
 * Phone → 6-digit code → (first name on first sign-in). Used by /login and the booking flow.
 * Calls `onSuccess` once the session cookie is set (and the name saved when asked).
 */
export function PhoneOtpForm({
  onSuccess,
  submitLabel,
  askName = true,
  hint,
  initialPhone = "",
}: {
  onSuccess: (r: VerifyResult) => void | Promise<void>;
  /** Label of the verify pill (e.g. "Verify and book"). */
  submitLabel?: string;
  askName?: boolean;
  /** Extra line under the code input (e.g. slot hold notice). */
  hint?: React.ReactNode;
  initialPhone?: string;
}) {
  const t = useTranslations("ui.auth");
  const locale = useLocale();
  const [step, setStep] = React.useState<Step>("phone");
  const [country, setCountry] = React.useState("961");
  const [local, setLocal] = React.useState(initialPhone);
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = React.useState<string | undefined>();
  const [cooldown, setCooldown] = React.useState(0);
  const [verified, setVerified] = React.useState<VerifyResult | null>(null);

  const digits = `${country}${local.replace(/\D/g, "").replace(/^0+/, "")}`;
  const pretty = prettyPhone(digits);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  function mapError(e: unknown) {
    if (isApiError(e, "invalid_phone") || isApiError(e, "validation")) return t("invalidPhone");
    if (isApiError(e, "invalid_code")) return t("invalidCode");
    if (isApiError(e, "rate_limited")) return t("rateLimited");
    if (isApiError(e, "turnstile_required") || isApiError(e, "turnstile_failed")) return t("turnstile");
    return t("generic");
  }

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    if (local.replace(/\D/g, "").length < 6) {
      setError(t("invalidPhone"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/auth/otp/send", { phone: digits, turnstileToken, locale });
      setStep("code");
      setCode("");
      setCooldown(45);
    } catch (err) {
      setError(mapError(err));
    } finally {
      setBusy(false);
    }
  }

  async function verify(value = code) {
    if (value.length < 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<VerifyResult>("/api/auth/otp/verify", { phone: digits, code: value, locale });
      await refreshMe();
      if (askName && r.isNew && !r.user.fullName) {
        setVerified(r);
        setStep("name");
      } else {
        await onSuccess(r);
      }
    } catch (err) {
      setError(mapError(err));
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!verified) return;
    setBusy(true);
    try {
      const trimmed = name.trim();
      if (trimmed) await api.patch("/api/auth/me", { fullName: trimmed });
      await refreshMe();
      await onSuccess({ ...verified, user: { ...verified.user, fullName: trimmed || null } });
    } catch (err) {
      setError(mapError(err));
    } finally {
      setBusy(false);
    }
  }

  if (step === "name") {
    return (
      <form onSubmit={saveName} className="mt-7">
        <Label htmlFor="otp-name">{t("yourName")}</Label>
        <Input
          id="otp-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          autoFocus
          maxLength={80}
        />
        <p className="text-muted mt-1.5 text-[13px]">{t("nameHint")}</p>
        {error && (
          <Notice tone="danger" className="mt-4">
            {error}
          </Notice>
        )}
        <Button type="submit" size="lg" loading={busy} className="mt-6 w-full">
          {submitLabel ?? t("signIn")}
        </Button>
      </form>
    );
  }

  return (
    <div>
      <form onSubmit={sendCode} className="mt-7">
        <Label htmlFor="otp-phone">{t("phone")}</Label>
        <div className="flex items-end gap-4">
          <span className="relative w-24 shrink-0">
            <select
              aria-label={t("countryCode")}
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              disabled={step === "code"}
              className="field cursor-pointer appearance-none pe-5 text-base"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </span>
          <Input
            id="otp-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            dir="ltr"
            placeholder="71 234 567"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            disabled={step === "code"}
            autoFocus={step === "phone"}
            className="min-w-0 flex-1"
          />
        </div>
        {publicEnv.turnstileSiteKey && step === "phone" && (
          <div className="mt-4">
            <Turnstile
              siteKey={publicEnv.turnstileSiteKey}
              onSuccess={setTurnstileToken}
              options={{ size: "flexible", theme: "light" }}
            />
          </div>
        )}
        {step === "phone" && (
          <>
            {error && (
              <Notice tone="danger" className="mt-4">
                {error}
              </Notice>
            )}
            <Button type="submit" size="lg" loading={busy} className="mt-6 w-full">
              {busy ? t("sending") : t("sendCode")}
            </Button>
          </>
        )}
      </form>

      {step === "code" && (
        <div>
          <div className="text-success mt-2 flex min-h-11 items-center gap-2 text-sm" role="status">
            <Check className="size-4" strokeWidth={2.2} />
            <span className="flex-1" dir="ltr">
              {t("codeSent", { phone: pretty })}
            </span>
            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setError(null);
              }}
              className="text-accent hover:text-foreground text-sm font-medium"
            >
              {t("edit")}
            </button>
          </div>
          <div className="text-muted mt-5 text-[13px]" id="otp-code-label">
            {t("enterCode")}
          </div>
          <div className="mt-1" role="group" aria-labelledby="otp-code-label">
            <OtpInput
              value={code}
              onChange={setCode}
              onComplete={(v) => void verify(v)}
              disabled={busy}
              invalid={!!error}
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            {cooldown > 0 ? (
              <span className="text-muted">
                {t("resendIn")}{" "}
                <b className="text-foreground font-semibold tabular-nums">
                  0:{String(cooldown).padStart(2, "0")}
                </b>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => void sendCode()}
                className="text-accent hover:text-foreground font-medium"
              >
                {t("resend")}
              </button>
            )}
          </div>
          {hint && <div className="mt-5">{hint}</div>}
          {error && (
            <Notice tone="danger" className="mt-4">
              {error}
            </Notice>
          )}
          <Button
            type="button"
            size="lg"
            loading={busy}
            onClick={() => void verify()}
            disabled={code.length < 6}
            className="mt-6 w-full"
          >
            {busy ? t("verifying") : (submitLabel ?? t("verify"))}
          </Button>
        </div>
      )}
    </div>
  );
}
