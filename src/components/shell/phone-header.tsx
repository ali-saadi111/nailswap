"use client";

import * as React from "react";
import { ArrowLeft, X } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { IconButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * 44px header row (DESIGN.md §6 Phone screen): leading icon · centre (wordmark / step label) ·
 * trailing action. Icons hang 12px into the gutter so their glyphs align with the text column.
 */
export function PhoneHeader({
  leading,
  center,
  trailing,
  className,
}: {
  leading?: React.ReactNode;
  center?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("relative -mx-3 flex h-11 items-center justify-between", className)}>
      <div className="flex min-w-11 items-center">{leading}</div>
      {center && (
        <div className="absolute start-1/2 top-0 flex h-11 -translate-x-1/2 items-center rtl:translate-x-1/2">
          {center}
        </div>
      )}
      <div className="flex min-w-11 items-center justify-end">{trailing}</div>
    </header>
  );
}

export function BackButton({ fallback = "/", label = "Back" }: { fallback?: string; label?: string }) {
  const router = useRouter();
  return (
    <IconButton
      aria-label={label}
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) router.back();
        else router.push(fallback);
      }}
    >
      <ArrowLeft className="rtl:-scale-x-100" />
    </IconButton>
  );
}

export function CloseButton({
  href = "/",
  label = "Close",
  onClick,
}: {
  href?: string;
  label?: string;
  onClick?: () => void;
}) {
  const router = useRouter();
  return (
    <IconButton aria-label={label} onClick={onClick ?? (() => router.push(href))}>
      <X />
    </IconButton>
  );
}
