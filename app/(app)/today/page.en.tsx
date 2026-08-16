"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BandLegend, DayTimeline } from "@/components/day-timeline";
import { PlanItemCard } from "@/components/plan-item-card";
import { Card, ConditionTile } from "@/components/ui";
import { useToast } from "@/components/toast";
import { aqiBand, dayScoreTone, heatBand, pollenBand, uvBand } from "@/lib/bands";
import {
  acceptItem,
  declineItem,
  generatePlan,
  getConditions,
  getRun,
  getTodayPlan,
  listActivities,
  patchSettings,
  steerRun,
  type LiveConditions,
} from "@/lib/api";
import { fmtWeekday } from "@/lib/format";
import { ACTIVITIES, NOW_HHMM, TODAY, TODAY_HOURLY, TODAY_PLAN } from "@/lib/mock.en";
import { activitiesOn } from "@/lib/schedule";
import { invalidateMe, useMe } from "@/lib/use-me";
import type { Activity, DayPlan, PlanItem } from "@/lib/types";

function SetupCard({ hasNotes, onActivated }: { hasNotes: boolean; onActivated: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function activate() {
    setBusy(true);
    try {
      await patchSettings({ activated: true });
      invalidateMe();
      onActivated();
      toast("success", "Advisor activated — planning your first day is one click away.");
    } catch {
      toast("error", "Couldn't activate — try again.");
    } finally {
      setBusy(false);
    }
  }

  const steps = [
    { href: "/profile", title: "Set your home location", detail: "Plans will use the forecast for your area.", done: false },
    { href: "/profile", title: "Describe yourself", detail: "Allergies, skin, heat, kids — plain English becomes enforced limits.", done: hasNotes },
    { href: "/activities", title: "Review your week", detail: "We seeded a starter week — make it yours.", done: false },
  ];

  return (
    <Card className="border border-accent/30">
      <h2 className="text-sm font-semibold tracking-tight">Welcome to AirAware</h2>
      <p className="mt-1 text-sm text-ink-2">
        Three quick steps, then activate. Nothing plans until you bless it.
      </p>
      <ul className="mt-4 flex flex-col gap-2">
        {steps.map((s, i) => (
          <li key={s.title}>
            <Link
              href={s.href}
              className="flex items-start gap-3 rounded-xl border border-hairline px-4 py-3 transition-colors hover:bg-ink/5"
            >
              <span
                className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  s.done ? "bg-good text-page" : "bg-surface-2 text-ink-muted"
                }`}
              >
                {s.done ? "✓" : i + 1}
              </span>
              <span>
                <span className="block text-sm font-medium">{s.title}</span>
                <span className="block text-xs text-ink-muted">{s.detail}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-xs text-ink-muted">Looks like you? Then:</span>
        <button onClick={activate} disabled={busy} className="btn-primary px-5 py-2 text-sm">
          {busy ? "Activating…" : "Activate my advisor"}
        </button>
      </div>
    </Card>
  );
}

export default function TodayPage() {
  const toast = useToast();
  const { me, loading: meLoading } = useMe();
  const [cond, setCond] = useState<LiveConditions | null>(null);
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [myActivities, setMyActivities] = useState<Activity[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [run, setRun] = useState<{ id: string; started: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [steerDraft, setSteerDraft] = useState("");

  const signedOut = !meLoading && me === null;

  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    (async () => {
      const home = me.homeLocation;
      const [c, p, acts] = await Promise.allSettled([
        getConditions({ lat: home.lat, lon: home.lon, zip: home.zip, name: home.name }),
        getTodayPlan(),
        listActivities(),
      ]);
      if (cancelled) return;
      if (c.status === "fulfilled") setCond(c.value);
      else setOffline(true);
      if (p.status === "fulfilled") setPlan(p.value);
      if (acts.status === "fulfilled") setMyActivities(acts.value);
    })();
    return () => {
      cancelled = true;
    };
  }, [me]);

  async function planMyDay() {
    if (run) return;
    try {
      const { runId } = await generatePlan();
      setRun({ id: runId, started: Date.now() });
    } catch (e) {
      toast(
        "error",
        e instanceof Error && e.message.includes("in flight")
          ? "A plan run is already in flight — steer it or wait."
          : "Couldn't start the planner — try again in a moment."
      );
    }
  }

  // Poll the run in the DB until it lands; either backend worker can answer.
  useEffect(() => {
    if (!run) return;
    const t = setInterval(async () => {
      setElapsed(Math.round((Date.now() - run.started) / 1000));
      try {
        const status = await getRun(run.id);
        if (status.status === "done") {
          setRun(null);
          setElapsed(0);
          setPlan(await getTodayPlan());
          toast("success", "Your day is planned — every item measured by the engine.");
        } else if (status.status === "error") {
          setRun(null);
          setElapsed(0);
          toast("error", "The planner hit an error — try again in a moment.");
        }
      } catch {}
    }, 3000);
    return () => clearInterval(t);
  }, [run, toast]);

  async function sendSteer() {
    const note = steerDraft.trim();
    if (!note || !run) return;
    try {
      await steerRun(run.id, note);
      setSteerDraft("");
      toast("info", "Noted — the planner reads steering on its next run.");
    } catch {
      toast("error", "Couldn't save the note.");
    }
  }

  function replaceItem(updated: PlanItem) {
    setPlan((p) =>
      p ? { ...p, items: p.items.map((i) => (i.id === updated.id ? updated : i)) } : p
    );
  }

  async function onAccept(item: PlanItem): Promise<string | null> {
    const { item: updated, blocked } = await acceptItem(item.id);
    replaceItem(updated);
    if (blocked) toast("error", "Conditions moved — the engine re-checked and this window no longer clears.");
    else toast("success", "Accepted — it's on your plan.");
    return blocked;
  }

  async function onDecline(item: PlanItem, reason: string): Promise<void> {
    replaceItem(await declineItem(item.id, reason));
    toast("info", "Noted — the planner treats your reason as a standing lesson.");
  }

  // ----- pick live or sample data -----
  const live = !signedOut && !offline && cond !== null;
  const pendingLive = me !== null && cond === null && !offline;
  const activePlan = live ? plan : signedOut || offline ? TODAY_PLAN : null;
  const hourly = live ? cond.hourly.slice(6, 22) : TODAY_HOURLY;
  const now = live ? cond.hourly[cond.nowIndex] : TODAY_HOURLY.find((x) => x.time.includes(`T${NOW_HHMM}`))!;
  const dateIso = live ? (plan?.date ?? new Date().toISOString().slice(0, 10)) : TODAY;
  const nowTime = now.time.slice(11, 16);
  const schedule = activitiesOn(live && myActivities ? myActivities : ACTIVITIES, dateIso);
  const proposals = activePlan?.items.filter((i) => i.status === "proposed") ?? [];
  const onPlanItems = activePlan?.items.filter((i) => i.status !== "proposed") ?? [];
  const handlers = live ? { onAccept, onDecline } : {};
  const needsSetup = live && me !== null && !me.activated;

  if (pendingLive) {
    return (
      <div className="flex flex-col gap-6">
        <div className="skeleton h-28 max-w-xl" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-24" />
          ))}
        </div>
        <div className="skeleton h-64" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <div className="flex items-center gap-2.5 text-sm text-ink-muted">
          {fmtWeekday(dateIso)}&apos;s outlook
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              live ? "bg-good/10 text-good" : "bg-ink/10 text-ink-muted"
            }`}
          >
            {live ? "Live" : "Sample"}
          </span>
          {live && <span className="text-xs text-ink-muted">{me?.homeLocation.name}</span>}
          {signedOut && (
            <Link href="/signin" className="text-xs font-medium text-accent hover:underline">
              Sign in to plan your real day →
            </Link>
          )}
        </div>

        {activePlan ? (
          <>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span
                className={`text-5xl font-semibold tracking-tight ${dayScoreTone(activePlan.dayScore)}`}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {activePlan.dayScore}
              </span>
              <span className="text-sm text-ink-muted">day score / 100</span>
              {live && !run && (
                <button onClick={planMyDay} className="btn-ghost px-3.5 py-1.5 text-xs">
                  Re-plan
                </button>
              )}
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-2">
              {activePlan.summary}
            </p>
            {activePlan.supersededNote && (
              <p className="mt-2 text-xs text-ink-muted">{activePlan.supersededNote}</p>
            )}
          </>
        ) : (
          !needsSetup &&
          !run && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button onClick={planMyDay} className="btn-primary px-5 py-2.5 text-sm">
                Plan my day
              </button>
              <span className="text-xs text-ink-muted">
                The agent reads your schedule and the live forecast, and proposes only what the engine clears.
              </span>
            </div>
          )
        )}

        {run && (
          <div className="mt-4 max-w-2xl rounded-2xl bg-surface p-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">Planning your day…</span>
              <span className="text-xs text-ink-muted" style={{ fontVariantNumeric: "tabular-nums" }}>
                {elapsed}s
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-1000"
                style={{ width: `${Math.min(95, (elapsed / 75) * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-ink-muted">
              The agent is scoring windows with the exposure engine. Leave it a
              note — steering lands on the next run.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <input
                value={steerDraft}
                onChange={(e) => setSteerDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendSteer()}
                placeholder="e.g. Nothing before 7 am this week"
                className="flex-1 rounded-full border border-hairline bg-page px-3.5 py-1.5 text-sm placeholder:text-ink-muted"
              />
              <button onClick={sendSteer} className="btn-ghost px-3.5 py-1.5 text-xs">
                Steer
              </button>
            </div>
          </div>
        )}
      </header>

      {needsSetup && (
        <SetupCard hasNotes={Boolean(me?.profile.notes)} onActivated={() => {}} />
      )}

      {/* The agent, at a glance — always know what it's doing and what it
          needs from you. Decisions come before dashboards. */}
      {live && me && !needsSetup && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-hairline px-4 py-2.5 text-xs text-ink-2">
          <span className="flex items-center gap-1.5 font-medium">
            <span
              aria-hidden
              className={`inline-block size-2 rounded-full ${me.paused ? "bg-band-1" : "bg-good"}`}
            />
            Advisor {me.paused ? "paused" : "active"}
          </span>
          <span className="text-ink-muted">Watching {me.homeLocation.name}</span>
          {run ? (
            <span className="text-accent">Planning now…</span>
          ) : proposals.length > 0 ? (
            <span className="font-medium text-accent">
              {proposals.length} decision{proposals.length > 1 ? "s" : ""} waiting on you ↓
            </span>
          ) : activePlan ? (
            <span className="text-ink-muted">Nothing needs you — plan is set</span>
          ) : (
            <span className="text-ink-muted">No plan yet today</span>
          )}
          <Link href="/advisor" className="ml-auto font-medium text-accent hover:underline">
            Ask the advisor →
          </Link>
        </div>
      )}

      {proposals.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold tracking-tight">
            Waiting on you ({proposals.length})
          </h2>
          {proposals.map((item) => (
            <PlanItemCard key={item.id} item={item} {...handlers} />
          ))}
        </section>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <ConditionTile label={live ? "UV index · now" : "UV index · sample"} value={String(now.uvIndex)} band={uvBand(now.uvIndex)} />
        <ConditionTile label="Feels like" value={String(now.apparentF)} unit="°F" band={heatBand(now.apparentF)} />
        <ConditionTile label="Air quality (US AQI)" value={String(now.usAqi)} band={aqiBand(now.usAqi)} />
        <ConditionTile
          label="Pollen"
          value={now.pollen ? now.pollen.index.toFixed(1) : "—"}
          band={now.pollen ? pollenBand(now.pollen.index) : undefined}
          noCoverage={now.pollen === null}
        />
      </div>

      <Card title="Your day against the sky" action={<BandLegend />}>
        <DayTimeline hours={hourly} activities={schedule} nowTime={nowTime} />
      </Card>

      {onPlanItems.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold tracking-tight">Today&apos;s plan</h2>
          {onPlanItems.map((item) => (
            <PlanItemCard key={item.id} item={item} {...handlers} />
          ))}
        </section>
      )}
    </div>
  );
}
