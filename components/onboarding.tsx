"use client";

import { useState } from "react";
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

function clearDemoFlag() {
  try { sessionStorage.removeItem("aa-onboard"); } catch {}
}

export function Onboarding({ variant = "setup" }: { variant?: "setup" | "demo" }) {
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

  async function runSearch() {
    const q = query.trim();
    if (q.length < 2 || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const hits = await searchCities(q);
      setResults(hits.slice(0, 5));
      if (hits.length === 0) setNotice(pick(language, "没有找到这个城市，换个写法试试。", "No city found. Try another spelling."));
    } catch {
      setNotice(pick(language, "搜索暂时不可用，请稍后再试。", "Search is unavailable right now. Try again in a moment."));
    } finally {
      setBusy(false);
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
      clearDemoFlag();
      setFinished(true);
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
  const chips: string[] = interp
    ? [
        pick(language, `皮肤类型 ${interp.profile.skinType}`, `Skin type ${interp.profile.skinType}`),
        pick(language,
          { low: "怕热", typical: "耐热一般", high: "耐热较强" }[interp.profile.heatTolerance],
          `${interp.profile.heatTolerance} heat tolerance`),
        ...(interp.profile.asthma ? [pick(language, "哮喘", "Asthma")] : []),
        ...(interp.profile.kidMode ? [pick(language, "带娃模式", "Kid mode")] : []),
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
            onClick={() => { clearDemoFlag(); setOpen(false); }}
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
            <div className="mt-5 flex items-center gap-2">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
                placeholder={pick(language, "搜索城市，如：上海", "Search a city, e.g. Austin")}
                className="flex-1 rounded-full border border-hairline bg-page px-4 py-2.5 text-sm placeholder:text-ink-muted"
              />
              <button onClick={runSearch} disabled={busy} className="btn-primary px-4 py-2.5 text-sm">
                {busy ? "…" : pick(language, "搜索", "Search")}
              </button>
            </div>
            {notice && <p className="mt-2 text-xs text-ink-muted">{notice}</p>}
            {results.length > 0 && (
              <div className="mt-3 flex flex-col gap-1.5">
                {results.map((r) => (
                  <button
                    key={`${r.name}-${r.lat}`}
                    onClick={() => chooseHome(r)}
                    disabled={busy}
                    className="flex items-center justify-between rounded-xl border border-hairline px-4 py-2.5 text-left text-sm transition-colors hover:border-accent/40 hover:bg-accent/5"
                  >
                    <span className="font-medium">{r.name}</span>
                    <span className="text-xs text-ink-muted">{pick(language, "选择", "Choose")} →</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div key="s2" className="anim-step mt-8">
            <h2 className="font-display text-[26px] font-semibold tracking-tight">
              {pick(language, "介绍一下你自己", "Tell me about yourself")}
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
              {pick(language,
                "过敏、皮肤、耐热程度、是否带小孩……随便写，我会把它变成明确的保护线。",
                "Allergies, skin, heat, kids. Write it naturally, and I'll turn it into enforced limits.")}
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
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {chips.map((c) => (
                  <span key={c} className="rounded-full border border-accent/30 bg-accent/8 px-3 py-1 text-xs font-medium text-accent">
                    {c}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              {interp === null ? (
                <button onClick={runInterpret} disabled={busy || about.trim().length === 0} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-45">
                  {busy ? pick(language, "解析中…", "Reading…") : pick(language, "解析为保护线", "Turn into limits")}
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
                  ? pick(language, "个人保护线已保存", "Your personal limits are saved")
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
