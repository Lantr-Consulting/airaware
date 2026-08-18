"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { useToast } from "@/components/toast";
import {
  createBriefing,
  deleteBriefing,
  getBriefings,
  runBriefing,
  updateBriefing,
} from "@/lib/api";
import { BRIEFINGS } from "@/lib/mock.en";
import { fmtDate } from "@/lib/format";
import { useMe } from "@/lib/use-me";
import type { Briefing, BriefingCadence, Signal } from "@/lib/types";

function cadenceLabel(b: Briefing): string {
  const hour = `${(b.hourLocal ?? 7) % 12 || 12} ${(b.hourLocal ?? 7) >= 12 ? "pm" : "am"}`;
  switch (b.cadence) {
    case "daily":
      return `Daily · ${hour}`;
    case "weekly":
      return `Weekly · Fri ${hour}`;
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

const SIGNALS: { value: Signal; label: string }[] = [
  { value: "aqi", label: "Air quality" },
  { value: "uv", label: "UV" },
  { value: "heat", label: "Heat" },
  { value: "pollen", label: "Pollen" },
];
const SEVERITIES = ["Clear", "Easy", "Caution", "Avoid", "Extreme"];

const EMPTY_FORM = {
  title: "",
  prompt: "",
  cadence: "daily" as BriefingCadence,
  hourLocal: 7,
  signal: "aqi" as Signal,
  severity: 2,
};

export default function BriefingsPage() {
  const toast = useToast();
  const { me, loading } = useMe();
  const [items, setItems] = useState<Briefing[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  // sample-mode toggle state
  const [sampleEnabled, setSampleEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(BRIEFINGS.map((b) => [b.id, b.enabled]))
  );

  const live = me !== null;
  const signedOut = !loading && me === null;

  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    getBriefings()
      .then((b) => !cancelled && setItems(b))
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [me]);

  const shown: Briefing[] = live ? (items ?? []) : BRIEFINGS;

  async function add() {
    if (!form.title.trim() || !form.prompt.trim() || busy) return;
    setBusy(true);
    try {
      const created = await createBriefing({
        title: form.title.trim(),
        prompt: form.prompt.trim(),
        cadence: form.cadence,
        hourLocal: form.hourLocal,
        trigger: form.cadence === "on_change" ? { signal: form.signal, severity: form.severity } : null,
      });
      setItems((xs) => [...(xs ?? []), { ...created, pastRuns: [] }]);
      setForm(EMPTY_FORM);
      setAdding(false);
      toast("success", `“${created.title}” is standing. The scheduler picks it up within a minute.`);
    } catch {
      toast("error", "Couldn't save the briefing.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(b: Briefing) {
    if (!live) {
      setSampleEnabled((e) => ({ ...e, [b.id]: !e[b.id] }));
      return;
    }
    setItems((xs) => xs?.map((x) => (x.id === b.id ? { ...x, enabled: !b.enabled } : x)) ?? null);
    try {
      await updateBriefing(b.id, { enabled: !b.enabled });
    } catch {
      setItems((xs) => xs?.map((x) => (x.id === b.id ? { ...x, enabled: b.enabled } : x)) ?? null);
    }
  }

  async function remove(b: Briefing) {
    if (!live) return;
    const prev = items;
    setItems((xs) => xs?.filter((x) => x.id !== b.id) ?? null);
    try {
      await deleteBriefing(b.id);
      toast("info", `“${b.title}” removed.`);
    } catch {
      setItems(prev);
      toast("error", "Couldn't delete. Restored it.");
    }
  }

  async function runNow(b: Briefing) {
    if (!live || runningId) return;
    setRunningId(b.id);
    try {
      const run = await runBriefing(b.id);
      setItems(
        (xs) =>
          xs?.map((x) =>
            x.id === b.id
              ? {
                  ...x,
                  latestReport: run.report,
                  lastRunAt: run.createdAt,
                  pastRuns: x.latestReport
                    ? [{ date: (x.lastRunAt ?? "").slice(0, 10), summary: x.latestReport.slice(0, 140) }, ...x.pastRuns].slice(0, 4)
                    : x.pastRuns,
                }
              : x
          ) ?? null
      );
      toast("success", "Briefing ran. Report below.");
    } catch {
      toast("error", "The briefing run failed. Try again.");
    } finally {
      setRunningId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight">Briefings</h1>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                live ? "bg-good/10 text-good" : "bg-ink/10 text-ink-muted"
              }`}
            >
              {live ? "Live" : "Sample"}
            </span>
          </div>
          <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-ink-2">
            Standing instructions the advisor runs on its own. Every morning,
            every week, or the moment a signal crosses a line you set. The
            scheduler checks every minute.
          </p>
          {signedOut && (
            <Link href="/signin" className="mt-1 inline-block text-xs font-medium text-accent hover:underline">
              Sign in to set your own →
            </Link>
          )}
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          disabled={!live}
          className="btn-primary px-4 py-2 text-sm disabled:opacity-45"
        >
          {adding ? "Close" : "New briefing"}
        </button>
      </header>

      {adding && live && (
        <Card title="New briefing">
          <div className="flex flex-col gap-3">
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Title. E.g. Morning briefing"
              className="rounded-lg border border-hairline bg-page px-3.5 py-2.5 text-sm placeholder:text-ink-muted"
            />
            <textarea
              value={form.prompt}
              onChange={(e) => setForm({ ...form, prompt: e.target.value })}
              rows={2}
              placeholder="The standing instruction. E.g. Every morning, summarize the day and flag anything risky about my activities."
              className="rounded-xl border border-hairline bg-page px-3.5 py-2.5 text-sm placeholder:text-ink-muted"
            />
            <div className="flex flex-wrap items-center gap-3 text-sm text-ink-2">
              <select
                value={form.cadence}
                onChange={(e) => setForm({ ...form, cadence: e.target.value as BriefingCadence })}
                className="rounded-lg border border-hairline bg-page px-3 py-2 text-sm"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly (Fridays)</option>
                <option value="on_change">On change</option>
                <option value="manual">Manual only</option>
              </select>
              {(form.cadence === "daily" || form.cadence === "weekly") && (
                <label className="flex items-center gap-2">
                  at
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={form.hourLocal}
                    onChange={(e) => setForm({ ...form, hourLocal: Number(e.target.value) })}
                    className="w-16 rounded-lg border border-hairline bg-page px-2 py-2 text-sm"
                  />
                  :00 local
                </label>
              )}
              {form.cadence === "on_change" && (
                <>
                  <span>when</span>
                  <select
                    value={form.signal}
                    onChange={(e) => setForm({ ...form, signal: e.target.value as Signal })}
                    className="rounded-lg border border-hairline bg-page px-3 py-2 text-sm"
                  >
                    {SIGNALS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                  <span>reaches</span>
                  <select
                    value={form.severity}
                    onChange={(e) => setForm({ ...form, severity: Number(e.target.value) })}
                    className="rounded-lg border border-hairline bg-page px-3 py-2 text-sm"
                  >
                    {SEVERITIES.map((s, i) => (
                      <option key={s} value={i}>{s}+</option>
                    ))}
                  </select>
                </>
              )}
            </div>
            <div className="flex justify-end">
              <button
                onClick={add}
                disabled={busy || !form.title.trim() || !form.prompt.trim()}
                className="btn-primary px-5 py-2 text-sm disabled:opacity-45"
              >
                {busy ? "Saving…" : "Save briefing"}
              </button>
            </div>
          </div>
        </Card>
      )}

      {live && items === null ? (
        <div className="flex flex-col gap-4">
          <div className="skeleton h-40" />
          <div className="skeleton h-40" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {shown.length === 0 && (
            <Card>
              <p className="text-sm text-ink-2">
                No standing briefings yet. Create one and the advisor starts
                working without you.
              </p>
            </Card>
          )}
          {shown.map((b) => {
            const enabled = live ? b.enabled : sampleEnabled[b.id];
            return (
              <Card key={b.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <h2 className="text-[15px] font-semibold tracking-tight">{b.title}</h2>
                    <span className="rounded-full bg-ink/10 px-2.5 py-0.5 text-[11px] font-medium text-ink-2">
                      {cadenceLabel(b)}
                    </span>
                    {b.trigger && (
                      <span className="rounded-full border border-hairline px-2.5 py-0.5 text-[11px] text-ink-muted">
                        {SIGNALS.find((s) => s.value === b.trigger?.signal)?.label ?? b.trigger.signal} reaches{" "}
                        {SEVERITIES[b.trigger.severity] ?? b.trigger.severity}+
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => runNow(b)}
                      disabled={!live || runningId !== null}
                      className="btn-ghost px-3.5 py-1.5 text-xs disabled:opacity-45"
                    >
                      {runningId === b.id ? "Running…" : "Run now"}
                    </button>
                    <Toggle on={enabled} onClick={() => toggle(b)} />
                    {live && (
                      <button
                        onClick={() => remove(b)}
                        className="text-xs text-ink-muted hover:text-critical"
                      >
                        Delete
                      </button>
                    )}
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
                    <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink-2">
                      {b.latestReport.replace(/\*\*/g, "")}
                    </p>
                  </div>
                )}

                {b.pastRuns.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-1 text-xs text-ink-muted">
                    {b.pastRuns.map((r, i) => (
                      <li key={`${r.date}-${i}`}>
                        <span className="text-ink-2">{fmtDate(r.date)}</span>. {r.summary.replace(/\*\*/g, "")}…
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
