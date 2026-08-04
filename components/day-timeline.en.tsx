import type { Activity, HourlyConditions } from "@/lib/types";
import { aqiBand, heatBand, pollenBand, uvBand } from "@/lib/bands";
import { fmtTime } from "@/lib/format";

// The day at a glance: a feels-like curve on top, one band strip per signal
// below it, and the day's activities on the same time axis. Colors come from
// the same band functions the engine uses; the timeline can't disagree with
// the checks.

const CELL_BG = ["bg-band-0", "bg-band-1", "bg-band-2", "bg-band-3", "bg-band-4"];

function toMin(hhmm: string): number {
  const [hh, mm] = hhmm.split(":").map(Number);
  return hh * 60 + mm;
}

function TempCurve({ hours }: { hours: HourlyConditions[] }) {
  const temps = hours.map((x) => x.apparentF);
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const pad = Math.max(2, (max - min) * 0.12);
  const y = (t: number) => 40 - ((t - (min - pad)) / (max - min + 2 * pad)) * 40;
  const x = (i: number) => (i / (temps.length - 1)) * 100;
  const line = temps.map((t, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(t)}`).join(" ");
  const peakIdx = temps.indexOf(max);

  return (
    <div className="relative h-14 w-full">
      <svg
        aria-hidden
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        className="h-full w-full"
      >
        <defs>
          <linearGradient id="tempfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${line} L100,40 L0,40 Z`} fill="url(#tempfill)" />
        <path
          d={line}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        className="absolute -top-1 text-[10px] font-medium text-ink-2"
        style={{ left: `min(${(peakIdx / (temps.length - 1)) * 100}%, 88%)` }}
      >
        peak {max}°
      </span>
    </div>
  );
}

export function DayTimeline({
  hours,
  activities,
  nowTime,
}: {
  hours: HourlyConditions[];
  activities: { activity: Activity; start: string; end: string }[];
  nowTime?: string;
}) {
  const startMin = toMin(hours[0].time.slice(11, 16));
  const endMin = toMin(hours[hours.length - 1].time.slice(11, 16)) + 60;
  const span = endMin - startMin;
  const nowPct =
    nowTime === undefined ? null : ((toMin(nowTime) - startMin) / span) * 100;

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
      <div className="flex gap-3">
        {/* Label gutter — heights mirror the content column exactly */}
        <div className="flex w-12 shrink-0 flex-col gap-1.5 text-right text-xs text-ink-muted">
          <span className="flex h-14 items-end justify-end pb-0.5">Feels</span>
          {rows.map((r) => (
            <span key={r.label} className="flex h-4 items-center justify-end">
              {r.label}
            </span>
          ))}
          <span className="mt-1 flex h-7 items-center justify-end">Plans</span>
        </div>

        {/* Content column shares one axis; the now-marker crosses all of it */}
        <div className="relative flex min-w-0 flex-1 flex-col gap-1.5">
          <TempCurve hours={hours} />

          {rows.map((row) => (
            <div key={row.label} className="flex h-4 gap-px overflow-hidden rounded-md">
              {row.severities.map((sev, i) => (
                <span
                  key={i}
                  title={`${fmtTime(hours[i].time.slice(11, 16))} — ${row.label}`}
                  className={`flex-1 ${
                    sev === null ? "bg-surface-2" : `${CELL_BG[sev]} opacity-90`
                  }`}
                />
              ))}
            </div>
          ))}

          <div className="relative mt-1 h-7">
            {activities.map(({ activity, start, end }) => {
              const left = ((toMin(start) - startMin) / span) * 100;
              const width = ((toMin(end) - toMin(start)) / span) * 100;
              return (
                <span
                  key={activity.id + start}
                  title={`${activity.name}, ${fmtTime(start)}–${fmtTime(end)}`}
                  className="absolute top-0 flex h-full items-center rounded-md border border-accent/40 bg-accent/15 px-1.5 text-[11px] font-medium text-accent"
                  style={{ left: `${left}%`, width: `${Math.max(width, 4)}%` }}
                >
                  <span className="truncate">{activity.name}</span>
                </span>
              );
            })}
          </div>

          {nowPct !== null && nowPct >= 0 && nowPct <= 100 && (
            <span
              aria-hidden
              title="Now"
              className="pointer-events-none absolute inset-y-0 z-10 border-l border-dashed border-ink/50"
              style={{ left: `${nowPct}%` }}
            />
          )}
        </div>
      </div>

      {/* Hour ticks */}
      <div className="flex gap-3">
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
