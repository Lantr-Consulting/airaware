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
  getTodayPlan,
  listActivities,
  patchSettings,
  type LiveConditions,
} from "@/lib/api";
import { fmtWeekday } from "@/lib/format";
import { ACTIVITIES, NOW_HHMM, TODAY, TODAY_HOURLY, TODAY_PLAN } from "@/lib/mock";
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
    { href: "/profile", title: "Set your home location", detail: "Plans use your sky, not our demo city.", done: false },
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
              className="flex items-start gap-3 rounded-xl border border-hairline px-4 py-3 transition-colors hover:bg-white/5"
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
  const [planning, setPlanning] = useState(false);

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
    if (planning) return;
    setPlanning(true);
    try {
      setPlan(await generatePlan());
      toast("success", "Your day is planned — every item measured by the engine.");
    } catch {
      toast("error", "The planner couldn't finish — try again in a moment.");
    } finally {
      setPlanning(false);
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
              live ? "bg-good/10 text-good" : "bg-white/10 text-ink-muted"
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
              {live && (
                <button
                  onClick={planMyDay}
                  disabled={planning}
                  className="btn-ghost px-3.5 py-1.5 text-xs"
                >
                  {planning ? "Re-planning…" : "Re-plan"}
                </button>
              )}
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-2">
              {activePlan.summary}
            </p>
          </>
        ) : (
          !needsSetup && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button onClick={planMyDay} disabled={planning} className="btn-primary px-5 py-2.5 text-sm">
                {planning ? "Planning your day…" : "Plan my day"}
              </button>
              <span className="text-xs text-ink-muted">
                {planning
                  ? "The planner is scoring windows with the exposure engine — usually under a minute."
                  : "The agent reads your schedule and the live forecast, and proposes only what the engine clears."}
              </span>
            </div>
          )
        )}
      </header>

      {needsSetup && (
        <SetupCard hasNotes={Boolean(me?.profile.notes)} onActivated={() => {}} />
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
