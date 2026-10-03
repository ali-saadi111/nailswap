"use client";

import { useEffect, useState } from "react";
import { X, Check, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastKind = "success" | "error" | "info";
export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
  duration?: number;
}

type Listener = (toasts: Toast[]) => void;
let toasts: Toast[] = [];
let listeners: Listener[] = [];
let nextId = 1;

function emit() {
  listeners.forEach((l) => l(toasts));
}

export const toast = {
  show(t: Omit<Toast, "id">) {
    const id = nextId++;
    toasts = [...toasts, { ...t, id }];
    emit();
    const duration = t.duration ?? (t.kind === "error" ? 6000 : 3500);
    if (duration > 0) setTimeout(() => toast.dismiss(id), duration);
    return id;
  },
  success(title: string, description?: string) {
    return toast.show({ kind: "success", title, description });
  },
  error(title: string, description?: string) {
    return toast.show({ kind: "error", title, description });
  },
  info(title: string, description?: string) {
    return toast.show({ kind: "info", title, description });
  },
  dismiss(id: number) {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  },
};

const icons = { success: Check, error: AlertCircle, info: Info } as const;
const colors = { success: "text-success", error: "text-danger", info: "text-info" } as const;

/** Toasts float on `--overlay` with the only shadow allowed on the page. */
export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    listeners.push(setItems);
    return () => {
      listeners = listeners.filter((l) => l !== setItems);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end"
    >
      {items.map((t) => {
        const Icon = icons[t.kind];
        return (
          <div
            key={t.id}
            role="status"
            className="bg-overlay animate-slide-up pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl px-4 py-3 shadow-lg"
          >
            <Icon className={cn("mt-0.5 size-5 shrink-0", colors[t.kind])} aria-hidden strokeWidth={2} />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium">{t.title}</p>
              {t.description && <p className="text-muted mt-0.5 text-sm">{t.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => toast.dismiss(t.id)}
              className="text-muted hover:text-foreground -me-1 inline-flex size-8 items-center justify-center"
              aria-label="Dismiss"
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
