"use client";

import * as React from "react";
import { ArrowLeft, X } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { IconButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Header row (Blush DESIGN.md §6): round surface buttons at the edges · centre label.
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
    <header
      className={cn("relative -mx-1 flex min-h-14 shrink-0 items-center justify-between gap-2", className)}
    >
      <div className="relative z-10 flex min-w-11 shrink-0 items-center">{leading}</div>
      {center && (
        <div className="absolute inset-x-14 top-0 flex min-h-14 items-center justify-center text-center">
          {center}
        </div>
      )}
      <div className="relative z-10 flex min-w-11 items-center justify-end">{trailing}</div>
    </header>
  );
}

export function BackButton({ fallback = "/", label = "Back" }: { fallback?: string; label?: string }) {
  const router = useRouter();
  return (
    <IconButton
      aria-label={label}
      tone="surface"
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
    <IconButton aria-label={label} tone="surface" onClick={onClick ?? (() => router.push(href))}>
      <X />
    </IconButton>
  );
}
