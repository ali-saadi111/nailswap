"use client";

import { useEffect } from "react";
import { track } from "@/lib/client/api";

/** Fires one `page_view` analytics event per mount (salon pages, try-on, booking). */
export function TrackView({
  salonId,
  designId,
  payload,
}: {
  salonId?: string | null;
  designId?: string | null;
  payload?: Record<string, unknown>;
}) {
  useEffect(() => {
    const qr =
      typeof window !== "undefined" && new URLSearchParams(window.location.search).get("utm_source") === "qr";
    track("page_view", { salonId, designId, payload: { ...payload, path: window.location.pathname } });
    if (qr) track("qr_scan", { salonId, designId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salonId, designId]);
  return null;
}
