import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";
import { routing } from "@/i18n/routing";
import { createAdminClient } from "@/lib/supabase/admin";
import { log, errorMessage } from "@/lib/logger";

export const revalidate = 3600;

const STATIC_PATHS = ["", "/explore", "/for-salons"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.appUrl;
  const alternates = (path: string) => ({
    languages: Object.fromEntries(routing.locales.map((l) => [l, `${base}/${l}${path}`])),
  });

  const entries: MetadataRoute.Sitemap = [];
  for (const path of STATIC_PATHS) {
    for (const locale of routing.locales) {
      entries.push({
        url: `${base}/${locale}${path}`,
        changeFrequency: path === "" ? "daily" : "weekly",
        priority: path === "" ? 1 : 0.8,
        alternates: alternates(path),
      });
    }
  }

  try {
    const admin = createAdminClient();
    const { data: salons } = await admin
      .from("salons")
      .select("slug, updated_at")
      .eq("status", "active")
      .eq("directory_approved", true)
      .limit(5000);
    for (const s of salons ?? []) {
      for (const locale of routing.locales) {
        entries.push({
          url: `${base}/${locale}/s/${s.slug}`,
          lastModified: s.updated_at,
          changeFrequency: "weekly",
          priority: 0.7,
          alternates: alternates(`/s/${s.slug}`),
        });
      }
    }
  } catch (err) {
    log.warn("sitemap: salons unavailable", { error: errorMessage(err) });
  }
  return entries;
}
