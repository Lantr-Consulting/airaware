"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { useToast } from "@/components/toast";
import { createActivity, deleteActivity, listActivities, updateActivity } from "@/lib/api";
import { DOW_SHORT, fmtDays, fmtTime } from "@/lib/format";
import { ACTIVITIES } from "@/lib/mock";
import { supabase } from "@/lib/supabase";
import type { Activity, ActivityKind, Flexibility, Intensity } from "@/lib/types";

const KIND_LABEL: Record<ActivityKind, string> = {
  run: "Run",
  commute: "Commute",
  sport: "Sport",
  hike: "Hike",
  chores: "Chores",
  volunteer: "Volunteer",
};

const FLEX_LABEL: Record<Flexibility, string> = {
  fixed: "Fixed time",
  flex_time: "Time can move",
  flex_day: "Day can move",
};

const EMPTY_FORM = {
  name: "",
  kind: "run" as ActivityKind,
  daysOfWeek: [] as number[],
  startTime: "07:00",
  durationMin: 45,
  intensity: "moderate" as Intensity,
  flexibility: "flex_time" as Flexibility,
  indoorAlternative: "",
  enabled: true,
};

export default function ActivitiesPage() {
  const toast = useToast();
  const [signedOut, setSignedOut] = useState(false);
  const [offline, setOffline] = useState(false);
  const [items, setItems] = useState<Activity[]>(ACTIVITIES);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  const live = !signedOut && !offline;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        setSignedOut(true);
        return;
      }
      try {
        const acts = await listActivities();
        if (!cancelled) setItems(acts);
      } catch {
        if (!cancelled) setOffline(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle(a: Activity) {
    if (!live) return;
    setItems((xs) => xs.map((x) => (x.id === a.id ? { ...x, enabled: !a.enabled } : x)));
    try {
      await updateActivity(a.id, { enabled: !a.enabled });
    } catch {
      setItems((xs) => xs.map((x) => (x.id === a.id ? { ...x, enabled: a.enabled } : x)));
    }
  }

  async function remove(a: Activity) {
    if (!live) return;
    const prev = items;
    setItems((xs) => xs.filter((x) => x.id !== a.id));
    try {
      await deleteActivity(a.id);
      toast("info", `“${a.name}” removed from your week.`);
    } catch {
      setItems(prev);
      toast("error", "Couldn't delete — restored it.");
    }
  }

  async function add() {
    if (!live || busy || !form.name.trim() || form.daysOfWeek.length === 0) return;
    setBusy(true);
    try {
      const created = await createActivity({
        ...form,
        name: form.name.trim(),
        indoorAlternative: form.indoorAlternative.trim() || undefined,
      });
      setItems((xs) => [...xs, created].sort((a, b) => a.startTime.localeCompare(b.startTime)));
      setForm(EMPTY_FORM);
      setAdding(false);
      toast("success", `“${created.name}” added — the planner sees it on its days.`);
    } catch {
      toast("error", "Couldn't save the activity — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight">Activities</h1>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                live ? "bg-good/10 text-good" : "bg-white/10 text-ink-muted"
              }`}
            >
              {live ? "Live" : "Sample"}
            </span>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-ink-2">
            The recurring shape of your week. Flexibility is what gives the
            planner room to work: a movable run gets better windows; a fixed
            practice gets warnings and gear instead.
          </p>
          {signedOut && (
            <Link href="/signin" className="mt-1 inline-block text-xs font-medium text-accent hover:underline">
              Sign in to build your own week →
            </Link>
          )}
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          disabled={!live}
          className="btn-primary px-4 py-2 text-sm disabled:opacity-45"
        >
          {adding ? "Close" : "Add activity"}
        </button>
      </header>

      {adding && live && (
        <Card title="New activity">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Name — e.g. Lunchtime walk"
              className="rounded-lg border border-hairline bg-page px-3.5 py-2.5 text-sm placeholder:text-ink-muted sm:col-span-2"
            />
            <label className="flex items-center justify-between gap-3 text-sm text-ink-2">
              Kind
              <select
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value as ActivityKind })}
                className="rounded-lg border border-hairline bg-page px-3 py-2 text-sm"
              >
                {Object.entries(KIND_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center justify-between gap-3 text-sm text-ink-2">
              Intensity
              <select
                value={form.intensity}
                onChange={(e) => setForm({ ...form, intensity: e.target.value as Intensity })}
                className="rounded-lg border border-hairline bg-page px-3 py-2 text-sm"
              >
                <option value="low">Low</option>
                <option value="moderate">Moderate</option>
                <option value="high">High</option>
              </select>
            </label>
            <label className="flex items-center justify-between gap-3 text-sm text-ink-2">
              Starts
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className="rounded-lg border border-hairline bg-page px-3 py-2 text-sm"
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm text-ink-2">
              Minutes
              <input
                type="number"
                min={10}
                max={480}
                value={form.durationMin}
                onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })}
                className="w-24 rounded-lg border border-hairline bg-page px-3 py-2 text-sm"
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm text-ink-2">
              Flexibility
              <select
                value={form.flexibility}
                onChange={(e) => setForm({ ...form, flexibility: e.target.value as Flexibility })}
                className="rounded-lg border border-hairline bg-page px-3 py-2 text-sm"
              >
                {Object.entries(FLEX_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </label>
            <input
              value={form.indoorAlternative}
              onChange={(e) => setForm({ ...form, indoorAlternative: e.target.value })}
              placeholder="Indoor alternative (optional)"
              className="rounded-lg border border-hairline bg-page px-3.5 py-2.5 text-sm placeholder:text-ink-muted"
            />
            <div className="flex flex-wrap items-center gap-1.5 sm:col-span-2">
              {DOW_SHORT.map((d, i) => (
                <button
                  key={d}
                  onClick={() =>
                    setForm({
                      ...form,
                      daysOfWeek: form.daysOfWeek.includes(i)
                        ? form.daysOfWeek.filter((x) => x !== i)
                        : [...form.daysOfWeek, i].sort(),
                    })
                  }
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    form.daysOfWeek.includes(i)
                      ? "bg-accent text-[#04121c]"
                      : "border border-hairline text-ink-2 hover:text-ink"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={add}
              disabled={busy || !form.name.trim() || form.daysOfWeek.length === 0}
              className="btn-primary px-5 py-2 text-sm disabled:opacity-45"
            >
              {busy ? "Saving…" : "Save activity"}
            </button>
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((a) => (
          <Card key={a.id} className={a.enabled ? "" : "opacity-55"}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[15px] font-semibold tracking-tight">{a.name}</div>
                <div className="mt-0.5 text-xs text-ink-muted">
                  {fmtDays(a.daysOfWeek)} · {fmtTime(a.startTime)} · {a.durationMin} min
                </div>
              </div>
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-ink-2">
                {KIND_LABEL[a.kind]}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-medium">
              <span className="rounded-full border border-hairline px-2.5 py-1 capitalize text-ink-2">
                {a.intensity} intensity
              </span>
              <span className="rounded-full border border-hairline px-2.5 py-1 text-ink-2">
                {FLEX_LABEL[a.flexibility]}
              </span>
              {a.indoorAlternative && (
                <span className="rounded-full border border-hairline px-2.5 py-1 text-ink-2">
                  Indoor: {a.indoorAlternative}
                </span>
              )}
            </div>

            {live && (
              <div className="mt-4 flex items-center gap-3 border-t border-hairline pt-3 text-xs">
                <button onClick={() => toggle(a)} className="btn-ghost px-3 py-1">
                  {a.enabled ? "Disable" : "Enable"}
                </button>
                <button onClick={() => remove(a)} className="text-ink-muted hover:text-critical">
                  Delete
                </button>
              </div>
            )}
          </Card>
        ))}
      </div>

      <p className="text-xs text-ink-muted">
        Intensity matters to the rules: a hard run at AQI 130 is not a picnic
        at AQI 130. The exposure engine applies stricter cutoffs as effort goes
        up.
      </p>
    </div>
  );
}
