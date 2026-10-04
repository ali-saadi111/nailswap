"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

/* ── Status (dot + word, never colour alone) ────────────────────────────── */
export type StatusTone =
  "success" | "pending" | "accent" | "danger" | "hollow" | "muted" | "warning" | "info";

const dotTone: Record<StatusTone, string> = {
  success: "bg-success",
  pending: "bg-pending",
  accent: "bg-accent",
  danger: "bg-danger",
  warning: "bg-warning",
  info: "bg-info",
  muted: "bg-muted-2",
  hollow: "bg-transparent shadow-[inset_0_0_0_1px_var(--muted)]",
};

export function Dot({ tone, className, live }: { tone: StatusTone; className?: string; live?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-[7px] shrink-0 rounded-full",
        dotTone[tone],
        live && "animate-pulse-dot",
        className,
      )}
    />
  );
}

export function StatusDot({
  tone,
  children,
  className,
  live,
}: {
  tone: StatusTone;
  children: React.ReactNode;
  className?: string;
  live?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[7px] text-[13px] font-medium whitespace-nowrap",
        className,
      )}
    >
      <Dot tone={tone} live={live} />
      {children}
    </span>
  );
}

export function bookingTone(status: string): StatusTone {
  switch (status) {
    case "new":
      return "pending";
    case "confirmed":
      return "success";
    case "completed":
      return "accent";
    case "no_show":
      return "danger";
    default:
      return "hollow";
  }
}

export function paymentTone(status: string): StatusTone {
  switch (status) {
    case "paid":
      return "success";
    case "pending":
      return "pending";
    case "failed":
      return "danger";
    default:
      return "hollow";
  }
}

export function salonTone(status: string): StatusTone {
  switch (status) {
    case "active":
      return "success";
    case "pending":
      return "pending";
    case "suspended":
      return "danger";
    default:
      return "hollow";
  }
}

/** Kept for call-site compatibility: a Badge is now a StatusDot. */
export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";
export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  const map: Record<BadgeTone, StatusTone> = {
    neutral: "muted",
    accent: "accent",
    success: "success",
    warning: "pending",
    danger: "danger",
    info: "info",
  };
  return (
    <StatusDot tone={map[tone]} className={className}>
      {children}
    </StatusDot>
  );
}

/* ── Avatar (circle with initials or photo) ──────────────────────────────── */
export function Avatar({
  name,
  src,
  size = 44,
  serif,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  serif?: boolean;
  className?: string;
}) {
  const style = { width: size, height: size, fontSize: serif ? size * 0.38 : Math.max(11, size * 0.3) };
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className={cn("bg-nude shrink-0 rounded-full object-cover", className)}
        style={style}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "bg-nude text-accent inline-flex shrink-0 items-center justify-center rounded-full font-medium",
        serif && "font-display font-normal",
        className,
      )}
      style={style}
    >
      {initials(name)}
    </span>
  );
}

