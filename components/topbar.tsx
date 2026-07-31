"use client";

import { HOME, TODAY } from "@/lib/mock";
import { fmtDate } from "@/lib/format";
import { useMe } from "@/lib/use-me";

export function TopBar() {
  const { me, loading } = useMe();
  const live = me !== null;
  const name = live ? me.homeLocation.name : HOME.name;
  const dateStr = live
    ? new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    : fmtDate(TODAY);

  return (
    <header className="flex items-center justify-between gap-3 border-b border-hairline bg-page px-5 py-3">
      <div className="flex items-center gap-2 text-sm text-ink-2">
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="size-4 text-ink-muted"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <span className="font-medium text-ink">{loading ? "…" : name}</span>
        <span className="text-ink-muted">· {dateStr}</span>
      </div>
      <span
        className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
          live
            ? "bg-good/10 text-good"
            : "border border-hairline text-ink-muted"
        }`}
      >
        {live ? "Live" : "Sample data"}
      </span>
    </header>
  );
}
