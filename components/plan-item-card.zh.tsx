"use client";

import { useState, type ReactNode } from "react";
import type { PlanItem, PlanItemKind, PlanItemStatus } from "@/lib/types";
import { CheckList, StatusBadge } from "./ui";
import { fmtTempF, fmtWindow } from "@/lib/format";

// Short signal names for the check chips; full sentences stay in the receipt.
const RULE_LABEL: Record<string, string> = {
  uv_band: "紫外线",
  heat_index: "体感",
  aqi_intensity: "AQI",
  pollen_band: "花粉",
  window: "时段",
};

const KIND_LABEL: Record<PlanItemKind, string> = {
  keep: "按原计划",
  shift: "调整时间",
  shorten: "缩短时长",
  relocate: "更换路线",
  indoor: "改到室内",
  gear: "装备提醒",
  good_window: "适合外出",
  warning: "风险提醒",
};

const SEVERITY_EDGE: Record<PlanItem["severity"], string> = {
  info: "border-l-hairline",
  caution: "border-l-band-2",
  alert: "border-l-band-3",
  great: "border-l-band-0",
};

const SEVERITY_MEDALLION: Record<PlanItem["severity"], string> = {
  info: "bg-accent/12 text-accent",
  caution: "bg-band-2/15 text-band-2",
  alert: "bg-band-3/15 text-band-3",
  great: "bg-band-0/15 text-band-0",
};

// One stroke icon per kind. The card is recognizable before it is read.
const KIND_ICON: Record<PlanItemKind, ReactNode> = {
  keep: <><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 5-5" /></>,
  shift: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" /></>,
  shorten: <><circle cx="12" cy="13" r="8" /><path d="M12 9.5V13l2.5 1.5M9.5 2.5h5" /></>,
  relocate: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  indoor: <><path d="m4 11 8-7 8 7" /><path d="M6 9.5V20h12V9.5" /></>,
  gear: <><path d="M7 8h10l-1 12H8L7 8Z" /><path d="M9.5 8a2.5 2.5 0 0 1 5 0" /></>,
  good_window: <><circle cx="12" cy="12" r="4.5" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" /></>,
  warning: <><path d="M12 4 21 20H3L12 4Z" /><path d="M12 10.5v4M12 17.2v.3" /></>,
};

