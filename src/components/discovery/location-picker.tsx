"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export function LocationPicker({
  lat,
  lng,
  onChange,
  label,
}: {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
  label: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const change = useRef(onChange);
  useEffect(() => {
    change.current = onChange;
  }, [onChange]);
  useEffect(() => {
    let disposed = false;
    let map: import("leaflet").Map | undefined;
    void import("leaflet").then((L) => {
      if (disposed || !container.current) return;
      const center: [number, number] = [lat ?? 33.89, lng ?? 35.5];
      map = L.map(container.current, { scrollWheelZoom: false }).setView(center, 14);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      let marker: import("leaflet").CircleMarker | undefined;
      if (lat !== null && lng !== null)
        marker = L.circleMarker(center, { radius: 10, color: "#68462f", fillOpacity: 1 }).addTo(map);
      map.on("click", (event: import("leaflet").LeafletMouseEvent) => {
        marker?.remove();
        marker = L.circleMarker(event.latlng, { radius: 10, color: "#68462f", fillOpacity: 1 }).addTo(map!);
        change.current(Number(event.latlng.lat.toFixed(6)), Number(event.latlng.lng.toFixed(6)));
      });
    });
    return () => {
      disposed = true;
      map?.remove();
    };
    // Coordinates are initial values; clicking the map reports edits without resetting its view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div ref={container} aria-label={label} className="relative z-0 mt-3 h-64 overflow-hidden rounded-2xl" />
  );
}
