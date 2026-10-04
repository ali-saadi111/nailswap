"use client";

import * as React from "react";
import { Camera, Check, ChevronRight, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import type { DetectedHand } from "@/lib/ar/hand-tracker";
import { Button } from "@/components/ui/button";
import { Dialog, Dot, FilterToggle, Notice } from "@/components/ui/primitives";
import { Input, Label, Textarea } from "@/components/ui/input";
import { NailGroup, fillForDesign } from "@/components/nails/nail";
import { HandCamera } from "./hand-camera";
import { DesignRail } from "./design-rail";
import { checkPhoto, loadImage } from "@/lib/client/tryon";
import type { Capture } from "./live-ar";
import type { Finish, Length, Look, Shape, TryonDesign, TryonPolish, TryonSalon } from "./types";
import { ALL_SHAPES, FINISHES, LENGTHS } from "./types";

type PhotoState =
  | { kind: "empty" }
  | { kind: "checking"; url: string }
  | { kind: "ok"; capture: Capture }
  | { kind: "bad"; url: string; reason: "not_hand" | "nails_not_visible" | "too_small" | "models" };

/** AI photo step: pick/take a photo, confirm the design, accept the photo notice, generate. */
export function AiPhoto({
  salon,
  designs,
  polishes,
  look,
  design,
  initialCapture,
  onLookChange,
  onSelectDesign,
  onSelectPolish,
  onGenerate,
  busy,
  error,
}: {
  salon: TryonSalon | null;
  designs: TryonDesign[];
  polishes: TryonPolish[];
  look: Look;
  design: TryonDesign | null;
  initialCapture: Capture | null;
  onLookChange: (patch: Partial<Look>) => void;
  onSelectDesign: (d: TryonDesign | null) => void;
  onSelectPolish: (p: TryonPolish) => void;
  onGenerate: (capture: Capture) => void;
  busy: boolean;
  error: string | null;
}) {
  const t = useTranslations("ui.tryon");
  const cameraText = useTranslations("capture");
  const [cameraOpen, setCameraOpen] = React.useState(false);
  const [photo, setPhoto] = React.useState<PhotoState>(() =>
    initialCapture
      ? initialCapture.hands.length
        ? { kind: "ok", capture: initialCapture }
        : { kind: "checking", url: initialCapture.url }
      : { kind: "empty" },
  );
  const [consent, setConsent] = React.useState(true);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function analyse(file: Blob, url: string) {
    setPhoto({ kind: "checking", url });
    return runCheck(file, url);
  }

  async function runCheck(file: Blob, url: string) {
    try {
      const img = await loadImage(url);
      const { hands, result } = await checkPhoto(img);
      if (!result.ok) {
        setPhoto({ kind: "bad", url, reason: result.reason });
        return;
      }
      const capture: Capture = {
        blob: file,
        url,
        hands: hands as DetectedHand[],
        width: img.naturalWidth,
        height: img.naturalHeight,
      };
      setPhoto({ kind: "ok", capture });
    } catch {
      setPhoto({ kind: "bad", url, reason: "models" });
    }
  }

  // A capture from the live camera already carries landmarks; still validate when it has none.
  React.useEffect(() => {
    if (initialCapture && !initialCapture.hands.length)
      void runCheck(initialCapture.blob, initialCapture.url);
  }, [initialCapture]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    void analyse(f, URL.createObjectURL(f));
  }

  const photoUrl = photo.kind === "empty" ? null : photo.kind === "ok" ? photo.capture.url : photo.url;
  const ready = photo.kind === "ok" && consent && !busy;
  const badReason =
    photo.kind === "bad"
      ? photo.reason === "not_hand"
        ? t("notHand")
        : photo.reason === "nails_not_visible"
          ? t("nailsNotVisible")
          : photo.reason === "too_small"
            ? t("tooSmall")
            : t("modelsMissing")
      : null;

  const steps = [
    { label: t("stepPhoto"), done: photo.kind === "ok" },
    { label: t("stepDesign"), done: true },
    { label: t("stepGenerate"), done: false },
  ];

  return (
    <>
      <ol
        aria-label="Steps"
        className="bg-surface mt-1 flex h-11 items-center gap-3 self-start rounded-full px-4 text-[13px] font-bold"
      >
        {steps.map((s, i) => (
          <React.Fragment key={s.label}>
            {i > 0 && <ChevronRight className="text-muted-2 size-3.5 rtl:-scale-x-100" aria-hidden />}
            <li
              className={
                s.done
                  ? "flex items-center gap-1.5"
                  : i === steps.length - 1
                    ? "text-accent flex items-center gap-[7px] font-semibold"
                    : "text-muted flex items-center gap-1.5"
              }
              aria-current={i === steps.length - 1 ? "step" : undefined}
            >
              {s.done ? (
                <Check className="text-success size-4" strokeWidth={2.2} />
              ) : i === steps.length - 1 ? (
                <Dot tone="accent" />
              ) : null}
              {s.label}
            </li>
          </React.Fragment>
        ))}
      </ol>

      {cameraOpen && (
        <HandCamera
          onClose={() => setCameraOpen(false)}
          onCapture={(blob) => {
            setCameraOpen(false);
            void analyse(blob, URL.createObjectURL(blob));
          }}
        />
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="text-accent hover:text-foreground min-h-11 self-end text-sm font-bold"
      >
        {cameraText("upload")}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        onChange={onFile}
        className="sr-only"
        tabIndex={-1}
      />

      {photoUrl ? (
        <div className="rounded-media bg-latte relative -mx-3 mt-1 h-[48dvh] min-h-[340px] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt="" className="size-full object-cover" />
          {design && (
            <span className="glass absolute start-3 bottom-3 inline-flex h-9 max-w-[75%] items-center gap-2 truncate rounded-full px-3.5 text-[13px] font-bold">
              <NailGroup shape={design.shape} fill={fillForDesign(design)} size={8} gap={2} />
              {design.name}
            </span>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCameraOpen(true)}
          className="rounded-media bg-hero text-muted hover:text-foreground relative -mx-3 mt-1 flex h-[48dvh] min-h-[340px] flex-col items-center justify-center gap-3 overflow-hidden px-8 text-center"
        >
          <span className="bg-accent text-accent-contrast inline-flex size-[72px] items-center justify-center rounded-full shadow-[0_0_0_8px_rgb(255_248_245/0.5)]">
            <Camera className="size-8" strokeWidth={1.75} />
          </span>
          <span className="text-foreground mt-2 text-[19px] font-extrabold">{t("takePhoto")}</span>
          <span className="text-foreground/80 text-[14px] font-semibold">{t("photoHint")}</span>
          <span className="glass mt-1 rounded-full px-3 py-1 text-[12px] font-semibold">{t("dropHint")}</span>
        </button>
      )}

      <div className="mt-1 flex min-h-11 items-center gap-2 text-[13px]">
        {photo.kind === "ok" && (
          <>
            <Check className="text-success size-4" strokeWidth={2.2} />
            <span className="text-success flex-1 font-bold">{t("photoChecked")}</span>
          </>
        )}
        {photo.kind === "checking" && <span className="text-muted flex-1">{t("checkingPhoto")}</span>}
        {photo.kind === "bad" && <span className="text-danger flex-1">{badReason}</span>}
        {photo.kind === "empty" && <span className="flex-1" />}
        {photo.kind !== "empty" && (
          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            className="bg-surface text-foreground hover:text-accent inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold"
          >
            <Camera className="size-[18px]" strokeWidth={2} />
            {t("retake")}
          </button>
        )}
      </div>

      <div className="bg-surface flex min-h-[72px] items-center gap-3.5 rounded-[24px] ps-4 pe-2">
        {design ? (
          <>
            <NailGroup
              shape={design.shape}
              fill={fillForDesign(design)}
              size={12}
              gap={3}
              className="w-11 justify-center"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-base font-extrabold">{design.name}</div>
              <div className="text-muted mt-0.5 text-[13px]">
                {[
                  t(`shapes.${look.shape}`),
                  t(`lengths.${look.length}`).toLowerCase(),
                  design.salonName,
                ].join(" · ")}
              </div>
            </div>
          </>
        ) : (
          <div className="min-w-0 flex-1">
            <div className="text-base font-extrabold">{t("custom")}</div>
            <div className="text-muted mt-0.5 truncate text-[13px]">
              {[
                t(`shapes.${look.shape}`),
                t(`lengths.${look.length}`).toLowerCase(),
                t(`finishes.${look.finish}`),
                look.art,
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="bg-accent-soft text-accent hover:bg-accent hover:text-accent-contrast inline-flex min-h-10 items-center rounded-full px-4 text-sm font-bold transition-colors"
        >
          {t("change")}
        </button>
      </div>

      <label className="mt-2 flex min-h-[60px] cursor-pointer items-center gap-3.5 px-1">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="size-5 shrink-0"
        />
        <span>
          <span className="block text-[15px] font-bold">{t("deleteAfter")}</span>
          <span className="text-muted mt-0.5 block text-[13px]">{t("deleteAfterHint")}</span>
        </span>
      </label>

      {error && (
        <Notice tone="danger" className="mt-3">
          {error}
        </Notice>
      )}
      {!consent && <Notice className="mt-2">{t("consentRequired")}</Notice>}

      <div className="sticky bottom-0 z-30 -mx-3 mt-auto pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="glass rounded-[28px] p-2.5 shadow-lg">
          <div className="text-muted pt-1 pb-2.5 text-center text-[13px] font-semibold">{t("free")}</div>
          <Button
            size="lg"
            className="w-full"
            disabled={!ready}
            loading={busy}
            onClick={() => photo.kind === "ok" && onGenerate(photo.capture)}
          >
            <Sparkles className="size-5" strokeWidth={1.75} />
            {t("generateLook")}
          </Button>
        </div>
      </div>

      <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} title={t("pickDesign")} sheet>
        {designs.length > 0 && (
          <>
            <div className="text-muted text-[13px]">
              {salon ? t("designsAt", { salon: salon.name }) : t("designs")}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2.5">
              {designs.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    onSelectDesign(d);
                    setPickerOpen(false);
                  }}
                  className={
                    d.id === look.designId
                      ? "bg-accent-soft text-accent rounded-2xl p-2.5 text-start"
                      : "bg-background text-foreground hover:text-accent rounded-2xl p-2.5 text-start"
                  }
                >
                  <NailGroup shape={d.shape} fill={fillForDesign(d)} size={16} gap={4} className="h-[26px]" />
                  <span className="mt-1.5 block truncate text-[13px] font-medium">{d.name}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {polishes.length > 0 && (
          <>
            <div className="text-muted mt-6 text-[13px]">{t("polishes")}</div>
            <DesignRail
              designs={[]}
              polishes={polishes}
              selectedDesignId={null}
              selectedPolishId={look.polishId}
              shape={look.shape}
              onSelectDesign={() => undefined}
              onSelectPolish={(p) => {
                onSelectPolish(p);
                setPickerOpen(false);
              }}
              className="mt-1"
            />
          </>
        )}
        <div className="mt-6">
          <div className="text-muted text-[13px]">{t("custom")}</div>
          <div
            role="radiogroup"
            aria-label={t("shape")}
            className="no-scrollbar mt-1 flex items-center gap-3.5 overflow-x-auto"
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
          <div role="radiogroup" aria-label={t("length")} className="mt-2 flex flex-wrap items-center gap-2">
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
          <div
            role="radiogroup"
            aria-label={t("finish")}
            className="no-scrollbar flex items-center gap-3.5 overflow-x-auto"
          >
            <span className="text-muted w-14 shrink-0 text-[13px]">{t("finish")}</span>
            {FINISHES.map((f) => (
              <FilterToggle
                key={f}
                role="radio"
                pressed={look.finish === f && !look.designId}
                onClick={() => {
                  onSelectDesign(null);
                  onLookChange({ finish: f as Finish });
                }}
              >
                {t(`finishes.${f}`)}
              </FilterToggle>
            ))}
          </div>
          <div className="mt-3 flex items-end gap-4">
            <div className="flex-1">
              <Label htmlFor="look-color">{t("color")}</Label>
              <Input
                id="look-color"
                value={look.color}
                onChange={(e) => {
                  onSelectDesign(null);
                  onLookChange({ color: e.target.value });
                }}
                dir="ltr"
                maxLength={7}
              />
            </div>
            <input
              type="color"
              aria-label={t("color")}
              value={/^#[0-9a-fA-F]{6}$/.test(look.color) ? look.color : "#c2185b"}
              onChange={(e) => {
                onSelectDesign(null);
                onLookChange({ color: e.target.value });
              }}
              className="size-11 cursor-pointer rounded-full border-0 bg-transparent p-0"
            />
          </div>
          <div className="mt-4">
            <Label htmlFor="look-art">{t("describe")}</Label>
            <Textarea
              id="look-art"
              value={look.art}
              placeholder={t("describePlaceholder")}
              maxLength={400}
              onChange={(e) => {
                onSelectDesign(null);
                onLookChange({ art: e.target.value });
              }}
            />
            <p className="text-muted mt-1.5 text-[13px]">{t("describeHint")}</p>
          </div>
          <Button size="md" className="mt-6 w-full" onClick={() => setPickerOpen(false)}>
            {t("change")}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
