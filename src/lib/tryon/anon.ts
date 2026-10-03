import "server-only";
import { cookies } from "next/headers";
import { nanoid } from "nanoid";

export const ANON_COOKIE = "ns_anon";

/** Stable anonymous id for clients without an account (try-on ownership, analytics). */
export async function getAnonId(create = true): Promise<string | null> {
  const store = await cookies();
  const existing = store.get(ANON_COOKIE)?.value;
  if (existing && /^[A-Za-z0-9_-]{16,32}$/.test(existing)) return existing;
  if (!create) return null;
  const id = nanoid(21);
  try {
    store.set(ANON_COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  } catch {
    // Server Component render: cookie is set by the next mutating request instead.
  }
  return id;
}
