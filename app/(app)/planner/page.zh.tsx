"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { aqiBand, heatBand, pollenBand, uvBand, SEVERITY_TEXT } from "@/lib/bands";
import { getConditions, getTodayPlan, listActivities } from "@/lib/api";
import { fmtDate, fmtTempF, fmtTime } from "@/lib/format";
import { ACTIVITIES, PLANS, TODAY, WEEK } from "@/lib/mock";
import { activitiesOn } from "@/lib/schedule";
import { useMe } from "@/lib/use-me";
import type { BandInfo } from "@/lib/bands";
import type { Activity, DailySummary, DayPlan } from "@/lib/types";

function Chip({ label, value, band }: { label: string; value: string; band: BandInfo | null }) {
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span className="text-ink-muted">{label}</span>
      {band === null ? (
        <span className="text-ink-muted">, </span>
      ) : (
        <span className={`flex items-center gap-1 font-medium ${SEVERITY_TEXT[band.severity]}`}>
          <span aria-hidden className="inline-block size-2 rounded-full bg-current" />
          {value}
        </span>
      )}
    </span>
  );
}

const PLAN_STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: "计划已生效", cls: "bg-good/10 text-good" },
  draft: { label: "草案", cls: "bg-accent/15 text-accent" },
  superseded: { label: "已被新计划替代", cls: "bg-ink/10 text-ink-2" },
};

export default function PlannerPage() {
  const { me, loading } = useMe();
  const [days, setDays] = useState<DailySummary[] | null>(null);
  const [acts, setActs] = useState<Activity[] | null>(null);
  const [todayPlan, setTodayPlan] = useState<DayPlan | null>(null);

  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    (async () => {
      const home = me.homeLocation;
      const [c, a, p] = await Promise.allSettled([
        getConditions({ lat: home.lat, lon: home.lon, zip: home.zip, name: home.name }),
        listActivities(),
        getTodayPlan(),
      ]);
      if (cancelled) return;
      if (c.status === "fulfilled") setDays(c.value.daily);
      if (a.status === "fulfilled") setActs(a.value);
      if (p.status === "fulfilled") setTodayPlan(p.value);
    })();
    return () => {
      cancelled = true;
    };
  }, [me]);

  const live = me !== null && days !== null;
  const week = live ? days : WEEK;
  const activities = live && acts ? acts : ACTIVITIES;
  const todayIso = live ? days[0].date : TODAY;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-semibold tracking-tight">未来一周</h1>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              live ? "bg-good/10 text-good" : "bg-ink/10 text-ink-muted"
            }`}
          >
            {live ? "实时" : "演示"}
          </span>
        </div>
        <p className="mt-1.5 max-w-3xl text-[15px] leading-relaxed text-ink-2">
          将每周活动与{live ? ` ${me.homeLocation.name} 的` : ""}七日预报放在一起比较，提前看到需要调整的时段。
        </p>
        {!loading && me === null && (
          <Link href="/signin" className="mt-1 inline-block text-xs font-medium text-accent hover:underline">
            登录后查看你的实际一周 →
          </Link>
        )}
      </header>

      {me !== null && days === null ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-48" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {week.map((day) => {
            const schedule = activitiesOn(activities, day.date);
            const plan = live
              ? todayPlan && todayPlan.date === day.date
                ? todayPlan
                : null
              : PLANS.find((p) => p.date === day.date && p.status !== "superseded") ?? null;
            const proposals = plan?.items.filter((i) => i.status === "proposed").length ?? 0;
            const isToday = day.date === todayIso;
            return (
              <Card key={day.date} className={isToday ? "ring-1 ring-accent/40" : ""}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold tracking-tight">
                    {fmtDate(day.date)}
                    {isToday && <span className="ml-2 text-xs font-medium text-accent">今天</span>}
                  </div>
                  {plan ? (
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${PLAN_STATUS[plan.status].cls}`}
                    >
                      {PLAN_STATUS[plan.status].label}
                    </span>
                  ) : (
                    isToday &&
                    live && (
                      <Link href="/today" className="btn-ghost px-2.5 py-0.5 text-[11px]">
                        规划今天
                      </Link>
                    )
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                  <Chip label="UV" value={String(day.uvMax)} band={uvBand(day.uvMax)} />
                  <Chip label="体感" value={fmtTempF(day.apparentMaxF)} band={heatBand(day.apparentMaxF)} />
                  <Chip label="AQI" value={String(day.aqiMax)} band={aqiBand(day.aqiMax)} />
                  <Chip
                    label="花粉"
                    value={day.pollen ? day.pollen.index.toFixed(1) : "–"}
                    band={day.pollen ? pollenBand(day.pollen.index) : null}
                  />
                </div>

                <ul className="mt-4 flex flex-col gap-1.5 border-t border-hairline pt-3 text-sm">
                  {schedule.length === 0 && <li className="text-ink-muted">当天没有安排活动。</li>}
                  {schedule.map(({ activity, start }) => (
                    <li key={activity.id} className="flex items-center justify-between gap-2">
                      <span className="text-ink-2">{activity.name}</span>
                      <span
                        className="text-xs text-ink-muted"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {fmtTime(start)}
                      </span>
                    </li>
                  ))}
                </ul>

                {proposals > 0 && (
                  <Link href="/today" className="mt-3 block text-xs font-medium text-accent hover:underline">
                    有 {proposals} 项调整等待确认 →
                  </Link>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
