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

// Milestone 1: accept/decline update local state only, so the interaction
// reads correctly before the backend exists. Milestone 4 wires them to
// /plan-items/{id}/accept and /decline.
export function PlanItemCard({ item }: { item: PlanItem }) {
  const [status, setStatus] = useState<PlanItemStatus>(item.status);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [savedReason, setSavedReason] = useState(item.feedback?.reason ?? "");

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

      {savedReason && (
        <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-2">
          <span className="font-semibold text-ink">Your reason:</span> {savedReason}
          <span className="ml-1 text-ink-muted">— the planner learns from this.</span>
        </p>
      )}

      {status === "proposed" && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setStatus("accepted")}
            className="btn-primary px-4 py-1.5 text-sm"
          >
            Accept
          </button>
          {!declining ? (
            <button
              onClick={() => setDeclining(true)}
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
                onClick={() => {
                  setStatus("declined");
                  setSavedReason(reason.trim());
                  setDeclining(false);
                }}
                disabled={reason.trim() === ""}
                className="btn-ghost px-4 py-1.5 text-sm disabled:opacity-45"
              >
                Send
              </button>
            </span>
          )}
        </div>
      )}
    </article>
  );
}
