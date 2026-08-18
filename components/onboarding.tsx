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
  const [interp, setInterp] = useState<{ profile: AdvisorProfile; thresholds: Thresholds } | null>(null);

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
      setInterp(await interpretProfile(text));
    } catch {
      setNotice(pick(language, "解析暂时不可用，可以先跳过这一步。", "Interpretation is unavailable right now. You can skip this step."));
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile() {
    if (!interp) return;
    setBusy(true);
    try {
      await patchSettings({ profile: interp.profile, thresholds: interp.thresholds });
      invalidateMe();
      setStep(3);
    } catch {
      setNotice(pick(language, "保存失败，请重试。", "Couldn't save. Try again."));
    } finally {
      setBusy(false);
    }
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
  const SKIN_EN = ["", "very fair, burns fast", "fair, burns easily", "medium, tans gradually", "olive, tans easily", "brown, rarely burns", "deep, almost never burns"];
  const SKIN_ZH = ["", "极易晒伤", "容易晒伤", "中等，可逐渐晒黑", "偏深，容易晒黑", "较深，很少晒伤", "深色，几乎不晒伤"];
  const chips: string[] = interp
    ? [
        pick(language, `肤色：${SKIN_ZH[interp.profile.skinType]}`, `Skin: ${SKIN_EN[interp.profile.skinType]}`),
        pick(language,
          { low: "怕热", typical: "耐热程度：一般", high: "耐热较强" }[interp.profile.heatTolerance],
          { low: "sensitive to heat", typical: "typical heat tolerance", high: "handles heat well" }[interp.profile.heatTolerance]),
        ...(interp.profile.asthma ? [pick(language, "哮喘", "Asthma")] : []),
        ...(interp.profile.kidMode ? [pick(language, "带娃模式", "Planning for a child")] : []),
        ...interp.profile.pollenAllergies.map((a) =>
          pick(language, `${ALLERGEN_ZH[a] ?? a}过敏`, `${a} allergy`)
        ),
      ]
    : [];

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
              rows={4}
              placeholder={pick(language,
                "例如：对花粉过敏，皮肤容易晒伤，周末会带孩子出门。",
                "e.g. Grass pollen allergy, I burn easily, weekends are with my kid.")}
              className="mt-5 w-full rounded-2xl border border-hairline bg-page px-4 py-3 text-sm leading-relaxed placeholder:text-ink-muted"
            />
            {notice && <p className="mt-2 text-xs text-ink-muted">{notice}</p>}
            {interp && (
              <>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {chips.map((c) => (
                    <span key={c} className="rounded-full border border-accent/30 bg-accent/8 px-3 py-1 text-xs font-medium text-accent">
                      {c}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                  {pick(language,
                    "这些会成为你的防护标准。没提到的部分先用常见默认值，之后可在偏好设置中修改。",
                    "These become your protection thresholds. Anything you didn't mention uses a sensible default you can change later in Preferences.")}
                </p>
              </>
            )}
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              {interp === null ? (
                <button onClick={runInterpret} disabled={busy || about.trim().length === 0} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-45">
                  {busy ? pick(language, "解析中…", "Reading…") : pick(language, "为我定制", "Personalize")}
                </button>
              ) : (
                <>
                  <button onClick={saveProfile} disabled={busy} className="btn-primary px-5 py-2.5 text-sm">
                    {busy ? "…" : pick(language, "没错，保存", "Looks right, save")}
                  </button>
                  <button onClick={() => setInterp(null)} disabled={busy} className="btn-ghost px-4 py-2.5 text-sm">
                    {pick(language, "改一改", "Edit")}
                  </button>
                </>
              )}
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
                <span aria-hidden className={`size-2 rounded-full ${interp ? "bg-good" : "bg-surface-2"}`} />
                {interp
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
