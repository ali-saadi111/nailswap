import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Filled field (Blush DESIGN.md §4): label above, surface fill, 16px corners, rose border on focus. */
export const inputClasses =
  "field h-12 w-full rounded-2xl border border-transparent bg-surface px-4 text-base text-foreground placeholder:text-muted-2 focus:border-accent focus-visible:outline-none disabled:opacity-60";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(function Input({ className, invalid, ...props }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(inputClasses, invalid && "border-danger", className)}
      {...props}
    />
  );
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        inputClasses,
        "h-auto min-h-20 resize-none py-2.5 leading-6",
        invalid && "border-danger",
        className,
      )}
      {...props}
    />
  );
});

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean; wrapperClassName?: string }
>(function Select({ className, invalid, wrapperClassName, children, ...props }, ref) {
  return (
    <span className={cn("relative block", wrapperClassName)}>
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          inputClasses,
          "cursor-pointer appearance-none pe-10",
          invalid && "border-danger",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="text-muted pointer-events-none absolute end-4 top-1/2 size-[18px] -translate-y-1/2"
      />
    </span>
  );
});

export function Label({
  className,
  children,
  hint,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { hint?: string }) {
  return (
    <label
      className={cn(
        "text-muted mb-1.5 flex items-baseline justify-between gap-2 text-[13px] font-semibold",
        className,
      )}
      {...props}
    >
      <span>{children}</span>
      {hint && <span className="text-muted-2 text-xs">{hint}</span>}
    </label>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={cn("w-full", className)}>
      {label && (
        <Label htmlFor={htmlFor} hint={hint}>
          {label}
        </Label>
      )}
      {children}
      {error && (
        <p role="alert" className="text-danger mt-1.5 text-[13px]">
          {error}
        </p>
      )}
    </div>
  );
}

/** 44×26 switch; off = strong border colour, on = rose; thumb = surface; mirrored in RTL. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
  id,
  className,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-[26px] w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
        checked ? "bg-accent" : "bg-border-strong",
        className,
      )}
    >
      <span
        className={cn(
          "bg-surface pointer-events-none block size-5 rounded-full shadow-sm transition-transform",
          checked ? "translate-x-[21px] rtl:-translate-x-[21px]" : "translate-x-[3px] rtl:-translate-x-[3px]",
        )}
      />
    </button>
  );
}

/** Label/description row with a trailing switch (settings pages). */
export function SwitchRow({
  title,
  description,
  checked,
  onChange,
  disabled,
  className,
}: {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("border-border flex min-h-16 items-center gap-4 border-b py-3", className)}>
      <div className="min-w-0 flex-1">
        <div className="text-[15px]">{title}</div>
        {description && <div className="text-muted mt-0.5 text-[13px]">{description}</div>}
      </div>
      <Switch checked={checked} onChange={onChange} label={title} disabled={disabled} />
    </div>
  );
}
