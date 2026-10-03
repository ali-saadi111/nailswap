import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";

/**
 * Refreshes the Supabase session cookie inside the proxy and returns the user claims.
 * Must be called on every request that may need auth so that Server Components never see
 * an expired token.
 */
export async function refreshSession(request: NextRequest, response: NextResponse) {
  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const claims = (data?.claims ?? null) as Record<string, unknown> | null;
  return {
    userId: (claims?.sub as string | undefined) ?? null,
    isPlatformAdmin: Boolean(claims?.is_platform_admin),
    salonRoles: (claims?.salon_roles as Record<string, string> | undefined) ?? {},
  };
}
