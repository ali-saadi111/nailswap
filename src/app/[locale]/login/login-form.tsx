"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PhoneOtpForm, type VerifyResult } from "@/components/auth/phone-otp-form";

export function LoginForm({ next, locale }: { next: string | null; locale: string }) {
  const t = useTranslations("ui.auth");

  function destination(r: VerifyResult) {
    if (next) return next;
    if (r.user.isPlatformAdmin) return `/${locale}/admin`;
    if (r.salons.length) return `/${locale}/dashboard`;
    return `/${locale}/account`;
  }

  return (
    <>
      <PhoneOtpForm
        onSuccess={(r) => {
          // Full navigation so the proxy sees the fresh session cookie on protected routes.
          window.location.assign(destination(r));
        }}
      />
      <p className="text-muted mt-5 text-center text-[12px]">
        {t.rich("acceptTerms", {
          terms: (chunks) => (
            <Link href="/legal/terms" className="text-accent">
              {chunks}
            </Link>
          ),
          privacy: (chunks) => (
            <Link href="/legal/privacy" className="text-accent">
              {chunks}
            </Link>
          ),
        })}
      </p>
    </>
  );
}
