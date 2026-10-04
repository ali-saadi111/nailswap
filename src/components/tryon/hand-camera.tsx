"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, SwitchCamera, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** A framing guide only: the original photo, without overlays, is sent to the AI. */
export function HandCamera({ onCapture, onClose }: { onCapture: (blob: Blob) => void; onClose: () => void }) {
  const t = useTranslations("capture");
  const video = useRef<HTMLVideoElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [leftHand, setLeftHand] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | undefined;
    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 1600 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        if (!cancelled) setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }
    void start();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [facing]);
  async function capture() {
    const source = video.current;
    if (!source || !source.videoWidth || busy) return;
    setBusy(true);
    try {
      const ratio = 3 / 4;
      const width = Math.min(source.videoWidth, source.videoHeight * ratio);
      const height = width / ratio;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width);
      canvas.height = Math.round(height);
      const ctx = canvas.getContext("2d")!;
      if (facing === "user") {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(
        source,
        (source.videoWidth - width) / 2,
        (source.videoHeight - height) / 2,
        width,
        height,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.94));
      if (blob) onCapture(blob);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="hand-camera-title"
      className="fixed inset-0 z-[100] overflow-y-auto bg-[#231e1b] p-4 text-white"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
        if (event.key === "Tab") {
          const buttons = Array.from(
            event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
          );
          if (event.shiftKey && document.activeElement === buttons[0]) {
            event.preventDefault();
            buttons.at(-1)?.focus();
          }
          if (!event.shiftKey && document.activeElement === buttons.at(-1)) {
            event.preventDefault();
            buttons[0]?.focus();
          }
        }
      }}
    >
      <div className="mx-auto max-w-[430px]">
        <div className="flex items-center justify-between">
          <h2 id="hand-camera-title" className="text-xl font-semibold">
            {t("title")}
          </h2>
          <button
            ref={closeButton}
            onClick={onClose}
            aria-label={t("close")}
            className="flex size-11 items-center justify-center"
          >
            <X />
          </button>
        </div>
        <p className="mb-3 text-sm text-white/75">{t("guide")}</p>
        <div className="relative mx-auto aspect-[3/4] max-h-[65dvh] overflow-hidden rounded-3xl bg-black">
          <video
            ref={video}
            autoPlay
            playsInline
            muted
            className={`size-full object-cover ${facing === "user" ? "-scale-x-100" : ""}`}
          />
          <svg
            viewBox="0 0 300 400"
            className={`pointer-events-none absolute inset-0 size-full ${leftHand ? "-scale-x-100" : ""}`}
            aria-hidden="true"
          >
            <path
              d="M110 375 L105 290 Q100 260 77 235 L40 190 Q31 176 42 168 Q54 160 65 174 L91 201 L78 105 Q76 88 89 87 Q102 86 105 102 L121 178 L115 66 Q114 49 128 49 Q141 49 143 66 L151 172 L160 49 Q161 32 174 34 Q188 35 186 54 L180 173 L196 79 Q199 64 212 68 Q224 72 220 90 L204 192 L223 134 Q229 119 240 125 Q251 131 245 146 L227 225 Q224 252 208 278 L203 375"
              fill="rgba(255,255,255,0.06)"
              stroke="white"
              strokeWidth="2.5"
              strokeDasharray="7 6"
              strokeLinecap="round"
            />
          </svg>
          {status !== "ready" && (
            <div
              role="status"
              className="absolute inset-0 flex items-center justify-center bg-black/60 p-8 text-center text-sm"
            >
              {status === "loading" ? t("loading") : t("denied")}
            </div>
          )}
          <span className="absolute inset-x-3 bottom-3 rounded-xl bg-black/60 px-3 py-2 text-center text-xs">
            {t("nailsUp")}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <button onClick={() => setLeftHand(!leftHand)} className="min-h-11 px-2 text-sm underline">
            {t("flipGuide")}
          </button>
          <button
            onClick={() => {
              setStatus("loading");
              setFacing((f) => (f === "user" ? "environment" : "user"));
            }}
            aria-label={t("switchCamera")}
            className="flex size-11 items-center justify-center"
          >
            <SwitchCamera />
          </button>
        </div>
        <Button className="mt-2 w-full" size="lg" onClick={capture} disabled={status !== "ready" || busy}>
          <Camera className="size-5" />
          {t("shutter")}
        </Button>
        <button onClick={onClose} className="mt-2 min-h-11 w-full text-sm text-white/80">
          {t("uploadInstead")}
        </button>
      </div>
    </div>
  );
}
