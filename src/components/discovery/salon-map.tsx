"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import type { DirectoryItem } from "@/lib/salons/directory";
import "leaflet/dist/leaflet.css";

export function SalonMap({
  items,
  selected,
  onSelect,
  position,
}: {
  items: DirectoryItem[];
  selected: string | null;
  onSelect: (id: string) => void;
  position: { lat: number; lng: number } | null;
}) {
  const t = useTranslations("discovery");
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const select = useRef(onSelect);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;
    void import("leaflet")
      .then((L) => {
        if (disposed || !container.current) return;
        const instance = L.map(container.current, { scrollWheelZoom: false }).setView([33.9, 35.55], 10);
        map.current = instance;
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        })
          .on("tileerror", () => setFailed(true))
          .on("tileload", () => setFailed(false))
          .addTo(instance);
        layer.current = L.layerGroup().addTo(instance);
        observer = new ResizeObserver(() => instance.invalidateSize());
        observer.observe(container.current);
        setReady(true);
      })
      .catch(() => setFailed(true));
    return () => {
      disposed = true;
      observer?.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready || !map.current) return;
    let disposed = false;
    void import("leaflet").then((L) => {
      if (disposed || !map.current || !layer.current) return;
      layer.current.clearLayers();
      for (const salon of items) {
        if (salon.lat === null || salon.lng === null) continue;
        const label = document.createElement("span");
        label.className = `salon-map-pin${selected === salon.id ? " is-selected" : ""}`;
        label.textContent = salon.name
          .split(/\s+/)
          .slice(0, 2)
          .map((word) => word[0])
          .join("");
        const marker = L.marker([salon.lat, salon.lng], {
          icon: L.divIcon({
            html: label,
            className: "salon-marker",
            iconSize: [40, 40],
            iconAnchor: [20, 40],
          }),
          title: salon.name,
          alt: salon.name,
          keyboard: true,
          zIndexOffset: selected === salon.id ? 1000 : 0,
        })
          .on("click", () => select.current(salon.id))
          .addTo(layer.current);
        marker.getElement()?.setAttribute("aria-label", salon.name);
      }
      if (position)
        L.circleMarker([position.lat, position.lng], {
          radius: 8,
          color: "white",
          fillColor: "#2563eb",
          fillOpacity: 1,
          weight: 3,
        }).addTo(layer.current);
    });
    return () => {
      disposed = true;
    };
  }, [items, selected, position, ready]);
  useEffect(() => {
    if (!ready || !map.current) return;
    const coordinates = items
      .filter((s) => s.lat !== null && s.lng !== null)
      .map((s) => [s.lat!, s.lng!] as [number, number]);
    if (coordinates.length)
      map.current.fitBounds(coordinates, {
        paddingTopLeft: [65, 50],
        paddingBottomRight: [65, window.matchMedia("(max-width: 767px)").matches ? 185 : 65],
        maxZoom: 14,
      });
  }, [items, ready]);
  useEffect(() => {
    if (position && ready) map.current?.setView([position.lat, position.lng], 12);
  }, [position, ready]);
  return (
    <div className="relative h-full min-h-[360px] overflow-hidden rounded-3xl bg-[#e9e6dd]">
      <div ref={container} className="relative z-0 h-full min-h-[360px] w-full" aria-label={t("mapLabel")} />
      {failed && (
        <p role="status" className="absolute start-12 top-3 z-[500] rounded-xl bg-white p-3 text-sm shadow">
          {t("mapError")}
        </p>
      )}
    </div>
  );
}
