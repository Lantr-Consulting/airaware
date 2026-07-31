import { Card } from "@/components/ui";
import { aqiBand, heatBand, pollenBand, uvBand, SEVERITY_TEXT } from "@/lib/bands";
import { fmtDate, fmtTime } from "@/lib/format";
import { ACTIVITIES, PLANS, TODAY, WEEK } from "@/lib/mock";
import { activitiesOn } from "@/lib/schedule";
import type { BandInfo } from "@/lib/bands";

function Chip({ label, value, band }: { label: string; value: string; band: BandInfo | null }) {
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span className="text-ink-muted">{label}</span>
      {band === null ? (
        <span className="text-ink-muted">—</span>
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
  active: { label: "Plan active", cls: "bg-good/10 text-good" },
  draft: { label: "Draft plan", cls: "bg-accent/15 text-accent" },
  superseded: { label: "Superseded", cls: "bg-white/10 text-ink-2" },
};

export default function PlannerPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">The week ahead</h1>
        <p className="mt-1 text-sm text-ink-2">
          Your activities against the 7-day forecast. Plans firm up as each day
          gets close; earlier advice updates when the forecast moves.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {WEEK.map((day) => {
          const schedule = activitiesOn(ACTIVITIES, day.date);
          const plan = PLANS.find((p) => p.date === day.date && p.status !== "superseded");
          const proposals = plan?.items.filter((i) => i.status === "proposed").length ?? 0;
          const isToday = day.date === TODAY;
          return (
            <Card key={day.date} className={isToday ? "ring-1 ring-accent/40" : ""}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold tracking-tight">
                  {fmtDate(day.date)}
                  {isToday && <span className="ml-2 text-xs font-medium text-accent">Today</span>}
                </div>
                {plan && (
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${PLAN_STATUS[plan.status].cls}`}
                  >
                    {PLAN_STATUS[plan.status].label}
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                <Chip label="UV" value={String(day.uvMax)} band={uvBand(day.uvMax)} />
                <Chip label="Feels" value={`${day.apparentMaxF}°`} band={heatBand(day.apparentMaxF)} />
                <Chip label="AQI" value={String(day.aqiMax)} band={aqiBand(day.aqiMax)} />
                <Chip
                  label="Pollen"
                  value={day.pollen ? day.pollen.index.toFixed(1) : "—"}
                  band={day.pollen ? pollenBand(day.pollen.index) : null}
                />
              </div>

              <ul className="mt-4 flex flex-col gap-1.5 border-t border-hairline pt-3 text-sm">
                {schedule.length === 0 && (
                  <li className="text-ink-muted">Nothing scheduled.</li>
                )}
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
                <div className="mt-3 text-xs font-medium text-accent">
                  {proposals} proposal{proposals > 1 ? "s" : ""} waiting on you
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
