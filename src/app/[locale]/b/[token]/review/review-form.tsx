"use client";

import * as React from "react";
import { Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { PhoneHeader, CloseButton } from "@/components/shell/phone-header";
import { StickyAction } from "@/components/shell/consumer-shell";
import { Button, ButtonLink } from "@/components/ui/button";
import { FilterToggle, Notice } from "@/components/ui/primitives";
import { Label, Textarea } from "@/components/ui/input";
import { PhoneOtpForm } from "@/components/auth/phone-otp-form";
import type { BookingView } from "@/components/booking/types";
import { api, isApiError } from "@/lib/client/api";
import { useMe } from "@/lib/client/use-me";
import { fmtDay } from "@/lib/format";
import { cn } from "@/lib/utils";

const TAGS = ["onTime", "clean", "lasting", "matches", "friendly", "value"] as const;
const MAX = 500;

export function ReviewForm({
  token,
  booking,
  existingRating,
}: {
  token: string;
  booking: BookingView;
  existingRating: number | null;
}) {
  const t = useTranslations("ui.booking");
  const locale = useLocale();
  const router = useRouter();
  const { user, loading, refresh } = useMe();
  const [rating, setRating] = React.useState(5);
  const [tags, setTags] = React.useState<string[]>([]);
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<{ pending: boolean } | null>(null);

  const salon = booking.salon!;
  const title = booking.design
    ? t("serviceDesign", { service: booking.service?.name ?? "", design: booking.design.name })
    : (booking.service?.name ?? "");

  async function submit() {
    setBusy(true);
    setError(null);
    const text = [tags.map((k) => t(`tags.${k}`)).join(" · "), body.trim()].filter(Boolean).join("\n");
    try {
      const r = await api.post<{ review: unknown; pendingModeration: boolean }>("/api/reviews", {
        bookingId: booking.id,
        rating,
        body: text || undefined,
      });
      setDone({ pending: r.pendingModeration });
    } catch (err) {
      if (isApiError(err, "already_exists")) setError(t("alreadyReviewed"));
      else if (isApiError(err, "booking_not_completed")) setError(t("notCompleted"));
      else if (isApiError(err, "unauthorized")) setError(t("signInToBook"));
      else setError(t("generic"));
    } finally {
      setBusy(false);
    }
  }

  const shell = (children: React.ReactNode) => (
    <div className="mx-auto flex min-h-dvh w-full max-w-[640px] flex-col px-6 pt-3 pb-4">
      <PhoneHeader
        leading={<CloseButton href={`/b/${token}`} />}
        trailing={
          <span className="text-muted max-w-[250px] py-2 text-end text-[13px]">
            {fmtDay(booking.startsAt, locale, salon.timezone)}
            {booking.staff ? ` · ${booking.staff.displayName}` : ""}
          </span>
        }
      />
      <div className="bg-hero -mx-6 mt-2 h-16 rounded-t-[36px] sm:mx-0" aria-hidden />
      <div className="bg-hero -mx-6 rounded-b-[36px] px-6 pb-6 sm:mx-0">{children}</div>
    </div>
  );

  if (existingRating !== null || done) {
    return shell(
      <>
        <h1 className="font-display mt-2 text-[30px] leading-[1.1]">
          {done ? t("thanks") : t("alreadyReviewed")}
        </h1>
        {done?.pending && <p className="text-muted mt-2 text-[15px]">{t("pendingModeration")}</p>}
        <ButtonLink href={`/s/${salon.slug}`} size="lg" className="mt-8 self-start">
          {salon.name}
        </ButtonLink>
      </>,
    );
  }

  if (booking.status !== "completed") {
    return shell(
      <>
        <h1 className="font-display mt-2 text-[30px] leading-[1.1]">
          {t("reviewTitle", { salon: salon.name })}
        </h1>
        <Notice className="mt-4">{t("notCompleted")}</Notice>
      </>,
    );
  }

  if (!loading && !user) {
    return shell(
      <>
        <h1 className="font-display mt-2 text-[30px] leading-[1.1]">
          {t("reviewTitle", { salon: salon.name })}
        </h1>
        <p className="text-muted mt-1.5 text-sm">{t("confirmPhoneBody")}</p>
        <PhoneOtpForm
          askName={false}
          onSuccess={async () => {
            await refresh();
            router.refresh();
          }}
        />
      </>,
    );
  }

  return shell(
    <>
      <h1 className="font-display mt-2 text-[30px] leading-[1.1]">
        {t("reviewTitle", { salon: salon.name })}
      </h1>
      <p className="text-muted mt-1.5 text-sm">{title}</p>

      <div
        role="radiogroup"
        aria-label={t("rating")}
        className="bg-surface mt-5 flex flex-wrap items-center justify-center gap-y-2 rounded-[24px] p-3"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={t("stars", { count: n })}
            onClick={() => setRating(n)}
            className="text-accent inline-flex size-11 items-center justify-center"
          >
            <Star
              className={cn("size-[30px]", n <= rating ? "fill-current" : "fill-transparent")}
              strokeWidth={1.5}
            />
          </button>
        ))}
        <span className="w-full text-center text-[15px] font-bold">
          {t(`ratingLabels.${rating}` as never)}
        </span>
      </div>

      <div className="text-muted mt-4 text-[13px]">{t("stoodOut")}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {TAGS.map((k) => (
          <FilterToggle
            key={k}
            pressed={tags.includes(k)}
            onClick={() => setTags((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]))}
          >
            {t(`tags.${k}`)}
          </FilterToggle>
        ))}
      </div>

      <div className="mt-5">
        <Label htmlFor="review-body">{t("yourReview")}</Label>
        <Textarea
          id="review-body"
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, MAX))}
          className="min-h-[140px]"
        />
        <div className="text-muted mt-1.5 text-end text-[12px] tabular-nums">
          {t("chars", { count: body.length, max: MAX })}
        </div>
      </div>

      {error && (
        <Notice tone="danger" className="mt-3">
          {error}
        </Notice>
      )}

      <StickyAction className="mt-6">
        <Button size="lg" className="w-full" loading={busy} onClick={submit}>
          {t("submit")}
        </Button>
      </StickyAction>
    </>,
  );
}
