import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/*/dashboard", "/*/admin", "/*/account", "/*/b/", "/*/login"],
      },
    ],
    sitemap: `${publicEnv.appUrl}/sitemap.xml`,
    host: publicEnv.appUrl,
  };
}
