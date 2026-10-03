import { NextResponse, type NextRequest } from "next/server";
import { handle, requireUser } from "@/lib/api";
import { SALON_COOKIE } from "@/lib/dashboard/context";

/** GET /api/dashboard/switch?salon=<id>&next=/en/dashboard — remembers the salon for the dashboard. */
export const GET = handle(async (req: NextRequest) => {
  const auth = await requireUser();
  const salon = req.nextUrl.searchParams.get("salon") ?? "";
  const next = req.nextUrl.searchParams.get("next") ?? "/";
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const res = NextResponse.redirect(new URL(target, req.nextUrl.origin));
  if (salon && (auth.isPlatformAdmin || auth.salonRoles[salon])) {
    res.cookies.set(SALON_COOKIE, salon, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: true,
    });
  }
  return res;
});
