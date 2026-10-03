"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export interface MeUser {
  id: string;
  phone: string | null;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  preferredLocale: "en" | "ar" | "fr";
  isPlatformAdmin: boolean;
}
export interface MeSalon {
  id: string;
  slug: string;
  name: string;
  status: "pending" | "active" | "suspended";
  logoUrl: string | null;
  onboardingComplete: boolean;
  role: "owner" | "manager" | "staff";
}
export interface Me {
  user: MeUser | null;
  salons: MeSalon[];
}

let cache: Me | null = null;
let inflight: Promise<Me> | null = null;
const listeners = new Set<(m: Me) => void>();

function load(force = false) {
  if (cache && !force) return Promise.resolve(cache);
  if (!inflight) {
    inflight = api
      .get<Partial<Me>>("/api/auth/me")
      .then((m) => {
        cache = { user: m.user ?? null, salons: m.salons ?? [] };
        listeners.forEach((l) => l(cache!));
        return cache;
      })
      .catch(() => {
        cache = { user: null, salons: [] };
        return cache;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Invalidate after sign-in / sign-out / profile edits. */
export function refreshMe() {
  return load(true);
}

export function clearMe() {
  cache = { user: null, salons: [] };
  listeners.forEach((l) => l(cache!));
}

/** Session summary for headers and gated actions. `loading` is true until the first fetch lands. */
export function useMe() {
  const [me, setMe] = useState<Me | null>(cache);
  useEffect(() => {
    listeners.add(setMe);
    void load().then(setMe);
    return () => {
      listeners.delete(setMe);
    };
  }, []);
  const refresh = useCallback(() => load(true).then(setMe), []);
  return { me, user: me?.user ?? null, salons: me?.salons ?? [], loading: me === null, refresh };
}
