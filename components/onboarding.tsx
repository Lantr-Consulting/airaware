"use client";

import { useRef, useState } from "react";
import { interpretProfile, patchSettings, searchCities } from "@/lib/api";
import { pick, useLanguage } from "@/lib/language";
import { invalidateMe } from "@/lib/use-me";
import { useToast } from "@/components/toast";
import type { AdvisorProfile, Location, Thresholds } from "@/lib/types";

// App-style onboarding: a full-screen welcome that fades between steps.
// Home city, a plain-language self-description that becomes enforced
// limits, then an explicit Activate. Skipping leaves a compact resume
// card where the wizard was mounted.

const ALLERGEN_ZH: Record<string, string> = {
  grass: "禾本科", ragweed: "豚草", birch: "桦树", alder: "桤木",
  mugwort: "艾蒿", olive: "橄榄树", tree: "树木", weed: "杂草",
};

export function Onboarding({
  variant = "setup",
  onDone,
}: {
  variant?: "setup" | "demo";
  onDone?: () => void;
}) {
  const language = useLanguage();
  const [finished, setFinished] = useState(false);
  const toast = useToast();
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Location[]>([]);
  const [home, setHome] = useState<Location | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [about, setAbout] = useState("");
  const [prof, setProf] = useState<AdvisorProfile>({
    asthma: false,
    pollenAllergies: [],
    skinType: 3,
    heatTolerance: "typical",
    kidMode: false,
    notes: "",
  });
  const [profileSaved, setProfileSaved] = useState(false);
  const [interpreted, setInterpreted] = useState(false);

  const debounceRef = useRef<number | null>(null);
  const seqRef = useRef(0);
  const [searching, setSearching] = useState(false);
  const [highlight, setHighlight] = useState(0);

  // Type-ahead: suggestions appear as you type (city, suburb, or town);
  // a stale response never overwrites a newer one.
  function onQueryChange(value: string) {
    setQuery(value);
    setNotice(null);
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    const q = value.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = window.setTimeout(async () => {
      const seq = ++seqRef.current;
      try {
        const hits = await searchCities(q, 8);
        if (seq !== seqRef.current) return;
        setResults(hits);
        setHighlight(0);
        if (hits.length === 0) setNotice(pick(language, "没有找到这个地方，换个写法试试。", "No match. Try another spelling."));
      } catch {
        if (seq === seqRef.current)
          setNotice(pick(language, "搜索暂时不可用，请稍后再试。", "Search is unavailable right now. Try again in a moment."));
      } finally {
        if (seq === seqRef.current) setSearching(false);
      }
    }, 280);
  }

  function onSearchKey(e: React.KeyboardEvent) {
    if (results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      void chooseHome(results[highlight]);
    } else if (e.key === "Escape") {
      setResults([]);
    }
  }

  async function chooseHome(loc: Location) {
    setBusy(true);
    try {
      await patchSettings({ homeLocation: loc });
      invalidateMe();
      setHome(loc);
      setStep(2);
    } catch {
      setNotice(pick(language, "保存失败，请重试。", "Couldn't save. Try again."));
    } finally {
      setBusy(false);
    }
  }

  async function runInterpret() {
    const text = about.trim();
    if (!text || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await interpretProfile(text);
      setProf(res.profile);
      setInterpreted(true);
    } catch {
      setNotice(pick(language, "解析暂时不可用，也可以直接点选下面的选项。", "Interpretation is unavailable right now. You can set the options below directly."));
    } finally {
      setBusy(false);
    }
  }

  // The same public-agency logic the interpreter uses, applied to whatever
  // the person confirms — editing an option keeps thresholds consistent.
  function deriveThresholds(p: AdvisorProfile): Thresholds {
    const sensitive = p.asthma || p.pollenAllergies.length > 0;
    const heat =
      p.heatTolerance === "low" || p.kidMode
        ? { heatCautionF: 90, heatAvoidF: 100 }
        : p.heatTolerance === "high"
          ? { heatCautionF: 98, heatAvoidF: 107 }
          : { heatCautionF: 95, heatAvoidF: 103 };
    return {
      uvProtect: p.skinType <= 2 ? 3 : p.skinType <= 4 ? 4 : 6,
      uvAvoid: 8,
      aqiCaution: sensitive ? 100 : 125,
      aqiAvoid: 150,
      pollenCaution: sensitive ? 2 : 3,
      ...heat,
    };
  }

  async function saveProfile() {
    setBusy(true);
    setNotice(null);
    try {
      const profile = { ...prof, notes: prof.notes || about.trim().slice(0, 300) };
      await patchSettings({ profile, thresholds: deriveThresholds(profile) });
      invalidateMe();
      setProfileSaved(true);
      setStep(3);
    } catch {
      setNotice(pick(language, "保存失败，请重试。", "Couldn't save. Try again."));
    } finally {
      setBusy(false);
    }
  }

  function toggleAllergen(a: string) {
    setProf((p) => ({
      ...p,
      pollenAllergies: p.pollenAllergies.includes(a)
        ? p.pollenAllergies.filter((x) => x !== a)
        : [...p.pollenAllergies, a],
    }));
  }

  async function activate() {
    setBusy(true);
    try {
      await patchSettings({ activated: true });
      invalidateMe();
      setFinished(true);
      onDone?.();
      toast("success", pick(language, "户外助手已启用，现在可以生成第一份今日安排。", "Advisor activated. Planning your first day is one click away."));
    } catch {
      toast("error", pick(language, "暂时无法启用，请稍后再试。", "Couldn't activate. Try again."));
      setBusy(false);
    }
  }

  if (finished || (!open && variant === "demo")) return null;

  if (!open) {
    return (
      <div className="pane flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <div className="text-[15px] font-semibold tracking-tight">
            {pick(language, "完成设置", "Finish setting up")}
          </div>
          <p className="mt-1 text-sm text-ink-2">
            {pick(language, "还差几步，助手就能为你规划真实的一天。", "A few steps and the advisor can plan your real day.")}
          </p>
        </div>
        <button onClick={() => setOpen(true)} className="btn-primary px-4 py-2 text-sm">
          {pick(language, "继续", "Continue")}
        </button>
      </div>
    );
  }

  const steps = [0, 1, 2, 3];
  return (
    <div className="anim-fade-in fixed inset-0 z-50 flex items-center justify-center bg-page/95 p-5 backdrop-blur-sm">
      <div className="pane w-full max-w-lg p-7 sm:p-9">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {steps.map((i) => (
              <span
                key={i}
                aria-hidden
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? "w-6 bg-accent" : i < step ? "w-1.5 bg-accent/50" : "w-1.5 bg-surface-2"
                }`}
              />
            ))}
          </div>
          <button
            onClick={() => {
              setOpen(false);
              if (variant === "demo") onDone?.();
            }}
            className="text-xs font-medium text-ink-muted transition-colors hover:text-ink"
          >
            {pick(language, "稍后再说", "Later")}
          </button>
        </div>

        {step === 0 && (
          <div key="s0" className="anim-step mt-8 flex flex-col items-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.png" alt="" className="size-14" />
            <h2 className="font-display mt-5 text-[26px] font-semibold tracking-tight">
              {pick(language, "欢迎使用 AirAware", "Welcome to AirAware")}
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
              {pick(language,
                "我会关注你所在地的紫外线、体感温度、空气质量和花粉，并围绕你的日程规划适合外出的时间。先花一分钟告诉我两件事。",
                "I watch UV, heat, air quality, and pollen where you live, and plan your outdoor time around your schedule. Two quick things first.")}
            </p>
            <button onClick={() => setStep(1)} className="btn-primary mt-7 px-6 py-2.5 text-sm">
              {pick(language, "开始", "Get started")}
            </button>
          </div>
        )}

        {step === 1 && (
          <div key="s1" className="anim-step mt-8">
            <h2 className="font-display text-[26px] font-semibold tracking-tight">
              {pick(language, "你住在哪里？", "Where do you live?")}
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
              {pick(language, "计划会使用你所在地的实时预报。", "Plans use the live forecast for your area.")}
            </p>
            <div className="relative mt-5">
              <input
                autoFocus
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                onKeyDown={onSearchKey}
                role="combobox"
                aria-expanded={results.length > 0}
                aria-autocomplete="list"
                placeholder={pick(language, "开始输入城市或城区，如：上海、浦东", "Start typing a city or suburb, e.g. Austin")}
                className="w-full rounded-full border border-hairline bg-page px-4 py-2.5 text-sm placeholder:text-ink-muted"
              />
              {searching && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-ink-muted">
                  {pick(language, "搜索中…", "Searching…")}
                </span>
              )}
              {results.length > 0 && (
                <div className="pane absolute inset-x-0 top-[calc(100%+6px)] z-10 max-h-72 overflow-y-auto p-1.5">
                  {results.map((r, i) => (
                    <button
                      key={`${r.name}-${r.lat}-${r.lon}`}
                      onClick={() => chooseHome(r)}
                      onMouseEnter={() => setHighlight(i)}
                      disabled={busy}
                      className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-sm transition-colors ${
                        i === highlight ? "bg-accent/8 text-accent" : "text-ink hover:bg-ink/5"
                      }`}
                    >
                      <span className="font-medium">{r.name}</span>
                      <span className={`text-xs ${i === highlight ? "text-accent" : "text-ink-muted"}`}>
                        {pick(language, "选择", "Choose")} →
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {notice && <p className="mt-2 text-xs text-ink-muted">{notice}</p>}
          </div>
        )}

        {step === 2 && (
          <div key="s2" className="anim-step mt-8">
            <h2 className="font-display text-[26px] font-semibold tracking-tight">
              {pick(language, "介绍一下你自己", "Tell me about yourself")}
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
              {pick(language,
                "过敏、皮肤、耐热程度、是否带小孩……随便写，我会据此为你定制防护标准。",
                "Allergies, skin, heat, kids. Write it naturally, and I'll tailor your protection to it.")}
            </p>
            <textarea
              autoFocus
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              rows={3}
              placeholder={pick(language,
                "例如：对花粉过敏，皮肤容易晒伤，周末会带孩子出门。",
                "e.g. Grass pollen allergy, I burn easily, weekends are with my kid.")}
              className="mt-5 w-full rounded-2xl border border-hairline bg-page px-4 py-3 text-sm leading-relaxed placeholder:text-ink-muted"
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <button
                onClick={runInterpret}
                disabled={busy || about.trim().length === 0}
                className="btn-ghost px-3.5 py-1.5 text-xs disabled:opacity-45"
              >
                {busy ? pick(language, "解析中…", "Reading…") : pick(language, "根据描述填写下方选项", "Fill in the options from my description")}
              </button>
              {interpreted && (
                <span className="text-xs text-ink-muted">
                  {pick(language, "已根据你的描述填写，请确认或调整", "Filled from your words. Confirm or adjust below")}
                </span>
              )}
            </div>
            {notice && <p className="mt-2 text-xs text-ink-muted">{notice}</p>}

            <div className="mt-5 flex flex-col gap-4">
              <div>
                <div className="text-xs font-medium text-ink-muted">
                  {pick(language, "皮肤对阳光的敏感度", "How your skin handles sun")}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {([
                    { v: 2, zh: "容易晒伤", en: "Fair, burns easily" },
                    { v: 3, zh: "中等", en: "Medium, tans gradually" },
                    { v: 5, zh: "深色，很少晒伤", en: "Deep, rarely burns" },
                  ] as const).map((o) => {
                    const group = prof.skinType <= 2 ? 2 : prof.skinType <= 4 ? 3 : 5;
                    const active = group === o.v;
                    return (
                      <button
                        key={o.v}
                        onClick={() => setProf((prev) => ({ ...prev, skinType: o.v }))}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                          active ? "border-accent bg-accent/10 text-accent" : "border-hairline text-ink-2 hover:bg-ink/5"
                        }`}
                      >
                        {pick(language, o.zh, o.en)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-ink-muted">
                  {pick(language, "对高温的耐受", "How you handle heat")}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {([
                    { v: "low", zh: "怕热", en: "Sensitive to heat" },
                    { v: "typical", zh: "一般", en: "Typical" },
                    { v: "high", zh: "比较耐热", en: "Handles heat well" },
                  ] as const).map((o) => (
                    <button
                      key={o.v}
                      onClick={() => setProf((prev) => ({ ...prev, heatTolerance: o.v }))}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        prof.heatTolerance === o.v ? "border-accent bg-accent/10 text-accent" : "border-hairline text-ink-2 hover:bg-ink/5"
                      }`}
                    >
                      {pick(language, o.zh, o.en)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-ink-muted">
                  {pick(language, "花粉过敏（可多选）", "Pollen allergies (pick any)")}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {["grass", "tree", "weed", "ragweed", "birch", "olive"].map((a) => (
                    <button
                      key={a}
                      onClick={() => toggleAllergen(a)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        prof.pollenAllergies.includes(a)
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-hairline text-ink-2 hover:bg-ink/5"
                      }`}
                    >
                      {pick(language, ALLERGEN_ZH[a] ?? a, a)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {([
                  { key: "asthma", zh: "哮喘", en: "Asthma" },
                  { key: "kidMode", zh: "会带小孩出门", en: "Planning for a child" },
                ] as const).map((o) => (
                  <button
                    key={o.key}
                    onClick={() => setProf((prev) => ({ ...prev, [o.key]: !prev[o.key] }))}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      prof[o.key] ? "border-accent bg-accent/10 text-accent" : "border-hairline text-ink-2 hover:bg-ink/5"
                    }`}
                  >
                    {prof[o.key] ? "✓ " : ""}
                    {pick(language, o.zh, o.en)}
                  </button>
                ))}
              </div>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-ink-muted">
              {pick(language,
                "这些选择会成为你的防护标准，之后随时可以在偏好设置中修改。",
                "These choices become your protection thresholds. You can change them anytime in Preferences.")}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <button onClick={saveProfile} disabled={busy} className="btn-primary px-5 py-2.5 text-sm">
                {busy ? "…" : pick(language, "确认并继续", "Confirm and continue")}
              </button>
              <button onClick={() => setStep(3)} disabled={busy} className="ml-auto text-xs font-medium text-ink-muted transition-colors hover:text-ink">
                {pick(language, "跳过这步", "Skip this step")}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div key="s3" className="anim-step mt-8">
            <h2 className="font-display text-[26px] font-semibold tracking-tight">
              {pick(language, "一切就绪", "You're set")}
            </h2>
            <ul className="mt-4 flex flex-col gap-2 text-sm text-ink-2">
              <li className="flex items-center gap-2.5">
                <span aria-hidden className={`size-2 rounded-full ${home ? "bg-good" : "bg-surface-2"}`} />
                {home
                  ? pick(language, `常住地：${home.name}`, `Home: ${home.name}`)
                  : pick(language, "常住地可稍后在偏好设置中修改", "Home location can be set later in Preferences")}
              </li>
              <li className="flex items-center gap-2.5">
                <span aria-hidden className={`size-2 rounded-full ${profileSaved ? "bg-good" : "bg-surface-2"}`} />
                {profileSaved
                  ? pick(language, "个人防护档案已保存", "Your protection profile is saved")
                  : pick(language, "个人情况可稍后补充", "Your profile can be added later")}
              </li>
              <li className="flex items-center gap-2.5">
                <span aria-hidden className="size-2 rounded-full bg-good" />
                {pick(language, "已为你准备了一组每周活动，可在“我的活动”中调整", "A starter week is ready. Adjust it under Activities")}
              </li>
            </ul>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
              {pick(language,
                "启用后，我才会开始为你规划。任何调整都需要你确认。",
                "Nothing plans until you activate, and every change still needs your approval.")}
            </p>
            <button onClick={activate} disabled={busy} className="btn-primary mt-6 px-6 py-2.5 text-sm">
              {busy ? pick(language, "正在启用…", "Activating…") : pick(language, "启用我的助手", "Activate my advisor")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
