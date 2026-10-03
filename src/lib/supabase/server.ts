import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";
import { publicEnv } from "@/lib/env";

/**
 * Supabase client bound to the current request's cookies (RLS applies as the signed-in user).
 * Use in Server Components, Route Handlers and Server Actions.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: cookies are refreshed by the proxy instead.
        }
      },
    },
  });
}

export type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

/** Current auth user or null. */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Decoded JWT claims added by custom_access_token_hook. */
export async function getClaims() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = (data?.claims ?? {}) as Record<string, unknown>;
  return {
    userId: (claims.sub as string | undefined) ?? null,
    phone: (claims.phone as string | undefined) ?? null,
    isPlatformAdmin: Boolean(claims.is_platform_admin),
    salonRoles: (claims.salon_roles as Record<string, "owner" | "manager" | "staff"> | undefined) ?? {},
  };
}
