"use client";

// One /me for the whole app. Components share a module-level cache so the
// topbar, Today, Planner, and chat don't each hit the backend; the cache
// clears on any auth change and callers can refresh() after a save.

import { useCallback, useEffect, useState } from "react";
import { getMe, type Me } from "./api";
import { supabase } from "./supabase";

let cached: Promise<Me | null> | null = null;
const listeners = new Set<() => void>();

function load(): Promise<Me | null> {
  if (!cached) {
    cached = (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return null;
      try {
        return await getMe();
      } catch {
        return null;
      }
    })();
  }
  return cached;
}

export function invalidateMe() {
  cached = null;
  listeners.forEach((fn) => fn());
}

supabase.auth.onAuthStateChange(() => invalidateMe());

export function useMe(): { me: Me | null; loading: boolean; refresh: () => void } {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const pull = useCallback(() => {
    let cancelled = false;
    load().then((m) => {
      if (!cancelled) {
        setMe(m);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const cancel = pull();
    const fn = () => pull();
    listeners.add(fn);
    return () => {
      cancel();
      listeners.delete(fn);
    };
  }, [pull]);

  return { me, loading, refresh: invalidateMe };
}
