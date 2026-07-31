import type { ReactNode } from "react";
import type { PlanItemStatus, RuleCheck } from "@/lib/types";
import { SEVERITY_TEXT } from "@/lib/bands";
import type { BandInfo } from "@/lib/bands";

export function GuidanceBanner() {
  return (
    <div className="flex items-center gap-2 border-b border-hairline bg-page px-5 py-1.5 text-[11px] text-ink-muted">
      <span aria-hidden className="inline-block size-2 rounded-full bg-accent" />
      <span>
        <strong className="font-semibold text-ink">General guidance, not medical advice</strong>
        {" "}— AirAware translates public agency thresholds (WHO, EPA, NWS) into
        practical daily suggestions.
      </span>
    </div>
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
    <section className={`rounded-2xl bg-surface p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && (
            <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

// A signal reading: value + official band, colored by shared severity.
export function ConditionTile({
  label,
  value,
  unit,
  band,
  noCoverage,
}: {
  label: string;
  value: string;
  unit?: string;
  band?: BandInfo;
  noCoverage?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-surface p-4">
      <div className="text-xs text-ink-muted">{label}</div>
      <div
        className="mt-1 text-2xl font-semibold tracking-tight"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-ink-2">{unit}</span>}
      </div>
      {noCoverage ? (
        <div className="mt-0.5 text-xs text-ink-muted">No coverage here</div>
      ) : (
        band && (
          <div className={`mt-0.5 flex items-center gap-1.5 text-xs font-medium ${SEVERITY_TEXT[band.severity]}`}>
            <span aria-hidden className="inline-block size-2 rounded-full bg-current" />
            {band.band}
          </div>
        )
      )}
    </div>
  );
}

const STATUS_STYLES: Record<PlanItemStatus, { label: string; cls: string }> = {
  proposed: { label: "Awaiting your call", cls: "bg-accent/15 text-accent" },
  accepted: { label: "Accepted", cls: "bg-good/10 text-good" },
  declined: { label: "Declined", cls: "bg-ink/10 text-ink-2" },
  auto: { label: "On the plan", cls: "bg-ink/10 text-ink-2" },
};

export function StatusBadge({ status }: { status: PlanItemStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}
    >
      {s.label}
    </span>
  );
}

// The exposure engine's verdict lines, rendered exactly as persisted.
export function CheckList({ checks }: { checks: RuleCheck[] }) {
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
            <span className="sr-only">{c.pass ? " (clear)" : " (flagged)"}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
