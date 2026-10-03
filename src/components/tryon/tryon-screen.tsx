"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Tabs } from "@/components/ui/primitives";
import { PhoneHeader, BackButton, CloseButton } from "@/components/shell/phone-header";
import { TrackView } from "@/components/track-view";
import { LiveAr, type Capture } from "./live-ar";
import { AiPhoto } from "./ai-photo";
import { JobProgress } from "./job-progress";
import { Result } from "./result";
import { api, isApiError } from "@/lib/client/api";
import { defaultLookFor, fetchJob, startSession, styleForLook, uploadTryOn } from "@/lib/client/tryon";
import type { JobView, Look, TryonDesign, TryonPolish, TryonSalon } from "./types";

type Mode = "ar" | "ai";
type Stage = "photo" | "progress" | "result";

export function TryonScreen({
  salon,
  designs,
  polishes,
  initialDesignId,
  initialJobId,
  closeHref,
}: {
  salon: TryonSalon | null;
  designs: TryonDesign[];
  polishes: TryonPolish[];
  initialDesignId?: string | null;
  initialJobId?: string | null;
  closeHref: string;
}) {
  const t = useTranslations("ui.tryon");
  const locale = useLocale();
  const router = useRouter();
  const initialDesign = designs.find((d) => d.id === initialDesignId) ?? (salon ? designs[0] : null) ?? null;
  const [look, setLook] = React.useState<Look>(() => defaultLookFor(initialDesign));
  const [mode, setMode] = React.useState<Mode>(initialJobId ? "ai" : "ar");
  const [stage, setStage] = React.useState<Stage>(initialJobId ? "progress" : "photo");
  const [capture, setCapture] = React.useState<Capture | null>(null);
  const [job, setJob] = React.useState<JobView | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const sessionId = React.useRef<string | null>(null);

  const design = designs.find((d) => d.id === look.designId) ?? null;
  const style = React.useMemo(() => styleForLook(look, design, polishes), [look, design, polishes]);
  const contextSalonId = salon?.id ?? design?.salonId ?? null;
  const designLabel = design
    ? `${design.name} · ${t(`shapes.${look.shape}`)} · ${t(`lengths.${look.length}`).toLowerCase()}`
    : [
        t(`shapes.${look.shape}`),
        t(`lengths.${look.length}`).toLowerCase(),
        look.art || t(`finishes.${look.finish}`),
      ].join(" · ");

  // Resume a job (after sign-in redirect, or a shared progress link).
  React.useEffect(() => {
    if (!initialJobId) return;
    let cancelled = false;
    fetchJob(initialJobId)
      .then((j) => {
        if (cancelled) return;
        setJob(j);
        setStage(
          j.status === "succeeded"
            ? "result"
            : j.status === "failed" || j.status === "rejected"
              ? "photo"
              : "progress",
        );
        if (j.designId && designs.some((d) => d.id === j.designId))
          setLook((l) => ({ ...l, designId: j.designId }));
      })
      .catch(() => setStage("photo"));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialJobId]);

  // Poll the job every 2 s while it runs (anonymous users cannot subscribe via Realtime).
  React.useEffect(() => {
    if (stage !== "progress" || !job) return;
    const terminal = ["succeeded", "failed", "rejected"];
    if (terminal.includes(job.status)) return;
    const id = setTimeout(async () => {
      try {
        const j = await fetchJob(job.id);
        setJob(j);
        if (j.status === "succeeded") setStage("result");
        else if (j.status === "failed" || j.status === "rejected") {
          setError(errorMessage(j.errorCode, j.status === "rejected"));
          setStage("photo");
        }
      } catch {
        /* keep polling */
      }
    }, 2000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, job?.id, job?.status, job?.progress]);

  function errorMessage(code: string | null | undefined, rejected = false) {
    switch (code) {
      case "quota_exhausted":
        return t("quotaExhausted");
      case "inappropriate":
        return t("inappropriate");
      case "ai_not_configured":
        return t("aiNotConfigured");
      case "not_hand":
        return t("notHand");
      case "nails_not_visible":
        return t("nailsNotVisible");
      case "too_small":
        return t("tooSmall");
      case "rate_limited":
        return t("rateLimited");
      default:
        return rejected ? t("rejected") : t("generic");
    }
  }

  function selectDesign(d: TryonDesign | null) {
    if (!d) {
      setLook((l) => ({ ...l, designId: null }));
      return;
    }
    setLook((l) => ({
      ...l,
      designId: d.id,
      polishId: null,
      shape: (d.shape as Look["shape"]) ?? l.shape,
      length: (d.length as Look["length"]) ?? l.length,
      art: "",
    }));
  }

  function selectPolish(p: TryonPolish) {
    setLook((l) => ({
      ...l,
      designId: null,
      polishId: p.id,
      color: p.hexColor,
      finish: p.finish as Look["finish"],
      art: "",
    }));
  }

  function onCapture(c: Capture) {
    setCapture(c);
    setMode("ai");
    setStage("photo");
    setError(null);
  }

  async function generate(c: Capture) {
    setBusy(true);
    setError(null);
    try {
      if (!sessionId.current)
        sessionId.current = await startSession({
          mode: "ai",
          salonId: contextSalonId,
          designId: look.designId,
          polishId: look.polishId,
        });
      const j = await uploadTryOn({
        file: c.blob,
        hands: c.hands,
        look,
        salonId: contextSalonId,
        sessionId: sessionId.current,
        locale,
      });
      setJob(j);
      if (j.status === "succeeded") setStage("result");
      else if (j.status === "failed" || j.status === "rejected")
        setError(errorMessage(j.errorCode, j.status === "rejected"));
      else setStage("progress");
    } catch (err) {
      if (isApiError(err)) {
        if (err.code === "too_large") setError(t("dropHint"));
        else setError(errorMessage(err.code));
      } else setError(t("generic"));
    } finally {
      setBusy(false);
    }
  }

  async function cancelJob() {
    if (job) api.del(`/api/tryon/jobs/${job.id}`).catch(() => undefined);
    setJob(null);
    setStage("photo");
  }

  function tryAnother() {
    setJob(null);
    setCapture(null);
    setStage("photo");
    setMode("ar");
    if (initialJobId) router.replace(closeHref.includes("/s/") ? `${closeHref}/try` : "/try");
  }

  const bookHref =
    contextSalonId && (salon?.slug ?? design?.salonSlug)
      ? `/s/${salon?.slug ?? design!.salonSlug}/book${design ? `?designId=${design.id}` : ""}`
      : null;

  const showTabs = stage === "photo";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[640px] flex-col px-6 pt-3">
      <TrackView salonId={contextSalonId} designId={look.designId} payload={{ screen: "tryon" }} />
      {showTabs && (
        <PhoneHeader
          leading={
            mode === "ar" ? (
              <CloseButton href={closeHref} label={t("close")} />
            ) : (
              <BackButton fallback={closeHref} label={t("back")} />
            )
          }
          center={
            <Tabs
              value={mode}
              onChange={(m) => {
                setMode(m);
                setError(null);
              }}
              label={t("mode")}
              items={[
                { value: "ar", label: t("liveAr") },
                { value: "ai", label: t("aiPhoto") },
              ]}
            />
          }
          trailing={<span className="w-11" />}
        />
      )}
      {!showTabs && stage === "result" && (
        <div className="-mx-3 -mb-11 flex h-11 items-center">
          <CloseButton href={closeHref} label={t("close")} />
        </div>
      )}

      {mode === "ar" && stage === "photo" && (
        <LiveAr
          salon={salon}
          designs={designs}
          polishes={polishes}
          look={look}
          design={design}
          style={style}
          onLookChange={(p) => setLook((l) => ({ ...l, ...p }))}
          onSelectDesign={selectDesign}
          onSelectPolish={selectPolish}
          onCapture={onCapture}
          onUnsupported={() => {
            setMode("ai");
            setError(t("arUnsupported"));
          }}
          bookHref={bookHref}
        />
      )}

      {mode === "ai" && stage === "photo" && (
        <AiPhoto
          salon={salon}
          designs={designs}
          polishes={polishes}
          look={look}
          design={design}
          initialCapture={capture}
          onLookChange={(p) => setLook((l) => ({ ...l, ...p }))}
          onSelectDesign={selectDesign}
          onSelectPolish={selectPolish}
          onGenerate={generate}
          busy={busy}
          error={error}
        />
      )}

      {stage === "progress" && job && (
        <JobProgress
          job={job}
          photoUrl={capture?.url ?? job.inputUrl}
          designName={design?.name ?? t("custom")}
          onCancel={cancelJob}
        />
      )}
      {stage === "progress" && !job && (
        <div className="text-muted mt-10 text-center text-sm">{t("creating")}…</div>
      )}

      {stage === "result" && job && (
        <Result job={job} design={design} salon={salon} designLabel={designLabel} onTryAnother={tryAnother} />
      )}
    </div>
  );
}
