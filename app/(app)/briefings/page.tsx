"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { useToast } from "@/components/toast";
import {
  createBriefing,
  deleteBriefing,
  getBriefings,
  runBriefing,
  updateBriefing,
} from "@/lib/api";
import { BRIEFINGS } from "@/lib/mock";
import { fmtDate } from "@/lib/format";
import { useMe } from "@/lib/use-me";
import type { Briefing, BriefingCadence, Signal } from "@/lib/types";

function cadenceLabel(b: Briefing): string {
  const hour = `${String(b.hourLocal ?? 7).padStart(2, "0")}:00`;
  switch (b.cadence) {
    case "daily":
      return `每天 · ${hour}`;
    case "weekly":
      return `每周五 · ${hour}`;
    case "on_change":
      return "条件变化时";
    default:
      return "仅手动";
  }
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className={`relative h-6 w-11 rounded-full transition-colors ${
        on ? "bg-accent" : "bg-surface-2"
      }`}
    >
      <span
        className={`absolute top-0.5 size-5 rounded-full bg-page transition-all ${
          on ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

const SIGNALS: { value: Signal; label: string }[] = [
  { value: "aqi", label: "空气质量" },
  { value: "uv", label: "UV" },
  { value: "heat", label: "体感温度" },
  { value: "pollen", label: "花粉" },
];
const SEVERITIES = ["适宜", "尚可", "注意", "避免", "极端"];

const EMPTY_FORM = {
  title: "",
  prompt: "",
  cadence: "daily" as BriefingCadence,
  hourLocal: 7,
  signal: "aqi" as Signal,
  severity: 2,
};

export default function BriefingsPage() {
  const toast = useToast();
  const { me, loading } = useMe();
  const [items, setItems] = useState<Briefing[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  // sample-mode toggle state
  const [sampleEnabled, setSampleEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(BRIEFINGS.map((b) => [b.id, b.enabled]))
  );

  const live = me !== null;
  const signedOut = !loading && me === null;

  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    getBriefings()
      .then((b) => !cancelled && setItems(b))
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [me]);

  const shown: Briefing[] = live ? (items ?? []) : BRIEFINGS;

  async function add() {
    if (!form.title.trim() || !form.prompt.trim() || busy) return;
    setBusy(true);
    try {
      const created = await createBriefing({
        title: form.title.trim(),
        prompt: form.prompt.trim(),
        cadence: form.cadence,
        hourLocal: form.hourLocal,
        trigger: form.cadence === "on_change" ? { signal: form.signal, severity: form.severity } : null,
      });
      setItems((xs) => [...(xs ?? []), { ...created, pastRuns: [] }]);
      setForm(EMPTY_FORM);
      setAdding(false);
      toast("success", `“${created.title}”已启用，调度器会在一分钟内接手。`);
    } catch {
      toast("error", "暂时无法保存简报。 ");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(b: Briefing) {
    if (!live) {
      setSampleEnabled((e) => ({ ...e, [b.id]: !e[b.id] }));
      return;
    }
    setItems((xs) => xs?.map((x) => (x.id === b.id ? { ...x, enabled: !b.enabled } : x)) ?? null);
    try {
      await updateBriefing(b.id, { enabled: !b.enabled });
    } catch {
      setItems((xs) => xs?.map((x) => (x.id === b.id ? { ...x, enabled: b.enabled } : x)) ?? null);
    }
  }

  async function remove(b: Briefing) {
    if (!live) return;
    const prev = items;
    setItems((xs) => xs?.filter((x) => x.id !== b.id) ?? null);
    try {
      await deleteBriefing(b.id);
      toast("info", `“${b.title}”已删除。`);
    } catch {
      setItems(prev);
      toast("error", "暂时无法删除，简报已恢复。 ");
    }
  }

  async function runNow(b: Briefing) {
    if (!live || runningId) return;
    setRunningId(b.id);
    try {
      const run = await runBriefing(b.id);
      setItems(
        (xs) =>
          xs?.map((x) =>
            x.id === b.id
              ? {
                  ...x,
                  latestReport: run.report,
                  lastRunAt: run.createdAt,
                  pastRuns: x.latestReport
                    ? [{ date: (x.lastRunAt ?? "").slice(0, 10), summary: x.latestReport.slice(0, 140) }, ...x.pastRuns].slice(0, 4)
                    : x.pastRuns,
                }
              : x
          ) ?? null
      );
      toast("success", "简报已运行，结果如下。 ");
    } catch {
      toast("error", "本次简报运行失败，请稍后再试。 ");
    } finally {
      setRunningId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight">定时简报</h1>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                live ? "bg-good/10 text-good" : "bg-ink/10 text-ink-muted"
              }`}
            >
              {live ? "实时" : "演示"}
            </span>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-ink-2">
            让户外助手按每天、每周或环境指标越线时自动生成简报；调度器每分钟检查一次。
          </p>
          {signedOut && (
            <Link href="/signin" className="mt-1 inline-block text-xs font-medium text-accent hover:underline">
              登录后设置你的简报 →
            </Link>
          )}
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          disabled={!live}
          className="btn-primary px-4 py-2 text-sm disabled:opacity-45"
        >
          {adding ? "收起" : "新建简报"}
        </button>
      </header>

      {adding && live && (
        <Card title="新建简报">
          <div className="flex flex-col gap-3">
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="简报名称，例如：晨间简报"
              className="rounded-lg border border-hairline bg-page px-3.5 py-2.5 text-sm placeholder:text-ink-muted"
            />
            <textarea
              value={form.prompt}
              onChange={(e) => setForm({ ...form, prompt: e.target.value })}
              rows={2}
              placeholder="长期要求，例如：每天早晨总结当天情况，并指出活动中的风险。"
              className="rounded-xl border border-hairline bg-page px-3.5 py-2.5 text-sm placeholder:text-ink-muted"
            />
            <div className="flex flex-wrap items-center gap-3 text-sm text-ink-2">
              <select
                value={form.cadence}
                onChange={(e) => setForm({ ...form, cadence: e.target.value as BriefingCadence })}
                className="rounded-lg border border-hairline bg-page px-3 py-2 text-sm"
              >
                <option value="daily">每天</option>
                <option value="weekly">每周五</option>
                <option value="on_change">条件变化时</option>
                <option value="manual">仅手动</option>
              </select>
              {(form.cadence === "daily" || form.cadence === "weekly") && (
                <label className="flex items-center gap-2">
                  于
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={form.hourLocal}
                    onChange={(e) => setForm({ ...form, hourLocal: Number(e.target.value) })}
                    className="w-16 rounded-lg border border-hairline bg-page px-2 py-2 text-sm"
                  />
                  :00 当地时间
                </label>
              )}
              {form.cadence === "on_change" && (
                <>
                  <span>当</span>
                  <select
                    value={form.signal}
                    onChange={(e) => setForm({ ...form, signal: e.target.value as Signal })}
                    className="rounded-lg border border-hairline bg-page px-3 py-2 text-sm"
                  >
                    {SIGNALS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                  <span>达到</span>
                  <select
                    value={form.severity}
                    onChange={(e) => setForm({ ...form, severity: Number(e.target.value) })}
                    className="rounded-lg border border-hairline bg-page px-3 py-2 text-sm"
                  >
                    {SEVERITIES.map((s, i) => (
                      <option key={s} value={i}>{s}+</option>
                    ))}
                  </select>
                </>
              )}
            </div>
            <div className="flex justify-end">
              <button
                onClick={add}
                disabled={busy || !form.title.trim() || !form.prompt.trim()}
                className="btn-primary px-5 py-2 text-sm disabled:opacity-45"
              >
                {busy ? "正在保存…" : "保存简报"}
              </button>
            </div>
          </div>
        </Card>
      )}

      {live && items === null ? (
        <div className="flex flex-col gap-4">
          <div className="skeleton h-40" />
          <div className="skeleton h-40" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {shown.length === 0 && (
            <Card>
              <p className="text-sm text-ink-2">
                还没有定时简报。创建后，户外助手会按条件自动运行。
              </p>
            </Card>
          )}
          {shown.map((b) => {
            const enabled = live ? b.enabled : sampleEnabled[b.id];
            return (
              <Card key={b.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <h2 className="text-[15px] font-semibold tracking-tight">{b.title}</h2>
                    <span className="rounded-full bg-ink/10 px-2.5 py-0.5 text-[11px] font-medium text-ink-2">
                      {cadenceLabel(b)}
                    </span>
                    {b.trigger && (
                      <span className="rounded-full border border-hairline px-2.5 py-0.5 text-[11px] text-ink-muted">
                        {SIGNALS.find((s) => s.value === b.trigger?.signal)?.label ?? b.trigger.signal} 达到{" "}
                        {SEVERITIES[b.trigger.severity] ?? b.trigger.severity}+
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => runNow(b)}
                      disabled={!live || runningId !== null}
                      className="btn-ghost px-3.5 py-1.5 text-xs disabled:opacity-45"
                    >
                      {runningId === b.id ? "正在运行…" : "立即运行"}
                    </button>
                    <Toggle on={enabled} onClick={() => toggle(b)} />
                    {live && (
                      <button
                        onClick={() => remove(b)}
                        className="text-xs text-ink-muted hover:text-critical"
                      >
                        删除
                      </button>
                    )}
                  </div>
                </div>

                <p className="mt-3 border-l-2 border-hairline pl-3 text-sm italic leading-relaxed text-ink-muted">
                  “{b.prompt}”
                </p>

                {b.latestReport && (
                  <div className="mt-4 rounded-xl bg-surface-2 p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                      最近报告{b.lastRunAt ? ` · ${fmtDate(b.lastRunAt.slice(0, 10))}` : ""}
                    </div>
                    <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink-2">
                      {b.latestReport.replace(/\*\*/g, "")}
                    </p>
                  </div>
                )}

                {b.pastRuns.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-1 text-xs text-ink-muted">
                    {b.pastRuns.map((r, i) => (
                      <li key={`${r.date}-${i}`}>
                        <span className="text-ink-2">{fmtDate(r.date)}</span> — {r.summary.replace(/\*\*/g, "")}…
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
