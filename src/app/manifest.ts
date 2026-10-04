import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NailSwap",
    short_name: "NailSwap",
    description: "Try nail designs on your hands with AR or AI, then book at a salon near you.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6eae6",
    theme_color: "#f6eae6",
    lang: "en",
    dir: "auto",
    categories: ["beauty", "lifestyle", "shopping"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Explore designs", url: "/explore", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
