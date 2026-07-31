"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { BRIEFINGS } from "@/lib/mock";
import { fmtDate } from "@/lib/format";
import { useMe } from "@/lib/use-me";
import type { Briefing } from "@/lib/types";

function cadenceLabel(b: Briefing): string {
  switch (b.cadence) {
    case "daily":
      return `Daily · ${b.hourLocal! % 12 || 12} ${b.hourLocal! >= 12 ? "pm" : "am"}`;
    case "weekly":
      return `Weekly · Fri ${b.hourLocal! % 12 || 12} ${b.hourLocal! >= 12 ? "pm" : "am"}`;
    case "on_change":
      return "On change";
    default:
      return "Manual";
  }
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className={`relative h-6 w-11 rounded-full transition-colors ${
        on ? "bg-accent" : "bg-surface-2"
      }`}
    >
      <span
        className={`absolute top-0.5 size-5 rounded-full bg-page transition-all ${
          on ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

export default function BriefingsPage() {
  const { me } = useMe();
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(BRIEFINGS.map((b) => [b.id, b.enabled]))
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight">Briefings</h1>
            <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              {me ? "Preview — coming soon" : "Sample"}
            </span>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-ink-2">
            Standing instructions the advisor runs on its own — every morning,
            every week, or the moment a signal crosses a line you set.
            {me && " These examples show what's coming with the always-on milestone; your own briefings aren't live yet."}
          </p>
        </div>
        <button
          disabled={Boolean(me)}
          title={me ? "Arrives with the always-on milestone" : undefined}
          className="btn-primary px-4 py-2 text-sm disabled:opacity-45"
        >
          New briefing
        </button>
      </header>

      <div className="flex flex-col gap-4">
        {BRIEFINGS.map((b) => (
          <Card key={b.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-[15px] font-semibold tracking-tight">{b.title}</h2>
                <span className="rounded-full bg-ink/10 px-2.5 py-0.5 text-[11px] font-medium text-ink-2">
                  {cadenceLabel(b)}
                </span>
                {b.trigger && (
                  <span className="rounded-full border border-hairline px-2.5 py-0.5 text-[11px] text-ink-muted">
                    {b.trigger.signal.toUpperCase()} reaches band {b.trigger.severity}+
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  className="btn-ghost px-3.5 py-1.5 text-xs"
                  title="Live runs arrive with the scheduler in Milestone 8"
                >
                  Run now
                </button>
                <Toggle
                  on={enabled[b.id]}
                  onClick={() => setEnabled((e) => ({ ...e, [b.id]: !e[b.id] }))}
                />
              </div>
            </div>

            <p className="mt-3 border-l-2 border-hairline pl-3 text-sm italic leading-relaxed text-ink-muted">
              “{b.prompt}”
            </p>

            {b.latestReport && (
              <div className="mt-4 rounded-xl bg-surface-2 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                  Latest report{b.lastRunAt ? ` · ${fmtDate(b.lastRunAt.slice(0, 10))}` : ""}
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
                  {b.latestReport.replace(/\*\*/g, "")}
                </p>
              </div>
            )}

            {b.pastRuns.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1 text-xs text-ink-muted">
                {b.pastRuns.map((r) => (
                  <li key={r.date}>
                    <span className="text-ink-2">{fmtDate(r.date)}</span> — {r.summary}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
