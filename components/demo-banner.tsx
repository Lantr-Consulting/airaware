"use client";

import { useEffect, useState } from "react";
import { getDemoStatus, resetDemo, type DemoStatus } from "@/lib/demo";
import { pick, useLanguage } from "@/lib/language";
import { supabase } from "@/lib/supabase";

export function DemoBanner() {
  const language = useLanguage();
  const [status, setStatus] = useState<DemoStatus | null>(null);
  const [resetting, setResetting] = useState(false);
  // The language this workspace's content was seeded in, from the demo
  // user's own metadata. A mismatch with the UI language gets a one-click
  // fix right here, on every page.
  const [seedLang, setSeedLang] = useState<string | null>(null);
  const [mismatchHidden, setMismatchHidden] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => { let active = true; const load = () => getDemoStatus().then((value) => { if (active) setStatus(value); }).catch(() => {}); load(); const timer = window.setInterval(load, 30000); return () => { active = false; window.clearInterval(timer); }; }, []);

  useEffect(() => {
    if (!status?.isDemo) return;
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      if (u?.user_metadata?.demo_kind === "lantr-private-demo") {
        setSeedLang((u.user_metadata?.demo_language as string) ?? null);
      }
    });
    try { setMismatchHidden(sessionStorage.getItem("aa-mismatch-hide") === "1"); } catch {}
  }, [status?.isDemo]);

  if (!status?.isDemo) return null;
  const remaining = status.aiActionsRemaining ?? Math.max(0, (status.aiActionLimit ?? 0) - (status.aiActionsUsed ?? 0));
  const mismatch = seedLang !== null && seedLang !== language && !mismatchHidden;

  async function reset() { if (!window.confirm(pick(language, "这会清空你在三个项目中的临时演示数据，并恢复示例内容。继续吗？", "This clears your temporary data across all three demos and restores the samples. Continue?"))) return; setResetting(true); try { await resetDemo(); window.location.assign("/today"); } catch { setResetting(false); } }

  function freshWorkspace() {
    // The demo entry mints the new workspace and runs onboarding there.
    setSwitching(true);
    window.location.assign("/demo");
  }

  function hideMismatch() {
    try { sessionStorage.setItem("aa-mismatch-hide", "1"); } catch {}
    setMismatchHidden(true);
  }

  return (
    <>
      <div className="border-b border-accent/20 bg-accent/[0.07] px-4 py-2 text-xs text-ink-2"><div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-center gap-x-3 gap-y-1 sm:justify-between"><span><strong className="text-ink">{pick(language, "专属互动演示", "Private interactive demo")}</strong> · {pick(language, "数据会在 24 小时后清除", "Data clears after 24 hours")}</span><span className="flex items-center gap-3"><span>{pick(language, `还可使用 ${remaining} 次 AI 功能`, `${remaining} AI actions remaining`)}</span><button type="button" disabled={resetting} onClick={() => void reset()} className="font-semibold text-accent hover:underline disabled:opacity-50">{resetting ? pick(language, "正在重置…", "Resetting…") : pick(language, "重置演示", "Reset demo")}</button></span></div></div>
      {mismatch && (
        <div className="border-b border-band-2/30 bg-band-2/10 px-4 py-2 text-xs text-ink-2">
          <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-center gap-x-3 gap-y-1 sm:justify-between">
            <span>
              {pick(language,
                "这个演示工作区的内容是英文的。",
                "This demo workspace was created with Chinese content.")}
            </span>
            <span className="flex items-center gap-3">
              <button
                type="button"
                disabled={switching}
                onClick={() => void freshWorkspace()}
                className="font-semibold text-accent hover:underline disabled:opacity-50"
              >
                {switching
                  ? pick(language, "正在准备…", "Setting up…")
                  : pick(language, "开始新的中文演示 →", "Start a fresh English demo →")}
              </button>
              <button type="button" onClick={hideMismatch} className="text-ink-muted hover:text-ink">
                {pick(language, "保留当前内容", "Keep it as is")}
              </button>
            </span>
          </div>
        </div>
      )}
    </>
  );
}
