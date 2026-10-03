import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing, isLocale, LOCALE_COOKIE } from "@/i18n/routing";
import { refreshSession } from "@/lib/supabase/proxy";
import { publicEnv } from "@/lib/env";
import { testingAccessAllowed } from "@/lib/testing-access";

const handleI18n = createIntlMiddleware(routing);

const RESERVED_SUBDOMAINS = new Set(["www", "app", "api", "admin", "static", "cdn"]);

/** Extracts a salon slug from `slug.nailswap.app` (or `slug.localhost:3000` in dev). */
function salonSlugFromHost(host: string | null): string | null {
  if (!host) return null;
  const hostname = host.split(":")[0].toLowerCase();
  const root = publicEnv.rootDomain.toLowerCase();
  const suffixes = [`.${root}`, ".localhost", ".lvh.me"];
  for (const suffix of suffixes) {
    if (hostname.endsWith(suffix)) {
      const sub = hostname.slice(0, -suffix.length);
      if (sub && !sub.includes(".") && !RESERVED_SUBDOMAINS.has(sub)) return sub;
    }
  }
  return null;
}

function localeFromPath(pathname: string) {
  const seg = pathname.split("/")[1];
  return isLocale(seg) ? seg : null;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    !testingAccessAllowed(pathname, request.headers.get("authorization"), process.env.TEST_ACCESS_PASSWORD)
  ) {
    return new NextResponse("NailSwap private testing", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="NailSwap testing", charset="UTF-8"',
        "Cache-Control": "no-store",
      },
    });
  }

  // API routes and internal endpoints are not localized; just refresh the session cookie.
  if (pathname.startsWith("/api/")) {
    const res = NextResponse.next();
    await refreshSession(request, res);
    return res;
  }

  // Salon subdomain → /{locale}/s/{slug}/...
  const salonSlug = salonSlugFromHost(request.headers.get("host"));
  if (salonSlug) {
    const pathLocale = localeFromPath(pathname);
    const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
    const locale = pathLocale ?? (isLocale(cookieLocale) ? cookieLocale : routing.defaultLocale);
    const rest = pathLocale ? pathname.slice(`/${pathLocale}`.length) : pathname;
    // Prevent path traversal into non-salon sections from a salon subdomain.
    if (rest.startsWith("/s/") || rest.startsWith("/dashboard") || rest.startsWith("/admin")) {
      const url = request.nextUrl.clone();
      url.hostname = publicEnv.rootDomain;
      return NextResponse.redirect(url);
    }
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/s/${salonSlug}${rest === "/" ? "" : rest}`;
    const res = NextResponse.rewrite(url);
    res.headers.set("x-salon-slug", salonSlug);
    await refreshSession(request, res);
    return res;
  }

  const response = handleI18n(request);
  const claims = await refreshSession(request, response);

  const locale = localeFromPath(pathname) ?? routing.defaultLocale;
  const path = pathname.replace(/^\/(en|ar|fr)(?=\/|$)/, "") || "/";

  // Protected areas
  if (path.startsWith("/dashboard") || path.startsWith("/account") || path.startsWith("/admin")) {
    if (!claims.userId) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/login`;
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    if (path.startsWith("/admin") && !claims.isPlatformAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/dashboard`;
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and static assets
    "/((?!_next/static|_next/image|favicon.ico|icons|models|manifest.webmanifest|sw.js|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|webp|avif|svg|ico|wasm|onnx|task|json|txt|xml|woff2?)$).*)",
  ],
};
