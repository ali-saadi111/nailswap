"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { useTranslations } from "next-intl";
import { Wordmark } from "@/components/shell/wordmark";
import { Button, ButtonLink } from "@/components/ui/button";

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("ui.errors");
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[640px] flex-col px-6 py-4">
      <Wordmark />
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <h1 className="font-display text-[34px] leading-tight">{t("errorTitle")}</h1>
        <p className="text-muted mt-2 text-[15px]">{t("errorBody")}</p>
        <Button size="lg" className="mt-8" onClick={reset}>
          {t("retry")}
        </Button>
        <ButtonLink href="/" variant="link" className="mt-3">
          {t("goHome")}
        </ButtonLink>
      </div>
    </div>
  );
}
