"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { DemoError, startDemo } from "@/lib/demo";
import { pick, useLanguage } from "@/lib/language";
import { supabase } from "@/lib/supabase";

export default function DemoEntry() {
  const language = useLanguage();
  const started = useRef(false);
  const [state, setState] = useState<"starting" | "invite" | "error">("starting");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const enter = useCallback(async (inviteCode?: string) => {
    setBusy(true); setState("starting");
    try { await startDemo(language, inviteCode); window.location.replace("/today"); }
    catch (error) { setState(error instanceof DemoError && error.status === 403 ? "invite" : "error"); setBusy(false); }
  }, [language]);

  useEffect(() => {
    if (started.current) return; started.current = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        const { data: fresh, error } = await supabase.auth.getUser();
        const expires = fresh.user?.user_metadata?.demo_expires_at;
        if (!error && fresh.user && (!expires || new Date(expires).getTime() > Date.now())) { window.location.replace("/today"); return; }
        await supabase.auth.signOut();
      }
      void enter(new URLSearchParams(window.location.search).get("code") ?? undefined);
    });
  }, [enter]);

  function submit(event: FormEvent) { event.preventDefault(); if (!busy && code.trim()) void enter(code.trim()); }

  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-5 py-12 text-ink">
      <section className="w-full max-w-md rounded-3xl border border-hairline bg-surface p-7 shadow-2xl sm:p-9">
        <span className="inline-flex rounded-full bg-accent/15 px-3 py-1 text-[11px] font-semibold text-accent">AirAware · {pick(language, "互动演示", "Interactive demo")}</span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">{state === "invite" ? pick(language, "输入邀请码", "Enter your invite code") : pick(language, "正在准备你的户外安排", "Preparing your private outdoor plan")}</h1>
        <p className="mt-3 text-sm leading-6 text-ink-2">{pick(language, "无需注册。系统会准备一份可以修改和重置的个人日程，有效期为 24 小时，并使用实时公开环境数据。", "No signup required. You’ll get a private 24-hour schedule you can change and reset, grounded in live public environmental data.")}</p>
        {state === "invite" && <form onSubmit={submit} className="mt-6 grid gap-3"><input value={code} onChange={(event) => setCode(event.target.value)} autoFocus placeholder={pick(language, "邀请码", "Invite code")} className="h-11 rounded-xl border border-hairline bg-page px-3.5 text-sm outline-none focus:border-accent" /><button disabled={busy || !code.trim()} className="btn-primary h-11 disabled:opacity-50">{busy ? pick(language, "正在进入…", "Opening…") : pick(language, "进入演示", "Open demo")}</button></form>}
        {state === "starting" && <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-ink/10"><span className="block h-full w-1/2 animate-pulse rounded-full bg-accent" /></div>}
        {state === "error" && <div className="mt-6 rounded-xl border border-critical/30 bg-critical/5 p-4 text-sm text-ink-2"><p>{pick(language, "演示暂时没有启动成功，请稍后重试。", "The demo could not start. Please try again in a moment.")}</p><button type="button" onClick={() => void enter()} className="mt-3 font-semibold text-accent">{pick(language, "重新尝试", "Try again")}</button></div>}
        <Link href="/" className="mt-7 inline-block text-xs text-ink-muted hover:text-ink">← {pick(language, "返回项目介绍", "Back to the project")}</Link>
      </section>
    </main>
  );
}
