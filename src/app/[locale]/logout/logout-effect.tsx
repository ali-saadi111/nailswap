"use client";

import { useEffect } from "react";
import { api } from "@/lib/client/api";
import { clearMe } from "@/lib/client/use-me";

/** Ends the session as soon as the signed-out screen mounts. */
export function LogoutEffect() {
  useEffect(() => {
    api
      .post("/api/auth/logout")
      .catch(() => undefined)
      .finally(clearMe);
  }, []);
  return null;
}
