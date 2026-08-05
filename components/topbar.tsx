"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { HOME as HOME_EN, TODAY } from "@/lib/mock.en";
import { HOME as HOME_ZH } from "@/lib/mock";
import { pick, useLanguage } from "@/lib/language";
import { supabase } from "@/lib/supabase";
import { useMe } from "@/lib/use-me";
import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";

const PRIMARY_NAV = [
  { href: "/today", zh: "今日建议", en: "Today" },
  { href: "/planner", zh: "本周安排", en: "Planner" },
  { href: "/activities", zh: "我的活动", en: "Activities" },
  { href: "/explore", zh: "环境数据", en: "Explore" },
  { href: "/advisor", zh: "环境问答", en: "Advisor" },
  { href: "/briefings", zh: "定时简报", en: "Briefings" },
] as const;

const MOBILE_NAV = [
  ...PRIMARY_NAV,
  { href: "/profile", zh: "偏好设置", en: "Preferences" },
] as const;

function formatDate(language: "zh" | "en") {
  return new Date(`${TODAY}T12:00:00`).toLocaleDateString(language === "en" ? "en-US" : "zh-CN", {
    weekday: "short",
    month: "long",
    day: "numeric",
  });
}

function Wordmark() {
  const language = useLanguage();
  return (
    <Link href="/today" className="flex shrink-0 items-center gap-2.5" aria-label="AirAware">
      <span className="flex size-8 items-center justify-center rounded-xl bg-accent shadow-[0_8px_24px_rgba(76,195,255,0.12)]">
        <svg aria-hidden viewBox="0 0 32 32" className="size-[18px]" fill="none" stroke="var(--accent-contrast)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12h14a4 4 0 1 0-4-6" />
          <path d="M4 20h20a4 4 0 1 1-4 6" />
        </svg>
      </span>
      <span className="leading-none">
        <span className="block text-[17px] font-semibold tracking-tight">AirAware</span>
        <span className="mt-1 hidden text-[10px] font-medium text-ink-muted 2xl:block">
          {pick(language, "更安心地安排户外活动", "Plan better time outdoors")}
        </span>
      </span>
    </Link>
  );
}

function AccountControl() {
  const language = useLanguage();
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  if (email === undefined) return <span aria-hidden className="size-8 rounded-full border border-hairline" />;

  if (email === null) {
    return (
      <Link href="/signin" className="btn-ghost h-8 gap-1.5 px-3 text-xs">
        <svg aria-hidden viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <circle cx="12" cy="8" r="4" />
          <path d="M5 21a7 7 0 0 1 14 0" />
        </svg>
        <span className="hidden sm:inline">{pick(language, "登录", "Sign in")}</span>
      </Link>
    );
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={pick(language, "账户菜单", "Account menu")} className="flex size-8 items-center justify-center rounded-full border border-hairline bg-surface text-xs font-semibold text-ink-2 hover:text-ink">
        {email.slice(0, 1).toUpperCase()}
      </button>
      {open && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" aria-label={pick(language, "关闭账户菜单", "Close account menu")} onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 w-64 rounded-2xl border border-hairline bg-surface p-2 shadow-2xl">
            <div className="truncate px-3 py-2 text-xs text-ink-muted">{email}</div>
            <Link href="/profile" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-ink/5 hover:text-ink">{pick(language, "偏好设置", "Preferences")}</Link>
            <button type="button" onClick={() => supabase.auth.signOut().then(() => window.location.assign("/"))} className="w-full rounded-lg px-3 py-2 text-left text-sm text-ink-2 hover:bg-ink/5 hover:text-ink">
              {pick(language, "退出登录", "Sign out")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function TopBar() {
  const pathname = usePathname();
  const language = useLanguage();
  const { me, loading } = useMe();
  const live = me !== null;
  const locationName = live ? me.homeLocation.name : pick(language, HOME_ZH.name, HOME_EN.name);

  return (
    <header className="relative z-30 shrink-0 border-b border-hairline bg-page/95 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Wordmark />
        <nav className="hidden min-w-0 flex-1 items-center gap-0.5 xl:flex" aria-label={pick(language, "主导航", "Primary navigation")}>
          {PRIMARY_NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`rounded-full px-3 py-2 text-sm font-medium transition-colors ${active ? "bg-ink/10 text-ink" : "text-ink-2 hover:bg-ink/5 hover:text-ink"}`}>
                {item[language]}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <span className="hidden items-center gap-1.5 text-xs text-ink-muted 2xl:flex">
            <svg aria-hidden viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
            <span className="font-medium text-ink-2">{loading ? "…" : locationName}</span>
            <span>· {formatDate(language)}</span>
          </span>
          <span className={`hidden rounded-full px-2.5 py-1 text-[11px] font-medium lg:inline-flex ${live ? "bg-good/10 text-good" : "border border-hairline text-ink-muted"}`}>
            {live ? pick(language, "实时工作区", "Live workspace") : pick(language, "互动演示", "Interactive demo")}
          </span>
          <LanguageToggle />
          <ThemeToggle />
          <Link href="/profile" aria-label={pick(language, "偏好设置", "Preferences")} aria-current={pathname === "/profile" ? "page" : undefined} className={`hidden size-8 items-center justify-center rounded-full border border-hairline sm:flex ${pathname === "/profile" ? "bg-ink/10 text-ink" : "text-ink-2 hover:bg-ink/5 hover:text-ink"}`}>
            <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" /></svg>
          </Link>
          <AccountControl />
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-hairline px-3 py-2 xl:hidden" aria-label={pick(language, "主导航", "Primary navigation")}>
        {MOBILE_NAV.map((item) => {
          const active = pathname === item.href;
          return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${active ? "bg-ink/10 font-medium text-ink" : "text-ink-2"}`}>{item[language]}</Link>;
        })}
      </nav>
    </header>
  );
}
