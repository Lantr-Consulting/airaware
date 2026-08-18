"use client";

import { useRef, useState } from "react";
import type { Activity, HourlyConditions } from "@/lib/types";
import { aqiBand, heatBand, pollenBand, uvBand } from "@/lib/bands";
import { fmtTempF, fmtTime } from "@/lib/format";

// The decision view: a smooth "comfort curve". The day's outdoor quality as
// a silhouette, filled with the band-color gradient. Plans on the same
// axis, the best clear window called out, and a continuous crosshair that
// interpolates the numbers at any minute (no hour-block snapping).

const BAND_VAR = [
  "var(--band-0)",
  "var(--band-1)",
  "var(--band-2)",
  "var(--band-3)",
  "var(--band-4)",
];

function toMin(hhmm: string): number {
  const [hh, mm] = hhmm.split(":").map(Number);
  return hh * 60 + mm;
}

function fmtMinutes(total: number): string {
  const hh = Math.floor(total / 60) % 24;
  const mm = Math.round(total % 60);
  return fmtTime(`${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
}

// Catmull-Rom → cubic bezier, so the curve passes smoothly through every hour.
function smoothPath(pts: [number, number][]): string {
  let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return d;
}

function lerp(values: number[], pos: number): number {
  const i = Math.min(values.length - 2, Math.max(0, Math.floor(pos)));
  const f = Math.min(1, Math.max(0, pos - i));
  return values[i] * (1 - f) + values[i + 1] * f;
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
  const [hoverT, setHoverT] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const n = hours.length;
  const severities = hours.map((h) =>
    Math.max(
      uvBand(h.uvIndex).severity,
      heatBand(h.apparentF).severity,
      aqiBand(h.usAqi).severity,
      h.pollen ? pollenBand(h.pollen.index).severity : 0
    )
  );
  // Comfort: the average band burden across signals, inverted. The curve's
  // shape. Color still follows the WORST band (the honest risk signal).
  const comfort = hours.map((h) => {
    const sevs = [
      uvBand(h.uvIndex).severity,
      heatBand(h.apparentF).severity,
      aqiBand(h.usAqi).severity,
      ...(h.pollen ? [pollenBand(h.pollen.index).severity] : []),
    ];
    return 1 - sevs.reduce((a: number, b) => a + b, 0) / (sevs.length * 4);
  });

  // Normalize to the day's own range: the question is "when is best TODAY",
  // so the silhouette uses relative comfort, amplified to fill the chart.
  const lo = Math.min(...comfort);
  const hi = Math.max(...comfort);
  const X = (i: number) => (i / (n - 1)) * 100;
  const Y = (c: number) => {
    const t = hi - lo < 0.04 ? 0.5 : (c - lo) / (hi - lo);
    return 36 - (0.08 + t * 0.84) * 32;
  };
  const pts: [number, number][] = comfort.map((c, i) => [X(i), Y(c)]);
  const curve = smoothPath(pts);
  const area = `${curve} L100,40 L0,40 Z`;
  const stops = severities.map((sev, i) => ({ off: (i / (n - 1)) * 100, color: BAND_VAR[sev] }));

  // Longest clear-or-easy run = the day's best window.
  let best = { start: 0, end: 0 };
  let runStart: number | null = null;
  for (let i = 0; i <= n; i++) {
    if (i < n && severities[i] <= 1) {
      if (runStart === null) runStart = i;
    } else if (runStart !== null) {
      if (i - runStart > best.end - best.start) best = { start: runStart, end: i };
      runStart = null;
    }
  }
  const hasBest = best.end - best.start >= 2;

  const startMin = toMin(hours[0].time.slice(11, 16));
  const endMin = toMin(hours[n - 1].time.slice(11, 16)) + 60;
  const span = endMin - startMin;
  const nowPct =
    nowTime === undefined ? null : ((toMin(nowTime) - startMin) / span) * 100;

  function onMove(e: React.MouseEvent) {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHoverT(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)));
  }

  // Interpolated readings at the cursor. Continuous, not hour blocks.
  const pos = hoverT === null ? null : hoverT * (n - 1);
  const hover =
    pos === null
      ? null
      : {
          time: fmtMinutes(startMin + hoverT! * (span - 60)),
          uv: Math.round(lerp(hours.map((h) => h.uvIndex), pos)),
          feelsF: lerp(hours.map((h) => h.apparentF), pos),
          aqi: Math.round(lerp(hours.map((h) => h.usAqi), pos)),
          pollen: hours.every((h) => h.pollen)
            ? lerp(hours.map((h) => h.pollen!.index), pos)
            : null,
          y: Y(lerp(comfort, pos)),
        };
  const hoverRows = hover
    ? [
        { label: "UV", value: String(hover.uv), band: uvBand(hover.uv) },
        { label: "Feels", value: fmtTempF(hover.feelsF), band: heatBand(hover.feelsF) },
        { label: "AQI", value: String(hover.aqi), band: aqiBand(hover.aqi) },
        {
          label: "Pollen",
          value: hover.pollen === null ? "–" : hover.pollen.toFixed(1),
          band: hover.pollen === null ? null : pollenBand(hover.pollen),
        },
      ]
    : [];

  return (
    <div>
      <div
        ref={trackRef}
        className="relative"
        onMouseMove={onMove}
        onMouseLeave={() => setHoverT(null)}
      >
        {/* Plans on the same axis as the curve */}
        <div className="relative h-9">
          {activities.map(({ activity, start, end }) => {
            const left = ((toMin(start) - startMin) / span) * 100;
            const width = ((toMin(end) - toMin(start)) / span) * 100;
            return (
              <span
                key={activity.id + start}
                title={`${activity.name}, ${fmtTime(start)}–${fmtTime(end)}`}
                className="absolute top-1 flex h-7 items-center rounded-full border border-accent/40 bg-accent/10 px-2.5 text-[11px] font-medium text-accent"
                style={{ left: `min(${left}%, 92%)`, width: `${Math.max(width, 8)}%` }}
              >
                <span className="truncate">{activity.name}</span>
              </span>
            );
          })}
        </div>

        {/* The comfort curve. Higher is better; color = worst band */}
        <div className="relative mt-1 h-32">
          <svg
            viewBox="0 0 100 40"
            preserveAspectRatio="none"
            className="size-full"
            aria-hidden
          >
            <defs>
              <linearGradient id="dayband" x1="0" y1="0" x2="1" y2="0">
                {stops.map((s, i) => (
                  <stop key={i} offset={`${s.off}%`} stopColor={s.color} />
                ))}
              </linearGradient>
              <linearGradient id="dayfade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fff" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#fff" stopOpacity="0.75" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#dayband)" opacity="0.38" />
            <path d={area} fill="url(#dayfade)" />
            <path
              d={curve}
              fill="none"
              stroke="url(#dayband)"
              strokeWidth="2.25"
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
            />
          </svg>
          {/* scrubber dot riding the curve */}
          {hover && hoverT !== null && (
            <span
              aria-hidden
              className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-ink shadow-md"
              style={{ left: `${hoverT * 100}%`, top: `${(hover.y / 40) * 100}%` }}
            />
          )}
        </div>

        {/* Best clear window */}
        <div className="relative mt-1.5 h-6">
          {hasBest && (
            <span
              className="absolute top-0 flex flex-col gap-1"
              style={{
                left: `${(best.start / (n - 1)) * 100}%`,
                width: `${((best.end - 1 - best.start) / (n - 1)) * 100}%`,
              }}
            >
              <span className="h-1 w-full rounded-full bg-band-0" />
              <span className="whitespace-nowrap text-[11px] font-medium text-band-0">
                Best window {fmtTime(hours[best.start].time.slice(11, 16))}–
                {fmtTime(hours[best.end - 1].time.slice(11, 16))}
              </span>
            </span>
          )}
        </div>

        {/* Now marker */}
        {nowPct !== null && nowPct >= 0 && nowPct <= 100 && hoverT === null && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 z-10 border-l border-dashed border-ink/30"
            style={{ left: `${nowPct}%` }}
          />
        )}

        {/* Continuous crosshair + tooltip */}
        {hover && hoverT !== null && (
          <>
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 z-10 border-l border-ink/25"
              style={{ left: `${hoverT * 100}%` }}
            />
            <div
              className="pane pointer-events-none absolute -top-2 z-20 w-44 -translate-x-1/2 -translate-y-full p-3"
              style={{ left: `clamp(6rem, ${hoverT * 100}%, calc(100% - 6rem))` }}
            >
              <div
                className="text-xs font-semibold text-ink"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {hover.time}
              </div>
              <div className="mt-1.5 flex flex-col gap-1">
                {hoverRows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between gap-2 text-xs"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    <span className="flex items-center gap-1.5 text-ink-muted">
                      <span
                        aria-hidden
                        className="inline-block size-1.5 rounded-full"
                        style={{
                          background:
                            row.band === null
                              ? "var(--surface-2)"
                              : BAND_VAR[row.band.severity],
                        }}
                      />
                      {row.label}
                    </span>
                    <span className="font-semibold text-ink-2">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Hour ticks */}
      <div
        className="mt-1 flex justify-between text-[10px] text-ink-muted"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {hours
          .filter((_, i) => i % 3 === 0)
          .map((x) => (
            <span key={x.time}>{fmtTime(x.time.slice(11, 16))}</span>
          ))}
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
          <span aria-hidden className={`inline-block size-2.5 rounded-full ${s.cls}`} />
          {s.label}
        </span>
      ))}
    </div>
  );
}
