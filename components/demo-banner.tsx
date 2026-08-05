"use client";

import { useEffect, useState } from "react";
import { getDemoStatus, resetDemo, type DemoStatus } from "@/lib/demo";
import { pick, useLanguage } from "@/lib/language";

export function DemoBanner() {
  const language = useLanguage();
  const [status, setStatus] = useState<DemoStatus | null>(null);
  const [resetting, setResetting] = useState(false);
  useEffect(() => { let active = true; const load = () => getDemoStatus().then((value) => { if (active) setStatus(value); }).catch(() => {}); load(); const timer = window.setInterval(load, 30000); return () => { active = false; window.clearInterval(timer); }; }, []);
  if (!status?.isDemo) return null;
  const remaining = status.aiActionsRemaining ?? Math.max(0, (status.aiActionLimit ?? 0) - (status.aiActionsUsed ?? 0));
  async function reset() { if (!window.confirm(pick(language, "这会清空你在三个项目中的临时演示数据，并恢复示例内容。继续吗？", "This clears your temporary data across all three demos and restores the samples. Continue?"))) return; setResetting(true); try { await resetDemo(); window.location.assign("/today"); } catch { setResetting(false); } }
  return <div className="border-b border-accent/20 bg-accent/[0.07] px-4 py-2 text-xs text-ink-2"><div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-center gap-x-3 gap-y-1 sm:justify-between"><span><strong className="text-ink">{pick(language, "专属互动演示", "Private interactive demo")}</strong> · {pick(language, "数据会在 24 小时后清除", "Data clears after 24 hours")}</span><span className="flex items-center gap-3"><span>{pick(language, `还可使用 ${remaining} 次 AI 功能`, `${remaining} AI actions remaining`)}</span><button type="button" disabled={resetting} onClick={() => void reset()} className="font-semibold text-accent hover:underline disabled:opacity-50">{resetting ? pick(language, "正在重置…", "Resetting…") : pick(language, "重置演示", "Reset demo")}</button></span></div></div>;
}
