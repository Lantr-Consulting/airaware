"use client";

import { useSyncExternalStore } from "react";

export type Language = "zh" | "en";
const KEY = "lantr-lang";
const EVENT = "lantr-language-change";

export function getLanguage(): Language {
  if (typeof document === "undefined") return "zh";
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
