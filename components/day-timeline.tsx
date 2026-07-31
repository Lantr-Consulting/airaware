import type { Activity, HourlyConditions } from "@/lib/types";
import { aqiBand, heatBand, pollenBand, uvBand } from "@/lib/bands";
import { fmtTime } from "@/lib/format";

// Hourly band strips — one row per signal, colored by shared severity —
// with the day's activities laid over the same time axis. The colors come
// from the same band functions the engine uses; the timeline can't disagree
// with the checks.

const CELL_BG = ["bg-band-0", "bg-band-1", "bg-band-2", "bg-band-3", "bg-band-4"];

function toMin(hhmm: string): number {
  const [hh, mm] = hhmm.split(":").map(Number);
  return hh * 60 + mm;
}

export function DayTimeline({
  hours,
  activities,
}: {
  hours: HourlyConditions[];
  activities: { activity: Activity; start: string; end: string }[];
}) {
  const startMin = toMin(hours[0].time.slice(11, 16));
  const endMin = toMin(hours[hours.length - 1].time.slice(11, 16)) + 60;
  const span = endMin - startMin;

  const rows: { label: string; severities: (number | null)[] }[] = [
    { label: "UV", severities: hours.map((x) => uvBand(x.uvIndex).severity) },
    { label: "Heat", severities: hours.map((x) => heatBand(x.apparentF).severity) },
    { label: "Air", severities: hours.map((x) => aqiBand(x.usAqi).severity) },
    {
      label: "Pollen",
      severities: hours.map((x) =>
        x.pollen === null ? null : pollenBand(x.pollen.index).severity
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-3">
          <span className="w-12 shrink-0 text-right text-xs text-ink-muted">
            {row.label}
          </span>
          <div className="flex h-4 flex-1 gap-px overflow-hidden rounded-md">
            {row.severities.map((sev, i) => (
              <span
                key={i}
                title={`${fmtTime(hours[i].time.slice(11, 16))} — ${row.label}`}
                className={`flex-1 ${sev === null ? "bg-surface-2" : CELL_BG[sev]} ${
                  sev === null ? "" : "opacity-90"
                }`}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Activities on the same axis */}
      <div className="mt-1 flex items-center gap-3">
        <span className="w-12 shrink-0 text-right text-xs text-ink-muted">Plans</span>
        <div className="relative h-7 flex-1">
          {activities.map(({ activity, start, end }) => {
            const left = ((toMin(start) - startMin) / span) * 100;
            const width = ((toMin(end) - toMin(start)) / span) * 100;
            return (
              <span
                key={activity.id + start}
                title={`${activity.name}, ${fmtTime(start)}–${fmtTime(end)}`}
                className="absolute top-0 flex h-full items-center overflow-hidden whitespace-nowrap rounded-md border border-accent/40 bg-accent/15 px-2 text-[11px] font-medium text-accent"
                style={{ left: `${left}%`, width: `${Math.max(width, 4)}%` }}
              >
                {activity.name}
              </span>
            );
          })}
        </div>
      </div>

      {/* Hour ticks */}
      <div className="flex items-center gap-3">
        <span className="w-12 shrink-0" />
        <div className="flex flex-1 justify-between text-[10px] text-ink-muted">
          {hours
            .filter((_, i) => i % 3 === 0)
            .map((x) => (
              <span key={x.time}>{fmtTime(x.time.slice(11, 16))}</span>
            ))}
        </div>
      </div>
    </div>
  );
}

export function BandLegend() {
  const steps = [
    { label: "Clear", cls: "bg-band-0" },
    { label: "Easy", cls: "bg-band-1" },
    { label: "Caution", cls: "bg-band-2" },
    { label: "Avoid", cls: "bg-band-3" },
    { label: "Extreme", cls: "bg-band-4" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-muted">
      {steps.map((s) => (
        <span key={s.label} className="flex items-center gap-1.5">
          <span aria-hidden className={`inline-block size-2.5 rounded-sm ${s.cls}`} />
          {s.label}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="inline-block size-2.5 rounded-sm bg-surface-2" />
        No data
      </span>
    </div>
  );
}
