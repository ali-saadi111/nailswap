"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/** Six digits, each over its own 40px underline; the focused one gets the 2px cocoa underline. */
export function OtpInput({
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
  length = 6,
  autoFocus = true,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  length?: number;
  autoFocus?: boolean;
}) {
  const t = useTranslations("ui.auth");
  const refs = React.useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  function setAt(i: number, d: string) {
    const next = digits.slice();
    next[i] = d;
    const joined = next.join("").slice(0, length);
    onChange(joined);
    if (joined.length === length && !joined.includes("")) onComplete?.(joined);
  }

  function handleInput(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) {
      setAt(i, "");
      return;
    }
    if (raw.length > 1) {
      // Pasted code
      const merged = (value.slice(0, i) + raw).slice(0, length);
      onChange(merged);
      refs.current[Math.min(length - 1, merged.length)]?.focus();
      if (merged.length === length) onComplete?.(merged);
      return;
    }
    setAt(i, raw);
    if (i < length - 1) refs.current[i + 1]?.focus();
  }

  function handleKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus();
      setAt(i - 1, "");
      e.preventDefault();
    }
    if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < length - 1) refs.current[i + 1]?.focus();
  }

  return (
    <div className="flex justify-between gap-2" dir="ltr">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          onChange={(e) => handleInput(i, e)}
          onKeyDown={(e) => handleKey(i, e)}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          pattern="\d*"
          maxLength={length}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          aria-label={t("digit", { n: i + 1 })}
          aria-invalid={invalid || undefined}
          className={cn(
            "h-14 w-11 border-0 border-b bg-transparent text-center text-[26px] font-medium focus:border-b-2 focus-visible:outline-none disabled:opacity-60",
            invalid ? "border-danger" : "border-border-strong focus:border-accent",
          )}
        />
      ))}
    </div>
  );
}
