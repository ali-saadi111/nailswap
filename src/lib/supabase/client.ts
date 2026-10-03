"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";
import { publicEnv } from "@/lib/env";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Singleton browser client (anon key; RLS applies as the signed-in user). */
export function createClient() {
  if (browserClient) return browserClient;
  browserClient = createBrowserClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
  return browserClient;
}
