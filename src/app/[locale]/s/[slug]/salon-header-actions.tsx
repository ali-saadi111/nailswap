"use client";

import { Share } from "lucide-react";
import { useTranslations } from "next-intl";
import { IconButton } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { track } from "@/lib/client/api";

export function ShareSalonButton({ salonId, name }: { salonId: string; name: string }) {
  const t = useTranslations("ui.salon");
  async function share() {
    const url = window.location.href;
    track("share", { salonId });
    try {
      if (navigator.share) {
        await navigator.share({ title: name, url });
        return;
      }
    } catch {
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("linkCopied"));
    } catch {
      /* clipboard blocked */
    }
  }
  return (
    <IconButton aria-label={t("share")} tone="surface" onClick={share}>
      <Share />
    </IconButton>
  );
}
