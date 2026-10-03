import * as React from "react";
import { TabBar } from "./tab-bar";
import { cn } from "@/lib/utils";

/**
 * Consumer page column: 24px gutters, ≤ 640px wide, room for the tab bar at the bottom.
 * Pages that pin their own primary action (`sticky`) get extra bottom padding.
 */
export function ConsumerShell({
  children,
  className,
  tabBar = true,
  wide,
}: {
  children: React.ReactNode;
  className?: string;
  tabBar?: boolean;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex min-h-dvh w-full flex-col px-6",
        wide ? "max-w-[960px]" : "max-w-[640px]",
        tabBar ? "pb-28 md:pb-16" : "pb-10",
        className,
      )}
    >
      {tabBar && <TabBar />}
      <main id="main" className="flex flex-1 flex-col pt-3 md:pt-2">
        {children}
      </main>
    </div>
  );
}

/** Pinned bottom action for flow steps (one pill, optional summary line above, no bar background). */
export function StickyAction({
  children,
  summary,
  className,
}: {
  children: React.ReactNode;
  summary?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-background sticky bottom-0 z-30 -mx-6 mt-auto px-6 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]",
        className,
      )}
    >
      {summary && <div className="mb-3.5 flex items-center justify-between gap-4">{summary}</div>}
      {children}
    </div>
  );
}
