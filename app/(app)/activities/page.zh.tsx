"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { useToast } from "@/components/toast";
import { createActivity, deleteActivity, listActivities, updateActivity } from "@/lib/api";
import { DOW_SHORT, fmtDays, fmtTime } from "@/lib/format";
import { ACTIVITIES } from "@/lib/mock";
import { supabase } from "@/lib/supabase";
import type { Activity, ActivityKind, Flexibility, Intensity } from "@/lib/types";

const KIND_LABEL: Record<ActivityKind, string> = {
  run: "跑步",
  commute: "通勤",
  sport: "运动训练",
  hike: "徒步",
  chores: "日常事务",
  volunteer: "志愿活动",
};

const FLEX_LABEL: Record<Flexibility, string> = {
  fixed: "时间固定",
  flex_time: "时间可调整",
  flex_day: "日期可调整",
};

const EMPTY_FORM = {
  name: "",
  kind: "run" as ActivityKind,
  daysOfWeek: [] as number[],
  startTime: "07:00",
  durationMin: 45,
  intensity: "moderate" as Intensity,
  flexibility: "flex_time" as Flexibility,
  indoorAlternative: "",
  enabled: true,
};

export default function ActivitiesPage() {
  const toast = useToast();
  const [signedOut, setSignedOut] = useState(false);
  const [offline, setOffline] = useState(false);
  const [items, setItems] = useState<Activity[]>(ACTIVITIES);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  const live = !signedOut && !offline;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        setSignedOut(true);
        return;
      }
      try {
        const acts = await listActivities();
        if (!cancelled) setItems(acts);
      } catch {
        if (!cancelled) setOffline(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle(a: Activity) {
    if (!live) return;
    setItems((xs) => xs.map((x) => (x.id === a.id ? { ...x, enabled: !a.enabled } : x)));
    try {
      await updateActivity(a.id, { enabled: !a.enabled });
    } catch {
      setItems((xs) => xs.map((x) => (x.id === a.id ? { ...x, enabled: a.enabled } : x)));
    }
  }

  async function remove(a: Activity) {
    if (!live) return;
    const prev = items;
    setItems((xs) => xs.filter((x) => x.id !== a.id));
    try {
      await deleteActivity(a.id);
      toast("info", `“${a.name}”已从每周活动中删除。`);
    } catch {
      setItems(prev);
      toast("error", "暂时无法删除，活动已恢复。 ");
    }
  }

  async function add() {
    if (!live || busy || !form.name.trim() || form.daysOfWeek.length === 0) return;
    setBusy(true);
    try {
      const created = await createActivity({
        ...form,
        name: form.name.trim(),
        indoorAlternative: form.indoorAlternative.trim() || undefined,
      });
      setItems((xs) => [...xs, created].sort((a, b) => a.startTime.localeCompare(b.startTime)));
      setForm(EMPTY_FORM);
      setAdding(false);
      toast("success", `“${created.name}”已添加，助手会在对应日期纳入规划。`);
    } catch {
      toast("error", "暂时无法保存活动，请稍后再试。 ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight">我的活动</h1>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                live ? "bg-good/10 text-good" : "bg-ink/10 text-ink-muted"
              }`}
            >
              {live ? "实时" : "演示"}
            </span>
          </div>
          <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-ink-2">
            记录每周固定活动，并说明哪些时间可以调整。可移动的活动会获得更合适的时段建议；
            时间固定的活动则会收到风险和装备提醒。
          </p>
          {signedOut && (
            <Link href="/signin" className="mt-1 inline-block text-xs font-medium text-accent hover:underline">
              登录后设置你的每周活动 →
            </Link>
          )}
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          disabled={!live}
          className="btn-primary px-4 py-2 text-sm disabled:opacity-45"
        >
          {adding ? "收起" : "添加活动"}
        </button>
      </header>

      {adding && live && (
        <Card title="新活动">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="活动名称，例如：午休散步"
              className="rounded-lg border border-hairline bg-page px-3.5 py-2.5 text-sm placeholder:text-ink-muted sm:col-span-2"
            />
            <label className="flex items-center justify-between gap-3 text-sm text-ink-2">
              类型
              <select
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value as ActivityKind })}
                className="rounded-lg border border-hairline bg-page px-3 py-2 text-sm"
              >
                {Object.entries(KIND_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center justify-between gap-3 text-sm text-ink-2">
              强度
              <select
                value={form.intensity}
                onChange={(e) => setForm({ ...form, intensity: e.target.value as Intensity })}
                className="rounded-lg border border-hairline bg-page px-3 py-2 text-sm"
              >
                <option value="low">低</option>
                <option value="moderate">中等</option>
                <option value="high">高</option>
              </select>
            </label>
            <label className="flex items-center justify-between gap-3 text-sm text-ink-2">
              开始时间
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className="rounded-lg border border-hairline bg-page px-3 py-2 text-sm"
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm text-ink-2">
              时长（分钟）
              <input
                type="number"
                min={10}
                max={480}
                value={form.durationMin}
                onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })}
                className="w-24 rounded-lg border border-hairline bg-page px-3 py-2 text-sm"
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm text-ink-2">
              可调整程度
              <select
                value={form.flexibility}
                onChange={(e) => setForm({ ...form, flexibility: e.target.value as Flexibility })}
                className="rounded-lg border border-hairline bg-page px-3 py-2 text-sm"
              >
                {Object.entries(FLEX_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </label>
            <input
              value={form.indoorAlternative}
              onChange={(e) => setForm({ ...form, indoorAlternative: e.target.value })}
              placeholder="室内替代方案（选填）"
              className="rounded-lg border border-hairline bg-page px-3.5 py-2.5 text-sm placeholder:text-ink-muted"
            />
            <div className="flex flex-wrap items-center gap-1.5 sm:col-span-2">
              {DOW_SHORT.map((d, i) => (
                <button
                  key={d}
                  onClick={() =>
                    setForm({
                      ...form,
                      daysOfWeek: form.daysOfWeek.includes(i)
                        ? form.daysOfWeek.filter((x) => x !== i)
                        : [...form.daysOfWeek, i].sort(),
                    })
                  }
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    form.daysOfWeek.includes(i)
                      ? "bg-accent text-accent-contrast"
                      : "border border-hairline text-ink-2 hover:text-ink"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={add}
              disabled={busy || !form.name.trim() || form.daysOfWeek.length === 0}
              className="btn-primary px-5 py-2 text-sm disabled:opacity-45"
            >
              {busy ? "正在保存…" : "保存活动"}
            </button>
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((a) => (
          <Card key={a.id} className={a.enabled ? "" : "opacity-55"}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[15px] font-semibold tracking-tight">{a.name}</div>
                <div className="mt-0.5 text-xs text-ink-muted">
                  {fmtDays(a.daysOfWeek)} · {fmtTime(a.startTime)} · {a.durationMin} 分钟
                </div>
              </div>
              <span className="rounded-full bg-ink/10 px-2.5 py-0.5 text-[11px] font-medium text-ink-2">
                {KIND_LABEL[a.kind]}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-medium">
              <span className="rounded-full border border-hairline px-2.5 py-1 capitalize text-ink-2">
                {{ low: "低强度", moderate: "中等强度", high: "高强度" }[a.intensity]}
              </span>
              <span className="rounded-full border border-hairline px-2.5 py-1 text-ink-2">
                {FLEX_LABEL[a.flexibility]}
              </span>
              {a.indoorAlternative && (
                <span className="rounded-full border border-hairline px-2.5 py-1 text-ink-2">
                  室内替代：{a.indoorAlternative}
                </span>
              )}
            </div>

            {live && (
              <div className="mt-4 flex items-center gap-3 border-t border-hairline pt-3 text-xs">
                <button onClick={() => toggle(a)} className="btn-ghost px-3 py-1">
                  {a.enabled ? "停用" : "启用"}
                </button>
                <button onClick={() => remove(a)} className="text-ink-muted hover:text-critical">
                  删除
                </button>
              </div>
            )}
          </Card>
        ))}
      </div>

      <p className="text-xs text-ink-muted">
        活动强度会影响判断：AQI 同为 130 时，高强度跑步与轻松散步的风险并不相同；
        强度越高，环境暴露评估采用的提醒标准越严格。
      </p>
    </div>
  );
}
