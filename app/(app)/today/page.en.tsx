"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BandLegend, DayTimeline } from "@/components/day-timeline";
import { PlanItemCard } from "@/components/plan-item-card";
import { Card, ConditionTile, ScoreRing } from "@/components/ui";
import { Onboarding } from "@/components/onboarding";
import { useToast } from "@/components/toast";
import { aqiBand, heatBand, pollenBand, uvBand } from "@/lib/bands";
import {
  acceptItem,
  declineItem,
  generatePlan,
  getConditions,
  getRun,
  getTodayPlan,
  listActivities,
  steerRun,
  type LiveConditions,
} from "@/lib/api";
import { fmtWeekday } from "@/lib/format";
import { ACTIVITIES, HOME, NOW_HHMM, TODAY, TODAY_HOURLY, TODAY_PLAN } from "@/lib/mock.en";
import { activitiesOn } from "@/lib/schedule";
import { invalidateMe, useMe } from "@/lib/use-me";
import type { Activity, DayPlan, PlanItem } from "@/lib/types";

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
          ? "A plan run is already in flight. Steer it or wait."
          : "Couldn't start the planner. Try again in a moment."
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
          toast("success", "Your day is planned. Every item measured by the engine.");
        } else if (status.status === "error") {
          setRun(null);
          setElapsed(0);
          toast("error", "The planner hit an error. Try again in a moment.");
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
      toast("info", "Noted. The planner reads steering on its next run.");
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
    if (blocked) toast("error", "Conditions moved. The engine re-checked and this window no longer clears.");
    else toast("success", "Accepted. It's on your plan.");
    return blocked;
  }

  async function onDecline(item: PlanItem, reason: string): Promise<void> {
    replaceItem(await declineItem(item.id, reason));
    toast("info", "Noted. The planner treats your reason as a standing lesson.");
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

  // The agent greets and briefs. Everything in this line is real data.
  const hourNow = parseInt(nowTime.slice(0, 2), 10);
  const greeting = hourNow < 12 ? "Good morning" : hourNow < 18 ? "Good afternoon" : "Good evening";
  const locationName = live && me ? me.homeLocation.name : HOME.name;
  const actWord = schedule.length === 1 ? "activity" : "activities";
  const agentLine = activePlan
    ? `It's ${fmtWeekday(dateIso)} in ${locationName}. I've checked UV, heat, air quality, and pollen. You have ${schedule.length} ${actWord} today${
        proposals.length > 0
          ? `, and ${proposals.length} ${proposals.length === 1 ? "suggestion is" : "suggestions are"} waiting on you`
          : ", and nothing needs your attention"
      }.`
    : `It's ${fmtWeekday(dateIso)} in ${locationName}. I'm watching UV, heat, air quality, and pollen, ready to plan the day around your ${schedule.length} ${actWord}.`;

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
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="font-display text-[32px] font-semibold tracking-tight">{greeting}</h1>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
              live ? "bg-good/10 text-good" : "bg-ink/10 text-ink-muted"
            }`}
          >
            {live ? "Live" : "Sample"}
          </span>
          {signedOut && (
            <Link href="/signin" className="text-sm font-medium text-accent hover:underline">
              Sign in to plan your real day →
            </Link>
          )}
        </div>
        <p className="mt-2 max-w-3xl text-base leading-relaxed text-ink-2">{agentLine}</p>
      </header>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="flex flex-col gap-5 xl:col-span-7">
        {activePlan ? (
          <div className="banner flex flex-1 flex-wrap items-center gap-x-10 gap-y-6 p-6 sm:p-8">
            <ScoreRing
              score={activePlan.dayScore}
              color="#ffffff"
              track="rgba(255, 255, 255, 0.28)"
            />
            <div className="min-w-0 flex-1 basis-72">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-medium uppercase tracking-[0.08em] text-white/70">
                  Today's outdoor score
                </span>
                {live && !run && (
                  <button onClick={planMyDay} className="rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-[#0d55a5] transition-colors hover:bg-white/90">
                    Re-plan
                  </button>
                )}
              </div>
              <p className="mt-3 max-w-3xl text-lg leading-relaxed text-white">
                {activePlan.summary}
              </p>
              {activePlan.supersededNote && (
                <p className="mt-2.5 text-sm text-white/60">{activePlan.supersededNote}</p>
              )}
            </div>
          </div>
        ) : (
          !needsSetup &&
          !run && (
            <div className="pane flex flex-wrap items-center gap-3 p-6">
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
          <div className="pane p-4">
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
              note. Steering lands on the next run.
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
        </div>

        <div className="flex flex-col gap-4 xl:col-span-5">
        {needsSetup && <Onboarding />}

      {/* The agent, at a glance. Always know what it's doing and what it
          needs from you. Decisions come before dashboards. */}
      {live && me && !needsSetup && (
        <div className="pane flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-sm text-ink-2">
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
              {proposals.length} decision{proposals.length > 1 ? "s" : ""} waiting on you
            </span>
          ) : activePlan ? (
            <span className="text-ink-muted">Nothing needs you. Plan is set</span>
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
          {proposals.map((item) => (
            <PlanItemCard key={item.id} item={item} {...handlers} />
          ))}
        </section>
      )}
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold tracking-tight">Right now</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <ConditionTile label={live ? "UV index · now" : "UV index · sample"} value={String(now.uvIndex)} band={uvBand(now.uvIndex)} trend={hourly.map((h) => h.uvIndex)} kind="uv" />
        <ConditionTile label="Feels like" value={String(now.apparentF)} unit="°F" band={heatBand(now.apparentF)} trend={hourly.map((h) => h.apparentF)} kind="heat" />
        <ConditionTile label="Air quality (US AQI)" value={String(now.usAqi)} band={aqiBand(now.usAqi)} trend={hourly.map((h) => h.usAqi)} kind="air" />
        <ConditionTile
          label="Pollen"
          value={now.pollen ? now.pollen.index.toFixed(1) : "–"}
          band={now.pollen ? pollenBand(now.pollen.index) : undefined}
          noCoverage={now.pollen === null}
          trend={now.pollen ? hourly.map((h) => h.pollen?.index ?? 0) : undefined}
          kind="pollen"
        />
        </div>
      </section>

      <Card title="When to be outside today" action={<BandLegend />}>
        <DayTimeline hours={hourly} activities={schedule} nowTime={nowTime} />
      </Card>

      {onPlanItems.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-2">Today&apos;s plan</h2>
          <div className="grid items-start gap-4 md:grid-cols-2">
            {onPlanItems.map((item) => (
              <PlanItemCard key={item.id} item={item} {...handlers} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
