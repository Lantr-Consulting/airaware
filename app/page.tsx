import { BandLegend, DayTimeline } from "@/components/day-timeline";
import { PlanItemCard } from "@/components/plan-item-card";
import { Card, ConditionTile } from "@/components/ui";
import { aqiBand, dayScoreTone, heatBand, pollenBand, uvBand } from "@/lib/bands";
import { fmtWeekday } from "@/lib/format";
import { ACTIVITIES, NOW_HHMM, TODAY, TODAY_HOURLY, TODAY_PLAN } from "@/lib/mock";
import { activitiesOn } from "@/lib/schedule";

export default function TodayPage() {
  const now = TODAY_HOURLY.find((x) => x.time.includes(`T${NOW_HHMM}`))!;
  const plan = TODAY_PLAN;
  const schedule = activitiesOn(ACTIVITIES, TODAY);
  const proposals = plan.items.filter((i) => i.status === "proposed");
  const onPlan = plan.items.filter((i) => i.status !== "proposed");

  return (
    <div className="flex flex-col gap-6">
      <header>
        <div className="text-sm text-ink-muted">{fmtWeekday(TODAY)}&apos;s outlook</div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span
            className={`text-5xl font-semibold tracking-tight ${dayScoreTone(plan.dayScore)}`}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {plan.dayScore}
          </span>
          <span className="text-sm text-ink-muted">day score / 100</span>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-2">
          {plan.summary}
        </p>
        {plan.supersededNote && (
          <p className="mt-2 text-xs text-ink-muted">{plan.supersededNote}</p>
        )}
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <ConditionTile label="UV index · now" value={String(now.uvIndex)} band={uvBand(now.uvIndex)} />
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
        <DayTimeline hours={TODAY_HOURLY} activities={schedule} nowTime={NOW_HHMM} />
      </Card>

      {proposals.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold tracking-tight">
            Waiting on you ({proposals.length})
          </h2>
          {proposals.map((item) => (
            <PlanItemCard key={item.id} item={item} />
          ))}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold tracking-tight">Today&apos;s plan</h2>
        {onPlan.map((item) => (
          <PlanItemCard key={item.id} item={item} />
        ))}
      </section>
    </div>
  );
}
