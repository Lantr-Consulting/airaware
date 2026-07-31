"use client";

import { useEffect, useState } from "react";
import { BandLegend, DayTimeline } from "@/components/day-timeline";
import { PlanItemCard } from "@/components/plan-item-card";
import { Card, ConditionTile } from "@/components/ui";
import { aqiBand, dayScoreTone, heatBand, pollenBand, uvBand } from "@/lib/bands";
import {
  acceptItem,
  declineItem,
  generatePlan,
  getConditions,
  getTodayPlan,
  type LiveConditions,
} from "@/lib/api";
import { fmtWeekday } from "@/lib/format";
import { ACTIVITIES, HOME, NOW_HHMM, TODAY, TODAY_HOURLY, TODAY_PLAN } from "@/lib/mock";
import { activitiesOn } from "@/lib/schedule";
import type { DayPlan, PlanItem } from "@/lib/types";

export default function TodayPage() {
  const [cond, setCond] = useState<LiveConditions | null>(null);
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [offline, setOffline] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [c, p] = await Promise.allSettled([
        getConditions({ lat: HOME.lat, lon: HOME.lon, zip: HOME.zip, name: HOME.name }),
        getTodayPlan(),
      ]);
      if (cancelled) return;
      if (c.status === "fulfilled") {
        setCond(c.value);
        if (p.status === "fulfilled") setPlan(p.value);
        // a 404 (or any plan error) just means: offer "Plan my day"
      } else {
        setOffline(true); // full sample-data fallback
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function planMyDay() {
    if (planning) return;
    setPlanning(true);
    setNotice(null);
    try {
      setPlan(await generatePlan());
    } catch {
      setNotice("The planner couldn't finish — try again in a moment.");
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
    return blocked;
  }

  async function onDecline(item: PlanItem, reason: string): Promise<void> {
    replaceItem(await declineItem(item.id, reason));
  }

  // ----- pick live or sample data -----
  const live = !offline && cond !== null;
  const activePlan = live ? plan : TODAY_PLAN;
  const hourly = live ? cond.hourly.slice(6, 22) : TODAY_HOURLY;
  const now = live ? cond.hourly[cond.nowIndex] : TODAY_HOURLY.find((x) => x.time.includes(`T${NOW_HHMM}`))!;
  const dateIso = live ? (plan?.date ?? new Date().toISOString().slice(0, 10)) : TODAY;
  const nowTime = now.time.slice(11, 16);
  const schedule = activitiesOn(ACTIVITIES, dateIso);
  const proposals = activePlan?.items.filter((i) => i.status === "proposed") ?? [];
  const onPlan = activePlan?.items.filter((i) => i.status !== "proposed") ?? [];
  const handlers = live ? { onAccept, onDecline } : {};

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
            {activePlan.supersededNote && (
              <p className="mt-2 text-xs text-ink-muted">{activePlan.supersededNote}</p>
            )}
          </>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button onClick={planMyDay} disabled={planning} className="btn-primary px-5 py-2.5 text-sm">
              {planning ? "Planning your day…" : "Plan my day"}
            </button>
            <span className="text-xs text-ink-muted">
              {planning
                ? "The planner is scoring windows with the exposure engine — usually under a minute."
                : "No plan for today yet. The agent reads your schedule and the live forecast."}
            </span>
          </div>
        )}
        {notice && <p className="mt-2 text-xs text-band-3">{notice}</p>}
      </header>

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

      {onPlan.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold tracking-tight">Today&apos;s plan</h2>
          {onPlan.map((item) => (
            <PlanItemCard key={item.id} item={item} {...handlers} />
          ))}
        </section>
      )}
    </div>
  );
}
