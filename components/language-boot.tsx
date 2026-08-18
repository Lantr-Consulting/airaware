"use client";

import { useEffect } from "react";
import { markHydrated } from "@/lib/language";

// Mounted once in the root layout: after hydration commits, let the real
// language (cookie/localStorage) take over from the zh SSR default.
export function LanguageBoot() {
  useEffect(() => {
    markHydrated();
  }, []);
  return null;
}
