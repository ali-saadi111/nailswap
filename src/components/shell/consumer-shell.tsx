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
        "consumer-shell mx-auto flex min-h-dvh w-full min-w-0 flex-col px-6",
        wide ? "max-w-[1200px]" : "max-w-[640px]",
        tabBar ? "pb-[calc(8rem+env(safe-area-inset-bottom,0px))] md:pb-16" : "pb-10",
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

/** Pinned bottom action for flow steps: a floating frosted panel with one pill and an optional summary. */
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
        "sticky-action sticky bottom-0 z-30 -mx-3 mt-auto shrink-0 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        className,
      )}
    >
      <div className="glass rounded-[28px] p-2.5 shadow-lg">
        {summary && (
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 pt-1.5 pb-2.5">
            {summary}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