// With handlers (live mode) the parent owns state and the server re-checks
// at accept time; without them (sample mode) the card just plays along
// locally. onAccept resolves to a blocked-message or null.
export function PlanItemCard({
  item,
  onAccept,
  onDecline,
}: {
  item: PlanItem;
  onAccept?: (item: PlanItem) => Promise<string | null>;
  onDecline?: (item: PlanItem, reason: string) => Promise<void>;
}) {
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null);
  // Sample mode (no handlers) keeps its own state; live mode trusts the
  // item the parent got back from the server.
  const [localStatus, setLocalStatus] = useState<PlanItemStatus | null>(null);
  const [localReason, setLocalReason] = useState<string | null>(null);

  const isLive = Boolean(onAccept || onDecline);
  const status = isLive ? item.status : (localStatus ?? item.status);
  const savedReason = isLive
    ? (item.feedback?.reason ?? "")
    : (localReason ?? item.feedback?.reason ?? "");

  async function accept() {
    if (!onAccept) {
      setLocalStatus("accepted");
      return;
    }
    setPending(true);
    setBlockedMsg(null);
    try {
      setBlockedMsg(await onAccept(item));
    } catch {
      setBlockedMsg("暂时无法连接服务，计划没有发生变化。 ");
    } finally {
      setPending(false);
    }
  }

  async function decline() {
    const r = reason.trim();
    if (!onDecline) {
      setLocalStatus("declined");
      setLocalReason(r);
      setDeclining(false);
      return;
    }
    setPending(true);
    try {
      await onDecline(item, r);
      setDeclining(false);
    } catch {
      setBlockedMsg("暂时无法连接服务，计划没有发生变化。 ");
    } finally {
      setPending(false);
    }
  }

  return (
    <article
      className={`pane border-l-2 p-5 ${SEVERITY_EDGE[item.severity]}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          {KIND_LABEL[item.kind]}
        </span>
        <StatusBadge status={status} />
      </div>

      <div className="mt-2.5 flex items-center gap-3">
        <span
          aria-hidden
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${SEVERITY_MEDALLION[item.severity]}`}
        >
          <svg
            viewBox="0 0 24 24"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {KIND_ICON[item.kind]}
          </svg>
        </span>
        <h3 className="text-lg font-semibold tracking-tight">{item.title}</h3>
      </div>

      {(item.window || item.originalWindow) && (
        <div
          className="mt-3 flex flex-wrap items-center gap-2"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {item.originalWindow && (
            <>
              <span className="rounded-full border border-hairline px-3 py-1 text-sm text-ink-muted line-through">
                {fmtWindow(item.originalWindow)}
              </span>
              <span aria-hidden className="text-ink-muted">→</span>
            </>
          )}
          {item.window && (
            <span className="rounded-full border border-accent/40 bg-accent/15 px-3 py-1 text-sm font-semibold text-accent">
              {fmtWindow(item.window)}
            </span>
          )}
        </div>
      )}

      <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{item.rationale}</p>

      {/* The engine's verdict as data, not prose: one chip per signal,
          value included; the full sentences live behind the receipt. */}
      {item.checks.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {item.checks.map((c, i) => (
              <span
                key={`${c.rule}-${i}`}
                title={c.detail}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
                  c.pass
                    ? "border-good/25 bg-good/10 text-good"
                    : "border-critical/30 bg-critical/10 text-critical"
                }`}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                <span aria-hidden className="size-1.5 rounded-full bg-current" />
                {RULE_LABEL[c.rule] ?? c.rule}
                {c.value != null && (
                  <span className="font-semibold">
                    {c.rule === "heat_index" ? fmtTempF(c.value) : c.value}
                  </span>
                )}
              </span>
            ))}
          </div>
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs text-ink-muted transition-colors hover:text-ink [&::-webkit-details-marker]:hidden">
              查看完整检查明细
              <span aria-hidden className="text-[10px] transition-transform group-open:rotate-90">▸</span>
            </summary>
            <div className="mt-2">
              <CheckList checks={item.checks} />
            </div>
          </details>
        </div>
      )}

      {blockedMsg && (
        <p className="mt-3 rounded-lg bg-band-3/10 px-3 py-2 text-xs text-band-3">
          {blockedMsg}
        </p>
      )}

      {savedReason && (
        <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-2">
          <span className="font-semibold text-ink">你的原因：</span> {savedReason}
          <span className="ml-1 text-ink-muted">· 之后的安排会参考这条反馈。</span>
        </p>
      )}

      {status === "proposed" && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={accept}
            disabled={pending}
            className="btn-primary px-4 py-1.5 text-sm"
          >
            {pending && !declining ? "正在复核…" : "接受调整"}
          </button>
          {!declining ? (
            <button
              onClick={() => setDeclining(true)}
              disabled={pending}
              className="btn-ghost px-4 py-1.5 text-sm"
            >
              不采用
            </button>
          ) : (
            <span className="flex flex-1 items-center gap-2">
              <input
                autoFocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="可以说明原因，帮助后续安排更合适"
                className="min-w-40 flex-1 rounded-full border border-hairline bg-page px-3 py-1.5 text-sm placeholder:text-ink-muted"
              />
              <button
                onClick={decline}
                disabled={reason.trim() === "" || pending}
                className="btn-ghost px-4 py-1.5 text-sm disabled:opacity-45"
              >
                {pending ? "…" : "提交"}
              </button>
            </span>
          )}
        </div>
      )}
    </article>
  );
}
