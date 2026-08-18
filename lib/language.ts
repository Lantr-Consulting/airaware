"use client";

import { useSyncExternalStore } from "react";

export type Language = "zh" | "en";
const KEY = "lantr-lang";
const EVENT = "lantr-language-change";

// Everything must render as zh (the SSR default) until hydration finishes,
// even when the visitor's cookie says en. Otherwise the hydration render
// disagrees with the server HTML, React re-renders the root to recover, and
// that wipes attributes React doesn't own (like the data-theme stamp, which
// is how English visitors were losing light mode). LanguageBoot flips this
// right after mount and pings every useLanguage subscriber.
let hydrated = false;

export function markHydrated() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  window.dispatchEvent(new Event(EVENT));
}

export function getLanguage(): Language {
  if (typeof document === "undefined" || !hydrated) return "zh";
  try {
    const cookie = document.cookie.match(/(?:^|; )lantr-lang=(en|zh)/)?.[1];
    if (cookie === "en" || cookie === "zh") return cookie;
    const saved = localStorage.getItem(KEY);
    if (saved === "en" || saved === "zh") return saved;
  } catch {}
  return "zh";
}

export function setLanguage(language: Language) {
  try {
    localStorage.setItem(KEY, language);
    const domain = location.hostname.endsWith("lantr.site") ? "; Domain=.lantr.site" : "";
    document.cookie = `${KEY}=${language}${domain}; Path=/; Max-Age=${365 * 86400}; SameSite=Lax`;
  } catch {}
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useLanguage(): Language {
  return useSyncExternalStore(subscribe, getLanguage, () => "zh");
}

export function pick<T>(language: Language, zh: T, en: T): T {
  return language === "zh" ? zh : en;
}
