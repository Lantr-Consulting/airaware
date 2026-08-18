"use client";

import type { CSSProperties, ReactNode } from "react";
import type { PlanItemStatus, RuleCheck } from "@/lib/types";
import { SEVERITY_TEXT } from "@/lib/bands";
import type { BandInfo } from "@/lib/bands";
import { pick, useLanguage } from "@/lib/language";

// The permanent "not medical advice" label (see DESIGN.md §1/§6). Lives as
// a quiet footer at the end of every screen's scroll, not a banner.
export function GuidanceBanner() {
  const language = useLanguage();
  return (
    <p className="mt-auto pt-12 pb-2 text-center text-xs text-ink-muted">
      {pick(language, "仅供日常参考，不替代医疗建议 · 依据 WHO、EPA 与 NWS 公开标准", "Everyday guidance, not medical advice · based on public WHO, EPA, and NWS standards")}
    </p>
  );
}

export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`pane p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && (
            <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

// A signal reading: value + official band, colored by shared severity.
const TILE_ICON: Record<string, ReactNode> = {
  uv: <><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" /></>,
  heat: <><path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0Z" /></>,
  air: <><path d="M3 8h9a3 3 0 1 0-3-4" /><path d="M3 14h13a3 3 0 1 1-3 4" /><path d="M3 11h5" /></>,
  pollen: <><circle cx="12" cy="12" r="2.5" /><path d="M12 4.5v3M12 16.5v3M4.5 12h3M16.5 12h3M6.7 6.7l2.1 2.1M15.2 15.2l2.1 2.1M17.3 6.7l-2.1 2.1M8.8 15.2l-2.1 2.1" /></>,
};

// A stat tile in the dashboard voice: soft icon chip, plain-language label,
// a big clean number, the band, and the day's shape as a sparkline.
export function ConditionTile({
  label,
  value,
  unit,
  band,
  noCoverage,
  trend,
  kind,
}: {
  label: string;
  value: string;
  unit?: string;
  band?: BandInfo;
  noCoverage?: boolean;
  trend?: number[];
  kind?: "uv" | "heat" | "air" | "pollen";
}) {
  const language = useLanguage();
  const tile = band && !noCoverage ? `var(--band-${band.severity})` : undefined;
  return (
    <div
      className="tile-aura p-4"
      style={tile ? ({ "--tile": tile } as CSSProperties) : undefined}
    >
      <div className="flex items-center gap-2.5">
        {kind && (
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-lg"
            style={{
              background: "color-mix(in oklab, var(--tile) 12%, transparent)",
              color: "var(--tile)",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {TILE_ICON[kind]}
            </svg>
          </span>
        )}
        <span className="text-[13px] font-medium text-ink-2">{label}</span>
      </div>
      <div className="num-display mt-3 text-3xl leading-none">
        {value}
        {unit && (
          <span className="ml-1 align-baseline font-sans text-sm font-normal tracking-normal text-ink-2">
            {unit}
          </span>
        )}
      </div>
      {noCoverage ? (
        <div className="mt-2.5 text-xs text-ink-muted">{pick(language, "该地区暂无数据", "No coverage in this area")}</div>
      ) : (
        band && (
          <div className={`mt-2.5 flex items-center gap-1.5 text-xs font-medium ${SEVERITY_TEXT[band.severity]}`}>
            <span
              aria-hidden
              className="inline-block size-1.5 rounded-full bg-current shadow-[0_0_8px_currentColor]"
            />
            {band.band}
          </div>
        )
      )}
      {trend && trend.length > 1 && <Sparkline values={trend} />}
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max((max - min) * 0.15, 0.5);
  const y = (v: number) => 26 - ((v - (min - pad)) / (max - min + 2 * pad)) * 24;
  const x = (i: number) => (i / (values.length - 1)) * 100;
  const line = values
    .map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(" ");
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 28"
      preserveAspectRatio="none"
      className="mt-3 h-8 w-full"
    >
      <path d={`${line} L100,28 L0,28 Z`} fill="var(--tile)" opacity="0.14" />
      <path
        d={line}
        fill="none"
        stroke="var(--tile)"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
        opacity="0.9"
      />
    </svg>
  );
}

const STATUS_STYLES: Record<PlanItemStatus, { zh: string; en: string; cls: string }> = {
  proposed: { zh: "待你确认", en: "Your review", cls: "bg-accent/15 text-accent" },
  accepted: { zh: "已接受", en: "Accepted", cls: "bg-good/10 text-good" },
  declined: { zh: "已拒绝", en: "Declined", cls: "bg-ink/10 text-ink-2" },
  auto: { zh: "已纳入计划", en: "In plan", cls: "bg-ink/10 text-ink-2" },
};

export function StatusBadge({ status }: { status: PlanItemStatus }) {
  const language = useLanguage();
  const s = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}
    >
      {s[language]}
    </span>
  );
}

// The exposure engine's verdict lines, rendered exactly as persisted.
export function CheckList({ checks }: { checks: RuleCheck[] }) {
  const language = useLanguage();
  if (checks.length === 0) return null;
  return (
    <ul className="grid gap-x-6 gap-y-1.5">
      {checks.map((c, i) => (
        <li key={`${c.rule}-${i}`} className="flex items-start gap-2 text-sm">
          <span
            aria-hidden
            className={`mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-page ${
              c.pass ? "bg-good" : "bg-critical"
            }`}
          >
            {c.pass ? "✓" : "!"}
          </span>
          <span>
            <span className="text-ink-2">{c.detail}</span>
            <span className="ml-1.5 text-xs text-ink-muted">({c.thresholdSource})</span>
            <span className="sr-only">{c.pass ? pick(language, "（通过）", "(passed)") : pick(language, "（需注意）", "(needs attention)")}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}


// The day-score gauge: a clean ring. Quiet track, one colored arc, the
// number in the display face. No glow, no dial theatrics.
export function ScoreRing({
  score,
  color,
  track = "var(--surface-2)",
}: {
  score: number;
  color: string;
  track?: string;
}) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-36 shrink-0">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke={track} strokeWidth="9" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${(c * Math.max(2, score)) / 100} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="num-display text-4xl leading-none">{score}</span>
        <span className="mt-1 text-[11px] opacity-60">/ 100</span>
      </div>
    </div>
  );
}
