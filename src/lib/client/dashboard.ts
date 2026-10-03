"use client";

import { api } from "./api";

export type MediaKind = "logo" | "cover" | "gallery" | "design" | "polish" | "staff";

/** Uploads an image through the dashboard media route; returns the storage path and public URL. */
export async function uploadMedia(salonId: string, file: File, kind: MediaKind) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("kind", kind);
  return api.post<{ path: string; url: string; hex?: string }>(`/api/dashboard/${salonId}/media`, fd);
}

export const DEFAULT_SERVICES = [
  { name: "Classic Manicure", category: "manicure", price: 20, duration: 45 },
  { name: "Gel Manicure", category: "gel", price: 35, duration: 60 },
  { name: "BIAB Overlay", category: "biab", price: 45, duration: 75 },
  { name: "Acrylic Full Set", category: "acrylic", price: 60, duration: 120 },
  { name: "Gel Removal", category: "removal", price: 10, duration: 20 },
  { name: "Spa Pedicure", category: "pedicure", price: 30, duration: 60 },
] as const;

export const BRAND_COLORS = ["#6b3f2a", "#4f6d4c", "#b4574a", "#2b211c", "#6a4c93", "#3f5f7a", "#c86b85"];

export const STAFF_COLORS = ["#C86B85", "#8B5E3C", "#4B6B8A", "#7B4B94", "#B85C38", "#4F6D4C"];

export function csvEscape(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadText(filename: string, text: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
