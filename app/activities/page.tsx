import { Card } from "@/components/ui";
import { fmtDays, fmtTime } from "@/lib/format";
import { ACTIVITIES } from "@/lib/mock";
import type { ActivityKind, Flexibility } from "@/lib/types";

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

export default function ActivitiesPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Activities</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-2">
            The recurring shape of your week. Flexibility is what gives the
            planner room to work: a movable run gets better windows; a fixed
            practice gets warnings and gear instead.
          </p>
        </div>
        <button className="btn-primary px-4 py-2 text-sm">Add activity</button>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {ACTIVITIES.map((a) => (
          <Card key={a.id}>
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
