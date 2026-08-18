"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { useToast } from "@/components/toast";
import { interpretProfile, patchSettings, searchCities } from "@/lib/api";
import { ADVISOR } from "@/lib/mock";
import { invalidateMe, useMe } from "@/lib/use-me";
import { fmtTempF } from "@/lib/format";
import type { AdvisorProfile, Location, Thresholds } from "@/lib/types";

const SKIN_TYPES = ["", "I", "II", "III", "IV", "V", "VI"];
const POLLEN_BANDS = ["低", "较低", "中等", "较高", "高"];

function HomeEditor({
  home,
  onSaved,
}: {
  home: Location;
  onSaved: (loc: Location) => void;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Location[]>([]);
  const [chosen, setChosen] = useState<Location | null>(null);
  const [zip, setZip] = useState("");
  const [saving, setSaving] = useState(false);

  // Debounced live search; all state changes ride the timer.
  useEffect(() => {
    if (!editing || chosen) return;
    const q = query.trim();
    const t = setTimeout(() => {
      if (q.length < 2) {
        setResults([]);
        return;
      }
      searchCities(q)
        .then(setResults)
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [query, editing, chosen]);

  async function save() {
    if (!chosen || saving) return;
    setSaving(true);
    try {
      const loc: Location = { ...chosen, zip: zip.trim() || chosen.zip };
      await patchSettings({ homeLocation: loc });
      invalidateMe();
      onSaved(loc);
      setEditing(false);
      setChosen(null);
      setQuery("");
      toast("success", `常住地已设为 ${loc.name}，之后的安排会采用当地环境数据。`);
    } catch {
      toast("error", "暂时无法保存常住地，请稍后再试。 ");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-4 py-1">
        <span className="text-ink-2">常住地</span>
        <span className="flex items-center gap-3">
          <span className="font-medium">{home.name}</span>
          <button onClick={() => setEditing(true)} className="btn-ghost px-3 py-1 text-xs">
            修改
          </button>
        </span>
      </div>
    );
  }

  const isUS = (chosen?.tz ?? "").startsWith("America/") || Boolean(chosen?.zip);

  return (
    <div className="flex flex-col gap-2 py-1">
      <div className="flex items-center justify-between gap-4">
        <span className="text-ink-2">常住地</span>
        <button
          onClick={() => {
            setEditing(false);
            setChosen(null);
            setQuery("");
          }}
          className="text-xs text-ink-muted hover:text-ink"
        >
          取消
        </button>
      </div>
      {!chosen ? (
        <div className="relative">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索任意城市…"
            className="w-full rounded-lg border border-hairline bg-page px-3.5 py-2.5 text-sm placeholder:text-ink-muted"
          />
          {results.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-hairline bg-surface-2 shadow-xl">
              {results.slice(0, 5).map((r) => (
                <li key={`${r.lat},${r.lon}`}>
                  <button
                    onClick={() => {
                      setChosen(r);
                      setZip(r.zip ?? "");
                    }}
                    className="w-full px-3.5 py-2.5 text-left text-sm text-ink-2 hover:bg-ink/5 hover:text-ink"
                  >
                    {r.name}
                    <span className="ml-2 text-xs text-ink-muted">{r.tz}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-accent/15 px-3 py-1.5 text-sm font-medium text-accent">
            {chosen.name}
          </span>
          {isUS && (
            <input
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              placeholder="邮编（用于花粉）"
              className="w-32 rounded-lg border border-hairline bg-page px-3 py-1.5 text-sm placeholder:text-ink-muted"
            />
          )}
          <button onClick={save} disabled={saving} className="btn-primary px-4 py-1.5 text-sm">
            {saving ? "正在保存…" : "保存"}
          </button>
          <button
            onClick={() => setChosen(null)}
            className="text-xs text-ink-muted hover:text-ink"
          >
            重新选择
          </button>
          {isUS && !zip && (
            <span className="w-full text-xs text-ink-muted">
              不填写美国邮编时，花粉会显示“暂无数据”；其他环境数据仍可正常使用。
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const toast = useToast();
  const { me, loading } = useMe();
  const [paused, setPaused] = useState(ADVISOR.paused);
  const [activated, setActivated] = useState(true);
  const [about, setAbout] = useState(ADVISOR.profile.notes);
  const [profile, setProfile] = useState<AdvisorProfile>(ADVISOR.profile);
  const [thresholds, setThresholds] = useState<Thresholds>(ADVISOR.thresholds);
  const [home, setHome] = useState<Location>(ADVISOR.homeLocation);
  const [units, setUnits] = useState<string>(ADVISOR.units);
  const [interpreting, setInterpreting] = useState(false);
  const [activating, setActivating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const signedOut = !loading && me === null;
  const live = me !== null;

  // Adopt the account's values when /me (re)loads. State-during-render
  // pattern, so there's no cascading effect.
  const [adoptedMe, setAdoptedMe] = useState<typeof me>(null);
  if (me !== adoptedMe) {
    setAdoptedMe(me);
    if (me) {
      setProfile(me.profile);
      setThresholds(me.thresholds);
      setHome(me.homeLocation);
      setUnits(me.units);
      setPaused(me.paused);
      setActivated(me.activated);
      setAbout(me.profile.notes);
    }
  }

  async function interpret() {
    const text = about.trim();
    if (!text || interpreting) return;
    setInterpreting(true);
    setNotice(null);
    try {
      const result = await interpretProfile(text);
      const nextProfile = { ...result.profile, notes: result.profile.notes || text };
      if (live) {
        await patchSettings({ profile: nextProfile, thresholds: result.thresholds });
        invalidateMe();
        toast("success", "个人情况已整理并保存，下方提醒线已经生效。 ");
      } else {
        setNotice("已生成预览；登录后才能保存到你的账户。 ");
      }
      setProfile(nextProfile);
      setThresholds(result.thresholds);
    } catch {
      toast("error", "暂时无法连接解析服务，设置没有发生变化。 ");
    } finally {
      setInterpreting(false);
    }
  }

  async function activate() {
    if (activating) return;
    setActivating(true);
    try {
      await patchSettings({ activated: true });
      setActivated(true);
      invalidateMe();
      toast("success", "户外助手已启用，可以开始规划今天。 ");
    } catch {
      toast("error", "暂时无法启用，请稍后再试。 ");
    } finally {
      setActivating(false);
    }
  }

  async function togglePause() {
    const next = !paused;
    setPaused(next);
    if (live) {
      try {
        await patchSettings({ paused: next });
        toast("info", next ? "户外助手已暂停。" : "户外助手已恢复。 ");
      } catch {
        setPaused(!next);
      }
    }
  }

  const thresholdRows = [
    { line: `紫外线指数达到 ${thresholds.uvProtect} 时开始防护`, why: `皮肤类型 ${SKIN_TYPES[profile.skinType]}` },
    { line: `紫外线指数达到 ${thresholds.uvAvoid} 时调整午间暴露`, why: "WHO 很高等级" },
    { line: `AQI 达到 ${thresholds.aqiCaution} 时提醒高强度活动`, why: profile.asthma ? "哮喘" : profile.pollenAllergies.length ? "花粉过敏" : "EPA 指引" },
    { line: `AQI 达到 ${thresholds.aqiAvoid} 时建议改到室内`, why: "EPA 敏感人群不健康等级" },
    { line: `体感达到 ${fmtTempF(thresholds.heatCautionF)} 时提醒`, why: `高温耐受：${heatToleranceLabel(profile.heatTolerance)}` },
    { line: `体感达到 ${fmtTempF(thresholds.heatAvoidF)} 时建议改期`, why: "NWS 危险等级" },
    {
      line: `花粉达到“${POLLEN_BANDS[thresholds.pollenCaution]}”时开始提醒`,
      why: profile.pollenAllergies.length ? `过敏原：${profile.pollenAllergies.map(allergenLabel).join("、")}` : "未记录花粉过敏",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight">偏好与设置</h1>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                live ? "bg-good/10 text-good" : "bg-ink/10 text-ink-muted"
              }`}
            >
              {live ? "实时" : "演示"}
            </span>
          </div>
          <p className="mt-1.5 max-w-3xl text-[15px] leading-relaxed text-ink-2">
            用自然语言描述你的个人情况，助手会整理成下方明确的提醒线；未经你确认，不会自动修改活动。
          </p>
          {signedOut && (
            <Link href="/signin" className="mt-1 inline-block text-xs font-medium text-accent hover:underline">
              登录后保存你的个人设置 →
            </Link>
          )}
        </div>
        <div className="flex items-center gap-3">
          {live && !activated ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-band-1/10 px-3 py-1 text-xs font-medium text-band-1">
              <span aria-hidden className="inline-block size-2 rounded-full bg-current" />
              尚未启用
            </span>
          ) : (
            <>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                  paused ? "bg-ink/10 text-ink-2" : "bg-good/10 text-good"
                }`}
              >
                <span aria-hidden className="inline-block size-2 rounded-full bg-current" />
                {paused ? "已暂停" : "运行中"}
              </span>
              <button onClick={togglePause} className="btn-ghost px-4 py-1.5 text-sm">
                {paused ? "恢复" : "暂停"}
              </button>
            </>
          )}
        </div>
      </header>

      {live && !activated && (
        <Card className="border border-accent/30">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold tracking-tight">确认后启用</h2>
              <p className="mt-1.5 max-w-xl text-[15px] leading-relaxed text-ink-2">
                请设置常住地、描述个人情况并检查提醒线。确认准确后再启用；在此之前不会自动生成安排。
              </p>
            </div>
            <button onClick={activate} disabled={activating} className="btn-primary px-5 py-2 text-sm">
              {activating ? "正在启用…" : "启用户外助手"}
            </button>
          </div>
        </Card>
      )}

      <Card title="你的个人情况">
        <textarea
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          rows={3}
          placeholder="可以写过敏情况、皮肤类型、高温耐受、是否有儿童同行，以及日常习惯。"
          className="w-full rounded-xl border border-hairline bg-page px-4 py-3 text-sm leading-relaxed text-ink-2 placeholder:text-ink-muted"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-ink-muted">
            {notice ?? "写下个人情况并点击“整理为提醒线”；登录后会同步保存。"}
          </p>
          <button onClick={interpret} disabled={interpreting} className="btn-primary px-4 py-1.5 text-sm">
            {interpreting ? "正在整理…" : "整理为提醒线"}
          </button>
        </div>
      </Card>

      <Card title="敏感因素">
        <div className="flex flex-wrap gap-2 text-[11px] font-medium">
          <span className="rounded-full border border-hairline px-3 py-1.5 text-ink-2">
            皮肤类型 {SKIN_TYPES[profile.skinType]}
          </span>
          {profile.pollenAllergies.map((p) => (
            <span key={p} className="rounded-full border border-hairline px-3 py-1.5 capitalize text-ink-2">
              {allergenLabel(p)}过敏
            </span>
          ))}
          <span className="rounded-full border border-hairline px-3 py-1.5 capitalize text-ink-2">
            高温耐受：{heatToleranceLabel(profile.heatTolerance)}
          </span>
          <span className="rounded-full border border-hairline px-3 py-1.5 text-ink-2">
            哮喘：{profile.asthma ? "有" : "无"}
          </span>
          <span className="rounded-full border border-hairline px-3 py-1.5 text-ink-2">
            儿童同行：{profile.kidMode ? "有" : "无"}
          </span>
        </div>
      </Card>

      <Card title="提醒线 · 由系统强制执行">
        <ul className="flex flex-col divide-y divide-hairline">
          {thresholdRows.map((r) => (
            <li key={r.line} className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <span className="text-ink-2">{r.line}</span>
              <span className="shrink-0 text-xs text-ink-muted">{r.why}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-muted">
          每条安排都会说明触发了哪项提醒线。这些检查都写在代码里，修改提醒线后，之后的安排也会一起更新。
        </p>
      </Card>

      <Card title="地点与单位">
        <div className="flex flex-col gap-2 text-sm">
          {live ? (
            <HomeEditor home={home} onSaved={setHome} />
          ) : (
            <div className="flex items-center justify-between gap-4 py-1">
              <span className="text-ink-2">常住地</span>
              <span className="font-medium">{home.name}</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-4 border-t border-hairline py-1 pt-3">
            <span className="text-ink-2">显示单位</span>
            <span className="font-medium">公制（摄氏度）</span>
          </div>
        </div>
      </Card>

      <Card title="更多工具">
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/explore" className="rounded-xl border border-hairline px-4 py-3 hover:bg-ink/5">
            <div className="text-sm font-medium">城市环境查询</div>
            <p className="mt-1 text-xs text-ink-muted">比较不同城市的紫外线、空气质量、体感温度和花粉情况。</p>
          </Link>
          <Link href="/briefings" className="rounded-xl border border-hairline px-4 py-3 hover:bg-ink/5">
            <div className="text-sm font-medium">定时简报</div>
            <p className="mt-1 text-xs text-ink-muted">按每天、每周或指标变化自动生成环境提醒。</p>
          </Link>
        </div>
      </Card>
    </div>
  );
}

function heatToleranceLabel(value: string) {
  return { low: "较低", typical: "一般", high: "较高" }[value] ?? value;
}

function allergenLabel(value: string) {
  return {
    grass: "禾本科",
    ragweed: "豚草",
    birch: "桦树",
    alder: "桤木",
    mugwort: "艾蒿",
    olive: "橄榄树",
    tree: "树木",
    weed: "杂草",
  }[value] ?? value;
}
