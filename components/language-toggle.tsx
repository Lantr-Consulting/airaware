"use client";

import { setLanguage, useLanguage, type Language } from "@/lib/language";

export function LanguageToggle() {
  const language = useLanguage();
  return (
    <div className="inline-flex rounded-full border border-hairline p-0.5 text-[10px] font-semibold">
      {(["zh", "en"] as Language[]).map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => setLanguage(item)}
          aria-pressed={language === item}
          className={`rounded-full px-2 py-1 ${language === item ? "bg-ink text-page" : "text-ink-muted hover:text-ink"}`}
        >
          {item === "zh" ? "中" : "EN"}
        </button>
      ))}
    </div>
  );
}
