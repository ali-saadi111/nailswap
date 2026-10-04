"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Tabs } from "@/components/ui/primitives";

export type SalonTab = "designs" | "services" | "reviews" | "about";

/** Text tabs that switch between server-rendered panels passed as props. */
export function SalonTabs({
  designs,
  services,
  reviews,
  about,
  reviewCount,
  initial = "designs",
}: {
  designs: React.ReactNode;
  services: React.ReactNode;
  reviews: React.ReactNode;
  about: React.ReactNode;
  reviewCount: number;
  initial?: SalonTab;
}) {
  const t = useTranslations("ui.salon");
  const tm = useTranslations("merchant");
  const [tab, setTab] = React.useState<SalonTab>(initial);
  const panels: Record<SalonTab, React.ReactNode> = { designs, services, reviews, about };
  return (
    <>
      <Tabs
        value={tab}
        onChange={setTab}
        className="mt-3"
        items={[
          { value: "designs", label: tm("feed") },
          { value: "services", label: t("services") },
          { value: "reviews", label: t("reviews"), count: reviewCount || undefined },
          { value: "about", label: t("about") },
        ]}
      />
      <div role="tabpanel" className="mt-5">
        {panels[tab]}
      </div>
    </>
  );
}