/* ── Filter chip (surface pill; pressed = ink pill) ──────────────────────── */
export function FilterToggle({
  pressed,
  onClick,
  children,
  className,
  role,
  size = "md",
}: {
  pressed: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  role?: "radio";
  size?: "sm" | "md";
}) {
  const ariaProps = role === "radio" ? { role, "aria-checked": pressed } : { "aria-pressed": pressed };
  return (
    <button
      type="button"
      onClick={onClick}
      {...ariaProps}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full font-bold whitespace-nowrap transition-colors",
        size === "sm" ? "h-9 px-3.5 text-[13px]" : "h-10 px-4 text-sm",
        pressed
          ? "bg-foreground text-background"
          : "bg-surface text-foreground hover:text-accent shadow-[inset_0_0_0_1px_var(--border)]",
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ── Dialog / bottom sheet (bg-overlay, shadow-lg, no border) ────────────── */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
  sheet,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "full";
  /** Bottom sheet on phones (rounded top, grabber). */
  sheet?: boolean;
  className?: string;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const sizes = {
    sm: "sm:max-w-sm",
    md: "sm:max-w-lg",
    lg: "sm:max-w-3xl",
    full: "sm:max-w-[min(96vw,1200px)]",
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby={title ? titleId : undefined}
      className={cn(
        "bg-overlay text-foreground open:animate-slide-up p-0 shadow-lg backdrop:bg-[rgb(51_33_31/0.42)] backdrop:backdrop-blur-[3px]",
        sheet
          ? "mx-auto mt-auto mb-0 w-full max-w-none rounded-t-[32px] sm:m-auto sm:w-[calc(100%-2rem)] sm:rounded-[28px]"
          : "m-auto w-[calc(100%-2rem)] rounded-[28px]",
        sizes[size],
        className,
      )}
    >
      {sheet && (
        <span
          aria-hidden
          className="bg-border-strong mx-auto mt-2.5 block h-[5px] w-10 rounded-full sm:hidden"
        />
      )}
      <div className="max-h-[85dvh] overflow-y-auto px-6 pt-5 pb-6">
        {(title || description) && (
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              {title && (
                <h2 id={titleId} className="font-display text-2xl leading-tight">
                  {title}
                </h2>
              )}
              {description && <p className="text-muted mt-1 text-sm">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="bg-surface-2/60 text-foreground hover:text-accent -me-2 -mt-1 inline-flex size-10 items-center justify-center rounded-full"
            >
              <X className="size-5" />
            </button>
          </div>
        )}
        {children}
      </div>
    </dialog>
  );
}

/* ── Tabs (pill chips; selected = ink pill) ──────────────────────────────── */
export function Tabs<T extends string>({
  value,
  onChange,
  items,
  className,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: React.ReactNode; count?: number | string }[];
  className?: string;
  label?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn("no-scrollbar flex gap-2 overflow-x-auto", className)}
    >
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          type="button"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className="tab-link"
        >
          {it.label}
          {it.count !== undefined && <span className="font-semibold opacity-70">{it.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ── Section (heading + content, spacing only — replaces Card) ───────────── */
export function Section({
  title,
  description,
  action,
  children,
  className,
  serif = true,
  as: Tag = "section",
}: {
  title?: React.ReactNode;
  description?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  serif?: boolean;
  as?: "section" | "div" | "article";
}) {
  return (
    <Tag className={cn("min-w-0", className)}>
      {(title || action) && (
        <div className="mb-4 flex min-h-11 items-end justify-between gap-4">
          <div>
            {title && (
              <h2 className={serif ? "font-display text-2xl leading-tight" : "text-base font-semibold"}>
                {title}
              </h2>
            )}
            {description && <p className="text-muted mt-1 text-[13px]">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </Tag>
  );
}

/** Compatibility aliases for older call sites. */
export const Card = Section;
export function CardHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        {description && <p className="text-muted mt-0.5 text-[13px]">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/* ── KPI (serif 40 number, 13 muted label, optional delta) — replaces Stat ── */
export function Kpi({
  label,
  value,
  delta,
  deltaTone = "success",
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  delta?: React.ReactNode;
  deltaTone?: "success" | "danger" | "muted";
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("kpi min-w-0", className)}>
      <div className="kpi-value font-display text-[40px] leading-none tabular-nums">{value}</div>
      <div className="text-muted mt-2 text-[13px]">{label}</div>
      {(delta || hint) && (
        <div
          className={cn(
            "mt-1 text-[13px]",
            deltaTone === "success" && "text-success",
            deltaTone === "danger" && "text-danger",
            deltaTone === "muted" && "text-muted",
          )}
        >
          {delta}
          {hint && <span className="text-muted"> {hint}</span>}
        </div>
      )}
    </div>
  );
}
export const Stat = Kpi;

/* ── Empty state (no box) ────────────────────────────────────────────────── */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      <h3 className="font-display text-2xl leading-tight">{title}</h3>
      {description && <p className="text-muted mt-2 max-w-sm text-[15px]">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ── Skeleton (text bars and circles only) ───────────────────────────────── */
export function Skeleton({ className, circle }: { className?: string; circle?: boolean }) {
  return <div className={cn("skeleton h-3", circle && "rounded-full", className)} aria-hidden />;
}

/* ── Steps (wizard progress as text: "Step 2 of 7 · Services") ──────────── */
export function Steps({ total, current, labels }: { total: number; current: number; labels?: string[] }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-5 gap-y-1" aria-label="Progress">
      {Array.from({ length: total }).map((_, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        return (
          <li
            key={i}
            aria-current={state === "current" ? "step" : undefined}
            className={cn(
              "flex items-center gap-1.5 text-sm font-medium",
              state === "current"
                ? "text-accent font-bold"
                : state === "done"
                  ? "text-foreground"
                  : "text-muted",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "size-1.5 rounded-full",
                state === "current" ? "bg-accent" : state === "done" ? "bg-foreground" : "bg-border-strong",
              )}
            />
            {labels?.[i] ?? i + 1}
          </li>
        );
      })}
    </ol>
  );
}

/* ── Line meter (billing usage) ──────────────────────────────────────────── */
export function Meter({
  value,
  max,
  label,
  className,
}: {
  value: number;
  max: number;
  label: string;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn("bg-border relative h-1 w-full rounded-full", className)}
    >
      <span className="bg-accent absolute inset-y-0 start-0 rounded-full" style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ── Key/value rows with hairlines (confirmation, detail panes) ──────────── */
export function KeyValueList({
  items,
  className,
}: {
  items: { label: React.ReactNode; value: React.ReactNode }[];
  className?: string;
}) {
  return (
    <dl className={cn("", className)}>
      {items.map((it, i) => (
        <div
          key={i}
          className="border-border flex min-h-10 items-center justify-between gap-4 border-b py-2 text-sm last:border-b-0"
        >
          <dt className="text-muted shrink-0">{it.label}</dt>
          <dd className="text-end font-medium">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ── Inline notice (one muted line with an icon, no background) ─────────── */
export function Notice({
  icon,
  children,
  tone = "muted",
  className,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  tone?: "muted" | "success" | "danger" | "warning";
  className?: string;
}) {
  return (
    <p
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 text-sm leading-5",
        tone === "muted" && "text-muted",
        tone === "success" && "text-success",
        tone === "danger" && "text-danger",
        tone === "warning" && "text-warning",
        className,
      )}
    >
      {icon && <span className="mt-px shrink-0 [&>svg]:size-[18px]">{icon}</span>}
      <span>{children}</span>
    </p>
  );
}
