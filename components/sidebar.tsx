"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { pick, useLanguage } from "@/lib/language";
import { useMe } from "@/lib/use-me";
import { LanguageToggle } from "@/components/language-toggle";
import { AccountControl } from "@/components/topbar";

// Desktop navigation rail. The app's spine. One accent is spent here: the
// active item. Everything else stays in ink.

const NAV: { href: string; zh: string; en: string; icon: ReactNode }[] = [
  {
    href: "/today",
    zh: "今日建议",
    en: "Today",
    icon: <><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" /></>,
  },
  {
    href: "/planner",
    zh: "本周安排",
    en: "Planner",
    icon: <><rect x="4" y="5" width="16" height="15" rx="2.5" /><path d="M8 3v4M16 3v4M4 10h16" /></>,
  },
  {
    href: "/activities",
    zh: "我的活动",
    en: "Activities",
    icon: <path d="M3 12h4l2.5-6 4 12L16 12h5" />,
  },
  {
    href: "/explore",
    zh: "环境数据",
    en: "Explore",
    icon: <><circle cx="12" cy="12" r="9" /><path d="M3.6 9h16.8M3.6 15h16.8M12 3a14.5 14.5 0 0 1 0 18M12 3a14.5 14.5 0 0 0 0 18" /></>,
  },
  {
    href: "/advisor",
    zh: "环境问答",
    en: "Advisor",
    icon: <path d="M21 12a8 8 0 0 1-11.6 7.2L4 21l1.8-5.4A8 8 0 1 1 21 12Z" />,
  },
  {
    href: "/briefings",
    zh: "定时简报",
    en: "Briefings",
    icon: <><path d="M6 4h9l3 3v13H6z" /><path d="M9 9h6M9 13h6M9 17h4" /></>,
  },
  {
    href: "/profile",
    zh: "偏好设置",
    en: "Preferences",
    icon: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" /></>,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const language = useLanguage();
  const { me } = useMe();
  const live = me !== null;

  return (
    <aside className="hidden h-full w-60 shrink-0 flex-col p-4 pr-0 lg:flex">
      <div className="pane flex h-full min-h-0 flex-col p-3">
        <Link href="/today" className="flex flex-col gap-1 px-2 py-2" aria-label="AirAware">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-full.png" alt="AirAware" className="h-9 w-auto self-start" />
          <span className="text-[10px] font-medium text-ink-muted">
            {pick(language, "户外活动规划助手", "Outdoor day planner")}
          </span>
        </Link>

        <span className="mt-5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
          {pick(language, "菜单", "Menu")}
        </span>
        <nav className="mt-2 flex flex-col gap-1" aria-label={pick(language, "主导航", "Primary navigation")}>
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-accent/8 font-semibold text-accent"
                    : "font-medium text-ink-2 hover:bg-ink/5 hover:text-ink"
                }`}
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-accent"
                  />
                )}
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  className="size-[18px] shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {item.icon}
                </svg>
                {item[language]}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-3 border-t border-hairline pt-3">
          <span
            className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
              live ? "bg-good/10 text-good" : "border border-hairline text-ink-muted"
            }`}
          >
            <span aria-hidden className="inline-block size-1.5 rounded-full bg-current" />
            {live ? pick(language, "实时工作区", "Live workspace") : pick(language, "互动演示", "Interactive demo")}
          </span>
          <div className="flex items-center gap-2 px-1">
            <LanguageToggle />
            <span className="ml-auto">
              <AccountControl />
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
