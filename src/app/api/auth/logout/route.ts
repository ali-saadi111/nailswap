import { handle, json, userClient } from "@/lib/api";

/** POST /api/auth/logout — clears the Supabase session cookies. */
export const POST = handle(async () => {
  const supabase = await userClient();
  await supabase.auth.signOut();
  return json({ ok: true });
});
