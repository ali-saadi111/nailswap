"use client";

import * as React from "react";
import { ArrowRight, Bookmark, SwitchCamera } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { DetectedHand } from "@/lib/ar/hand-tracker";
import type { PolishStyle } from "@/lib/ar/renderer";
import { IconButton } from "@/components/ui/button";
import { FilterToggle, StatusDot, Notice } from "@/components/ui/primitives";
import { DesignRail } from "./design-rail";
import { startSession } from "@/lib/client/tryon";
import { track } from "@/lib/client/api";
import type { Length, Look, Shape, TryonDesign, TryonPolish, TryonSalon } from "./types";
import { ALL_SHAPES, LENGTHS } from "./types";

export interface Capture {
  blob: Blob;
  url: string;
  hands: DetectedHand[];
  width: number;
  height: number;
}

type Status = "starting" | "ready" | "unsupported" | "denied" | "models";

/**
 * Live AR try-on: camera → MediaPipe hands → nail masks → Three.js polish shader, all on-device.
 * The camera view is the one big media area; controls sit below on the ground.
 */
export function LiveAr({
  salon,
  designs,
  polishes,
  look,
  design,
  style,
  onLookChange,
  onSelectDesign,
  onSelectPolish,
  onCapture,
  onUnsupported,
  bookHref,
}: {
  salon: TryonSalon | null;
  designs: TryonDesign[];
  polishes: TryonPolish[];
  look: Look;
  design: TryonDesign | null;
  style: PolishStyle;
  onLookChange: (patch: Partial<Look>) => void;
  onSelectDesign: (d: TryonDesign) => void;
  onSelectPolish: (p: TryonPolish) => void;
  onCapture: (c: Capture, intent: "save" | "generate") => void;
  onUnsupported: (reason: string) => void;
  bookHref: string | null;
}) {
  const t = useTranslations("ui.tryon");
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = React.useState<Status>("starting");
  const [facing, setFacing] = React.useState<"environment" | "user">("environment");
  const [tracked, setTracked] = React.useState(0);
  const rendererRef = React.useRef<import("@/lib/ar/renderer").NailRenderer | null>(null);
  const lastHands = React.useRef<DetectedHand[]>([]);
  const styleRef = React.useRef(style);
  const lookRef = React.useRef(look);
  React.useEffect(() => {
    styleRef.current = style;
    lookRef.current = look;
  }, [style, look]);

  // Analytics: one AR session per mount.
  React.useEffect(() => {
    void startSession({ mode: "ar", salonId: salon?.id ?? design?.salonId ?? null, designId: look.designId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    rendererRef.current?.setStyle(style);
  }, [style]);

  React.useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let stream: MediaStream | null = null;
    let tracker: import("@/lib/ar/hand-tracker").HandTracker | null = null;
    let segmenter: import("@/lib/ar/nail-segmenter").NailSegmenter | null = null;
    let renderer: import("@/lib/ar/renderer").NailRenderer | null = null;
    const video = videoRef.current!;
    const canvas = canvasRef.current!;

    async function start() {
      setStatus("starting");
      const { arSupported, HandTracker } = await import("@/lib/ar/hand-tracker");
      const sup = arSupported();
      if (!sup.ok) {
        setStatus("unsupported");
        onUnsupported(sup.reason ?? "unsupported");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch {
        setStatus("denied");
        return;
      }
      if (cancelled) return;
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      try {
        const [{ NailSegmenter }, { MaskSmoother }, { NailRenderer }, { LightEstimator }] = await Promise.all(
          [
            import("@/lib/ar/nail-segmenter"),
            import("@/lib/ar/mask-smoother"),
            import("@/lib/ar/renderer"),
            import("@/lib/ar/light-estimator"),
          ],
        );
        tracker = await HandTracker.create({ mode: "VIDEO", numHands: 1 });
        segmenter = await NailSegmenter.create();
        if (cancelled) return;
        renderer = new NailRenderer(canvas);
        rendererRef.current = renderer;
        renderer.setSource(video);
        renderer.setSize(video.videoWidth || 1280, video.videoHeight || 720);
        renderer.setMirror(facing === "user");
        renderer.setStyle(styleRef.current);
        const smoother = new MaskSmoother();
        const light = new LightEstimator();
        setStatus("ready");
        let lastCount = -1;
        let frame = 0;

        const loop = async () => {
          if (cancelled || !tracker || !segmenter || !renderer) return;
          if (video.readyState >= 2) {
            const hands = tracker.detectVideo(video, performance.now());
            lastHands.current = hands;
            const aspect = (video.videoWidth || 16) / (video.videoHeight || 9);
            const l = lookRef.current;
            const frames = await segmenter.segment(video, hands, aspect, {
              shape: l.shape,
              length: l.length,
            });
            const smoothed = smoother.update(frames);
            renderer.updateMasks(smoothed);
            if (frame++ % 10 === 0) {
              const est = light.update(video);
              renderer.setLight(est.direction, est.intensity);
            }
            renderer.render();
            const count = Math.min(5, smoothed.length);
            if (count !== lastCount) {
              lastCount = count;
              setTracked(count);
            }
          }
          raf = requestAnimationFrame(() => void loop());
        };
        raf = requestAnimationFrame(() => void loop());
      } catch {
        setStatus("models");
      }
    }
    void start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      tracker?.close();
      segmenter?.dispose();
      renderer?.dispose();
      rendererRef.current = null;
      stream?.getTracks().forEach((tr) => tr.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing]);

  async function capture(intent: "save" | "generate") {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    const c = document.createElement("canvas");
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    const ctx = c.getContext("2d")!;
    if (facing === "user") {
      ctx.translate(c.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.92));
    if (!blob) return;
    track("tryon_ar_capture", { salonId: salon?.id ?? design?.salonId ?? null, designId: look.designId });
    const hands = facing === "user" ? lastHands.current.map(mirrorHand) : lastHands.current;
    onCapture({ blob, url: URL.createObjectURL(blob), hands, width: c.width, height: c.height }, intent);
  }

  return (
    <>
      <div className="rounded-media relative -mx-2 mt-2 h-[52dvh] min-h-[320px] overflow-hidden bg-[#7c5650]">
        <video ref={videoRef} playsInline muted className="hidden" />
        <canvas ref={canvasRef} className="size-full object-cover" aria-label={t("liveAr")} />
        {status === "ready" && (
          <StatusDot
            tone={tracked > 0 ? "success" : "hollow"}
            className="absolute start-5 top-[18px] text-[#fff8f5]"
          >
            {tracked > 0 ? t("tracked", { count: tracked }) : t("noHand")}
          </StatusDot>
        )}
        {status !== "ready" && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-[15px] text-[#fff8f5]">
            {status === "starting" && t("loadingTracker")}
            {status === "denied" && t("cameraDenied")}
            {status === "unsupported" && t("arUnsupported")}
            {status === "models" && t("modelsMissing")}
          </div>
        )}
        <IconButton
          aria-label={t("flip")}
          onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
          className="absolute end-2 top-2 text-[#fff8f5] hover:text-[#efcfc8]"
        >
          <SwitchCamera />
        </IconButton>
      </div>

      <div
        role="radiogroup"
        aria-label={t("shape")}
        className="no-scrollbar mt-2 flex items-center gap-3.5 overflow-x-auto"
      >
        <span className="text-muted w-14 shrink-0 text-[13px]">{t("shape")}</span>
        {ALL_SHAPES.map((s) => (
          <FilterToggle
            key={s}
            role="radio"
            pressed={look.shape === s}
            onClick={() => onLookChange({ shape: s as Shape })}
          >
            {t(`shapes.${s}`)}
          </FilterToggle>
        ))}
      </div>
      <div role="radiogroup" aria-label={t("length")} className="flex items-center gap-3.5">
        <span className="text-muted w-14 shrink-0 text-[13px]">{t("length")}</span>
        {LENGTHS.map((l) => (
          <FilterToggle
            key={l}
            role="radio"
            pressed={look.length === l}
            onClick={() => onLookChange({ length: l as Length })}
          >
            {t(`lengths.${l}`)}
          </FilterToggle>
        ))}
      </div>

      {(designs.length > 0 || polishes.length > 0) && (
        <>
          <div className="mt-1 flex items-center justify-between">
            <span className="truncate text-[15px] font-semibold">
              {design?.name ?? t("custom")}
              {salon && (
                <span className="text-muted font-normal"> · {t("designsAt", { salon: salon.name })}</span>
              )}
            </span>
            {salon && designs.length > 6 && (
              <Link
                href={`/s/${salon.slug}`}
                className="text-accent hover:text-foreground shrink-0 text-sm font-medium"
              >
                {t("all", { count: designs.length })}
              </Link>
            )}
          </div>
          <DesignRail
            designs={designs}
            polishes={polishes}
            selectedDesignId={look.designId}
            selectedPolishId={look.polishId}
            shape={look.shape}
            onSelectDesign={onSelectDesign}
            onSelectPolish={onSelectPolish}
            className="mt-0.5"
          />
        </>
      )}

      {status === "denied" && <Notice className="mt-3">{t("cameraDenied")}</Notice>}

      <div className="bg-background sticky bottom-0 -mx-6 mt-auto flex items-center justify-between px-6 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => void capture("save")}
          disabled={status !== "ready"}
          className="text-accent hover:text-foreground inline-flex min-h-11 w-28 items-center gap-1.5 text-[15px] font-medium disabled:opacity-50"
        >
          <Bookmark className="size-5" strokeWidth={1.75} />
          {t("saveLook")}
        </button>
        <button
          type="button"
          aria-label={t("capture")}
          onClick={() => void capture("generate")}
          disabled={status !== "ready"}
          className="inline-flex size-[68px] shrink-0 items-center justify-center rounded-full shadow-[inset_0_0_0_2px_var(--accent)] disabled:opacity-50"
        >
          <span className="bg-accent block size-[54px] rounded-full" />
        </button>
        {bookHref ? (
          <Link
            href={bookHref}
            className="text-accent hover:text-foreground inline-flex min-h-11 w-28 items-center justify-end gap-1.5 text-[15px] font-medium"
          >
            {t("bookThis")}
            <ArrowRight className="size-5 rtl:-scale-x-100" strokeWidth={1.75} />
          </Link>
        ) : (
          <span className="w-28" />
        )}
      </div>
    </>
  );
}

function mirrorHand(h: DetectedHand): DetectedHand {
  return {
    ...h,
    handedness: h.handedness === "Left" ? "Right" : "Left",
    landmarks: h.landmarks.map((p) => ({ ...p, x: 1 - p.x })),
  };
}
