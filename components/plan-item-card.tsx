"use client";

import { useState } from "react";
import type { PlanItem, PlanItemKind, PlanItemStatus } from "@/lib/types";
import { CheckList, StatusBadge } from "./ui";
import { fmtWindow } from "@/lib/format";

const KIND_LABEL: Record<PlanItemKind, string> = {
  keep: "On the plan",
  shift: "Move it",
  shorten: "Shorten it",
  relocate: "Change route",
  indoor: "Take it inside",
  gear: "Bring gear",
  good_window: "Great window",
  warning: "Heads-up",
};

const SEVERITY_EDGE: Record<PlanItem["severity"], string> = {
  info: "border-l-hairline",
  caution: "border-l-band-2",
  alert: "border-l-band-3",
  great: "border-l-band-0",
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
      setBlockedMsg("Couldn't reach the backend — nothing changed.");
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
      setBlockedMsg("Couldn't reach the backend — nothing changed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <article
      className={`rounded-2xl border-l-2 bg-surface p-5 ${SEVERITY_EDGE[item.severity]}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          {KIND_LABEL[item.kind]}
        </span>
        <StatusBadge status={status} />
      </div>

      <h3 className="mt-1.5 text-[15px] font-semibold tracking-tight">
        {item.title}
      </h3>

      {(item.window || item.originalWindow) && (
        <div className="mt-1 text-sm text-ink-2" style={{ fontVariantNumeric: "tabular-nums" }}>
          {item.originalWindow && (
            <>
              <span className="text-ink-muted line-through">
                {fmtWindow(item.originalWindow)}
              </span>
              <span className="mx-1.5 text-ink-muted">→</span>
            </>
          )}
          {item.window && <span className="font-medium text-ink">{fmtWindow(item.window)}</span>}
        </div>
      )}

      <p className="mt-2 text-sm leading-relaxed text-ink-2">{item.rationale}</p>

      <div className="mt-3">
        <CheckList checks={item.checks} />
      </div>

      {blockedMsg && (
        <p className="mt-3 rounded-lg bg-band-3/10 px-3 py-2 text-xs text-band-3">
          {blockedMsg}
        </p>
      )}

      {savedReason && (
        <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-2">
          <span className="font-semibold text-ink">Your reason:</span> {savedReason}
          <span className="ml-1 text-ink-muted">— the planner learns from this.</span>
        </p>
      )}

      {status === "proposed" && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={accept}
            disabled={pending}
            className="btn-primary px-4 py-1.5 text-sm"
          >
            {pending && !declining ? "Checking…" : "Accept"}
          </button>
          {!declining ? (
            <button
              onClick={() => setDeclining(true)}
              disabled={pending}
              className="btn-ghost px-4 py-1.5 text-sm"
            >
              Decline
            </button>
          ) : (
            <span className="flex flex-1 items-center gap-2">
              <input
                autoFocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why not? The planner learns from this."
                className="min-w-40 flex-1 rounded-full border border-hairline bg-page px-3 py-1.5 text-sm placeholder:text-ink-muted"
              />
              <button
                onClick={decline}
                disabled={reason.trim() === "" || pending}
                className="btn-ghost px-4 py-1.5 text-sm disabled:opacity-45"
              >
                {pending ? "…" : "Send"}
              </button>
            </span>
          )}
        </div>
      )}
    </article>
  );
}
