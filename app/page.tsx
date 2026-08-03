"use client";

/* Marketing landing at "/" — FORGE design language (matching lantr.site),
   bilingual EN/中文. The product lives behind it under /today etc. */

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  ColumnRules,
  LangToggle,
  persistLang,
  readLang,
  Reveal,
  Words,
  type Lang,
} from "@/components/landing/kit";

const COPY = {
  en: {
    nav: { features: "Features", how: "How it works", who: "Who it's for" },
    hub: "All demos",
    signIn: "Sign in",
    openApp: "Open the demo",
    openDash: "Open your planner",
    badge: "A Lantr sample project · General guidance, not medical advice",
    h1: "An advisor that plans your week around the air outside.",
    subLead: "Tell it your schedule, your city, your sensitivities. ",
    subEm: "It plans your week around the sky",
    subRest:
      " — reading real forecasts for UV, heat, air quality, and pollen, scoring every outdoor window against cited WHO, EPA & NWS health bands, and re-planning when conditions change.",
    ctaPrimary: "Explore the live demo",
    ctaSecondary: "Create a free account",
    trust: [
      "Real forecasts from Open-Meteo",
      "Health bands from WHO, EPA & NWS — enforced in code",
      "Every suggestion shows its checks",
    ],
    frameCaption: "The product: a sky-dark planner on real atmospheric data.",
    featuresKicker: "What it does",
    featuresTitle: "A planner that reads the sky.",
    features: [
      {
        t: "Your week, not a generic forecast",
        b: "It knows your schedule and your activities — the Tuesday run, the weekend hike — and plans around them, instead of handing you the same forecast as everyone else.",
      },
      {
        t: "Cited health bands",
        b: "UV, heat, air quality, and pollen are scored by a deterministic exposure engine — WHO UV bands, NWS heat index, EPA AQI breakpoints — in pure code with citable sources. The LLM narrates; the code decides.",
      },
      {
        t: "Plan my day",
        b: "One tap files a full day plan: keep, shift, shorten, relocate, move indoors, add gear, or claim a good window — each with an editable time slot.",
      },
      {
        t: "Accepting re-checks reality",
        b: "When you accept an item, it re-validates against the latest forecast first. If air quality worsened since the plan was made, you get a warning — not a stale promise.",
      },
      {
        t: "Declining teaches it",
        b: "Decline with a reason — “lunch is fixed”, “I hate treadmills” — and the next plan reads your lessons before it drafts.",
      },
      {
        t: "Briefings while you sleep",
        b: "Scheduled morning and weekly briefings, plus on-change alerts when conditions cross into a new band — written for your day, not a city of millions.",
      },
    ],
    howKicker: "How it works",
    howTitle: "Four steps, one loop.",
    how: [
      {
        t: "Create an account",
        b: "Your advisor starts blank and inactive. A three-step welcome walks you through activating it.",
      },
      {
        t: "Tell it about you",
        b: "Allergies, sensitivities, home city, weekly rhythm — described in your words, interpreted into a profile you approve.",
      },
      {
        t: "It plans your day",
        b: "It checks every window of your day against the forecast and files a plan with its checks laid out in the open.",
      },
      {
        t: "It keeps watch",
        b: "Briefings arrive on schedule, plans refresh when conditions change, and your declines become its lessons.",
      },
    ],
    hoodKicker: "Under the hood",
    hoodTitle: "Built milestone by milestone.",
    hoodBody:
      "First ship, design pass, brain, hands, memory, autonomy — built in the exact order Lantr students build theirs, with every milestone a public tag on GitHub.",
    hoodLink: "Read the source on GitHub",
    whoKicker: "Who it's for",
    whoTitle: "The health & environment track sample.",
    whoBody:
      "Lantr students build a project aimed at their intended major. This one shows what the health-and-environment direction looks like when it ships.",
    who: [
      {
        t: "Public Health & Pre-Med",
        b: "Exposure science with real thresholds — WHO UV bands, NWS heat index, EPA AQI — implemented in code, not just cited in a paper.",
      },
      {
        t: "Environmental Science",
        b: "Live atmospheric data pipelines — UV, air quality, pollen — turned into decisions people can act on.",
      },
      {
        t: "Computer Science & AI",
        b: "A tool-using LLM agent with memory, feedback loops, and a deterministic guardrail layer — the architecture serious AI products use.",
      },
    ],
    ctaTitle: "See what today looks like, outside.",
    ctaBody: "Sign in once and you're signed in across every Lantr demo.",
    footerDisclaimer:
      "General guidance, not medical advice. Runs on real public forecasts. Built as a Lantr sample project.",
    footerLinks: "More from Lantr",
  },
  zh: {
    nav: { features: "功能", how: "运作方式", who: "适合谁" },
    hub: "全部演示",
    signIn: "登录",
    openApp: "进入演示",
    openDash: "打开我的规划台",
    badge: "Lantr 示范项目 · 一般性建议，非医疗建议",
    h1: "一位懂天气、更懂你的户外健康顾问。",
    subLead: "告诉它你的日程、城市和过敏源，",
    subEm: "它围绕室外的空气规划你的一周",
    subRest:
      "——阅读紫外线、高温、空气质量、花粉的真实预报，用 WHO、EPA、NWS 的健康分级为每个户外时段打分；天气一变，计划随之更新。",
    ctaPrimary: "进入在线演示",
    ctaSecondary: "免费创建账户",
    trust: [
      "真实预报数据来自 Open-Meteo",
      "WHO、EPA、NWS 健康分级，由代码强制执行",
      "每条建议都亮出它通过的检查",
    ],
    frameCaption: "产品实况：深色天空主题的规划工作台，接入真实大气数据。",
    featuresKicker: "它能做什么",
    featuresTitle: "一位会看天的规划师。",
    features: [
      {
        t: "规划你的一周，而不是播报天气",
        b: "它了解你的日程和活动——周二的晨跑、周末的远足——并围绕它们做规划，而不是递给你一份人人相同的天气预报。",
      },
      {
        t: "有出处的健康分级",
        b: "紫外线、高温、空气质量、花粉，都由确定性暴露引擎打分——WHO 紫外线分级、NWS 体感温度、EPA AQI 断点——全部写在代码里，每一条都有出处。模型负责解释，代码负责决定。",
      },
      {
        t: "一键规划今天",
        b: "轻轻一点，生成整天的计划：保持、挪时间、缩短、换地点、改室内、加装备，或抢占一个好时段——每一项的时间都可以再调整。",
      },
      {
        t: "接受前，先复核现实",
        b: "你点下接受时，它会先用最新预报重新校验。如果空气质量在计划生成后变差了，你得到的是提醒，而不是一句过期的承诺。",
      },
      {
        t: "拒绝也是在教它",
        b: "写明理由再拒绝——“午餐时间动不了”“我讨厌跑步机”——下一次规划前，它会先读完你的这些经验。",
      },
      {
        t: "你还没醒，简报已到",
        b: "定时的早间与每周简报，加上条件跨入新分级时的即时提醒——为你的一天而写，不是为一座城市。",
      },
    ],
    howKicker: "运作方式",
    howTitle: "四个步骤，一个闭环。",
    how: [
      {
        t: "创建账户",
        b: "你的顾问从一张白纸开始。三步欢迎流程，引导你完成激活。",
      },
      {
        t: "介绍你自己",
        b: "过敏源、敏感项、常驻城市、每周节奏——用你的话描述，由它整理成档案，经你确认。",
      },
      {
        t: "它规划你的一天",
        b: "它对照预报检查你一天中的每个时段，交出一份把所有检查都摆在明面上的计划。",
      },
      {
        t: "它持续守望",
        b: "简报按时送达，天气一变计划就刷新，你的每次拒绝都成为它的经验。",
      },
    ],
    hoodKicker: "技术底层",
    hoodTitle: "按里程碑逐步构建。",
    hoodBody:
      "首次上线、设计打磨、大脑、双手、记忆、自主运行——与 Lantr 学员的构建路径完全一致，每个里程碑都是 GitHub 上公开的 tag。",
    hoodLink: "在 GitHub 阅读源码",
    whoKicker: "适合谁",
    whoTitle: "健康与环境方向的示范作品。",
    whoBody:
      "Lantr 学员会围绕自己的目标专业打造项目。这个项目展示了健康与环境方向做出来是什么样子。",
    who: [
      {
        t: "公共卫生与医学预科",
        b: "真实阈值下的暴露科学——WHO 紫外线分级、NWS 体感温度、EPA AQI——不是论文里的引用，而是写成了代码。",
      },
      {
        t: "环境科学",
        b: "实时大气数据管线——紫外线、空气质量、花粉——变成人们可以执行的决定。",
      },
      {
        t: "计算机与人工智能",
        b: "一个会调用工具的 LLM 智能体：记忆、反馈闭环、确定性护栏层——正经 AI 产品的架构。",
      },
    ],
    ctaTitle: "看看今天的室外，适合做什么。",
    ctaBody: "登录一次，即可通行所有 Lantr 演示项目。",
    footerDisclaimer:
      "一般性建议，非医疗建议。基于公开真实预报数据。Lantr 示范项目。",
    footerLinks: "更多 Lantr 项目",
  },
} as const;

/* The AirAware mark — wind glyph on the sky-blue chip (matches the app icon). */
function Mark({ size = 8 }: { size?: 7 | 8 }) {
  return (
    <span
      className={`flex ${size === 8 ? "size-8" : "size-7"} items-center justify-center rounded-lg bg-[#4cc3ff]`}
    >
      <svg
        aria-hidden
        viewBox="0 0 32 32"
        className={size === 8 ? "size-4.5" : "size-4"}
        fill="none"
        stroke="#04121c"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 12h14a4 4 0 1 0-4-6" />
        <path d="M4 20h20a4 4 0 1 1-4 6" />
      </svg>
    </span>
  );
}

/* A stylized still of the product — the sky-dark planner inside a window frame. */
function ProductFrame() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--lp-line-strong)] bg-[#0d1420] text-left shadow-[0_1px_2px_rgba(30,28,23,0.06),0_40px_80px_-40px_rgba(30,28,23,0.4)]">
      {/* window chrome */}
      <div className="flex items-center gap-1.5 border-b border-white/[0.07] px-4 py-3">
        <span className="size-2.5 rounded-full bg-[#2c3a4d]" />
        <span className="size-2.5 rounded-full bg-[#2c3a4d]" />
        <span className="size-2.5 rounded-full bg-[#2c3a4d]" />
        <span className="lp-mono ml-3 text-[11px] text-[#7d8ea3]">
          airaware.lantr.site
        </span>
      </div>
      <div className="grid gap-px bg-white/[0.06] md:grid-cols-[1.4fr_1fr]">
        {/* today pane */}
        <div className="bg-[#0d1420] p-5 sm:p-6">
          <div className="lp-mono text-[10px] uppercase tracking-[0.14em] text-[#7d8ea3]">
            Today · Austin
          </div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-[#eef4fb]">
            96°F{" "}
            <span className="text-base font-medium text-[#7d8ea3]">
              feels like
            </span>
          </div>
          <div className="mt-1 text-sm font-medium text-[#4cc3ff]">
            Best window: 7:00 – 9:00 AM
          </div>
          <svg
            viewBox="0 0 300 80"
            className="mt-4 h-20 w-full"
            preserveAspectRatio="none"
            aria-hidden
          >
            <defs>
              <linearGradient id="lpsky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4cc3ff" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#4cc3ff" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0,58 C30,54 55,44 85,34 S140,14 170,12 S225,22 255,38 S285,52 300,56 L300,80 L0,80 Z"
              fill="url(#lpsky)"
            />
            <path
              d="M0,58 C30,54 55,44 85,34 S140,14 170,12 S225,22 255,38 S285,52 300,56"
              fill="none"
              stroke="#4cc3ff"
              strokeWidth="2"
            />
            <line
              x1="100"
              y1="6"
              x2="100"
              y2="76"
              stroke="#7d8ea3"
              strokeWidth="1"
              strokeDasharray="3 4"
            />
          </svg>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              ["UV 8 · High", "#ff9f5a"],
              ["AQI 62 · Moderate", "#ffd166"],
              ["Pollen 6.7 · Med", "#ffd166"],
              ["Heat · Caution", "#ff9f5a"],
            ].map(([label, color]) => (
              <span
                key={label as string}
                className="lp-mono rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-medium"
                style={{ color: color as string }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
        {/* plan pane */}
        <div className="bg-[#111a29] p-5 sm:p-6">
          <div className="lp-mono text-[10px] uppercase tracking-[0.14em] text-[#7d8ea3]">
            Plan for today
          </div>
          <div className="mt-3 rounded-xl bg-[#182338] p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-[#eef4fb]">
                Morning run
              </span>
              <span className="lp-mono text-[12px] text-[#a9b8cb]">
                shift → 7:00 – 7:45 AM
              </span>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-[#a9b8cb]">
              Beat the UV peak and the heat — the early window clears every
              check except pollen, so take your antihistamine.
            </p>
            <ul className="mt-3 space-y-1.5">
              {[
                ["ok", "UV below caution before 9 AM"],
                ["ok", "AQI moderate — intensity OK"],
                ["warn", "Pollen medium — grass allergy"],
              ].map(([kind, c]) => (
                <li
                  key={c}
                  className="flex items-center gap-2 text-[11px] text-[#7d8ea3]"
                >
                  {kind === "ok" ? (
                    <svg
                      viewBox="0 0 12 12"
                      className="size-3 text-[#35d07f]"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M2 6.5 4.5 9 10 3.5" />
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 12 12"
                      className="size-3 text-[#ffd166]"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M6 1.5 11 10.5H1L6 1.5Z" />
                      <path d="M6 5v2.5M6 9.2v.1" />
                    </svg>
                  )}
                  {c}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex gap-2">
              <span className="inline-flex flex-1 items-center justify-center rounded-full bg-[#4cc3ff] px-3 py-1.5 text-[12px] font-semibold text-[#04121c]">
                Accept
              </span>
              <span className="inline-flex flex-1 items-center justify-center rounded-full border border-white/15 px-3 py-1.5 text-[12px] font-medium text-[#a9b8cb]">
                Decline
              </span>
            </div>
          </div>
          <p className="lp-mono mt-3 text-[10px] leading-relaxed text-[#5b6a7e]">
            General guidance — not medical advice.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const [lang, setLang] = useState<Lang>("en");
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    setLang(readLang());
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(Boolean(data.session));
    });
  }, []);

  function switchLang(l: Lang) {
    setLang(l);
    persistLang(l);
  }

  const c = COPY[lang];

  return (
    <div className="forge min-h-screen">
      {/* ── nav ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-[var(--lp-line)] bg-[color-mix(in_oklab,var(--lp-bg)_86%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-5 px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <Mark />
            <span className="text-[15px] font-semibold tracking-tight text-[var(--lp-fg)]">
              AirAware
            </span>
          </Link>
          <nav className="ml-4 hidden items-center gap-5 text-sm text-[var(--lp-muted)] md:flex">
            <a href="#features" className="transition-colors hover:text-[var(--lp-fg)]">
              {c.nav.features}
            </a>
            <a href="#how" className="transition-colors hover:text-[var(--lp-fg)]">
              {c.nav.how}
            </a>
            <a href="#who" className="transition-colors hover:text-[var(--lp-fg)]">
              {c.nav.who}
            </a>
            <a
              href="https://lantr.site"
              className="transition-colors hover:text-[var(--lp-fg)]"
            >
              {c.hub} ↗
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-2.5">
            <LangToggle lang={lang} onChange={switchLang} />
            {signedIn ? (
              <Link href="/today" className="lp-btn h-9 px-4 text-[13px]">
                {c.openDash}
              </Link>
            ) : (
              <>
                <Link
                  href="/signin"
                  className="lp-btn-ghost hidden h-9 px-4 text-[13px] sm:inline-flex"
                >
                  {c.signIn}
                </Link>
                <Link href="/today" className="lp-btn h-9 px-4 text-[13px]">
                  {c.openApp}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── hero ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <ColumnRules />
        <div className="relative mx-auto w-full max-w-6xl px-5 pb-16 pt-16 text-center sm:px-8 sm:pt-24">
          <Reveal>
            <span className="lp-mono inline-flex items-center gap-2 rounded-full border border-[var(--lp-line-strong)] bg-[var(--lp-surface)] px-4 py-2 text-[11px] font-medium text-[var(--lp-muted)]">
              <span aria-hidden className="size-1.5 rounded-full bg-[var(--lp-accent)]" />
              {c.badge}
            </span>
          </Reveal>
          <h1 className="lp-display mx-auto mt-7 max-w-3xl text-balance text-[2.5rem] font-normal leading-[1.07] tracking-[-0.015em] text-[var(--lp-fg)] sm:text-[3.9rem]">
            <Words text={c.h1} delay={120} />
          </h1>
          <Reveal delay={200}>
            <p className="mx-auto mt-7 max-w-2xl text-pretty text-base leading-relaxed text-[var(--lp-muted)] sm:text-lg">
              {c.subLead}
              <em className="lp-display italic text-[var(--lp-ink)]">{c.subEm}</em>
              {c.subRest}
            </p>
          </Reveal>
          <Reveal delay={280}>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/today" className="lp-btn h-12 px-6 text-[15px]">
                {c.ctaPrimary} →
              </Link>
              <Link href="/signin" className="lp-btn-ghost h-12 px-6 text-[15px]">
                {c.ctaSecondary}
              </Link>
            </div>
          </Reveal>
          <Reveal delay={360}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-[13px] text-[var(--lp-muted)]">
              {c.trust.map((t) => (
                <span key={t} className="flex items-center gap-2">
                  <span aria-hidden className="h-1 w-1 rounded-full bg-[var(--lp-accent)]" />
                  {t}
                </span>
              ))}
            </div>
          </Reveal>
          <Reveal delay={440} className="mx-auto mt-12 max-w-4xl">
            <ProductFrame />
            <p className="lp-mono mt-3 text-[11px] text-[var(--lp-faint)]">
              {c.frameCaption}
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── features ─────────────────────────────────────── */}
      <section id="features" className="border-t border-[var(--lp-line)] bg-[var(--lp-bg2)]">
        <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
          <Reveal>
            <div className="lp-mono text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--lp-accent)]">
              {c.featuresKicker}
            </div>
            <h2 className="lp-display mt-3 max-w-xl text-3xl font-normal tracking-tight text-[var(--lp-fg)] sm:text-4xl">
              {c.featuresTitle}
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {c.features.map((f, i) => (
              <Reveal key={f.t} delay={i * 70}>
                <div className="lp-card lp-lift h-full rounded-2xl p-6">
                  <div className="lp-mono text-[11px] text-[var(--lp-faint)]">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3 className="mt-3 text-[15px] font-semibold tracking-tight text-[var(--lp-fg)]">
                    {f.t}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--lp-muted)]">
                    {f.b}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── how it works ─────────────────────────────────── */}
      <section id="how" className="border-t border-[var(--lp-line)]">
        <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
          <Reveal>
            <div className="lp-mono text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--lp-accent)]">
              {c.howKicker}
            </div>
            <h2 className="lp-display mt-3 text-3xl font-normal tracking-tight text-[var(--lp-fg)] sm:text-4xl">
              {c.howTitle}
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {c.how.map((s, i) => (
              <Reveal key={s.t} delay={i * 90}>
                <div className="relative h-full rounded-2xl border border-[var(--lp-line)] bg-[var(--lp-surface)] p-6">
                  <div className="lp-display text-3xl italic text-[var(--lp-accent)]">
                    {i + 1}
                  </div>
                  <h3 className="mt-3 text-[15px] font-semibold tracking-tight text-[var(--lp-fg)]">
                    {s.t}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--lp-muted)]">
                    {s.b}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* under the hood strip */}
          <Reveal delay={120}>
            <div className="lp-card mt-12 rounded-2xl p-7 sm:p-9">
              <div className="lp-mono text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--lp-accent)]">
                {c.hoodKicker}
              </div>
              <div className="mt-3 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                <div className="max-w-xl">
                  <h3 className="lp-display text-2xl font-normal tracking-tight text-[var(--lp-fg)]">
                    {c.hoodTitle}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--lp-muted)]">
                    {c.hoodBody}
                  </p>
                  <a
                    href="https://github.com/Lantr-Consulting/airaware"
                    className="mt-3 inline-block text-sm font-medium text-[var(--lp-accent)] hover:text-[var(--lp-accent-ink)]"
                  >
                    {c.hoodLink} →
                  </a>
                </div>
                <div className="flex max-w-sm flex-wrap gap-1.5">
                  {[
                    "Next.js",
                    "Tailwind",
                    "FastAPI",
                    "LangChain",
                    "DeepSeek",
                    "Open-Meteo",
                    "CAMS & Pollen.com",
                    "Supabase",
                    "Railway",
                    "Vercel",
                  ].map((t) => (
                    <span
                      key={t}
                      className="lp-mono rounded-full border border-[var(--lp-line-strong)] px-3 py-1 text-[11px] text-[var(--lp-muted)]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── who it's for ─────────────────────────────────── */}
      <section id="who" className="border-t border-[var(--lp-line)] bg-[var(--lp-bg2)]">
        <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
          <Reveal>
            <div className="lp-mono text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--lp-accent)]">
              {c.whoKicker}
            </div>
            <h2 className="lp-display mt-3 text-3xl font-normal tracking-tight text-[var(--lp-fg)] sm:text-4xl">
              {c.whoTitle}
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--lp-muted)]">
              {c.whoBody}
            </p>
          </Reveal>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {c.who.map((w, i) => (
              <Reveal key={w.t} delay={i * 90}>
                <div className="lp-card lp-lift h-full rounded-2xl border-t-2 border-t-[var(--lp-accent)] p-6">
                  <h3 className="text-[15px] font-semibold tracking-tight text-[var(--lp-fg)]">
                    {w.t}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--lp-muted)]">
                    {w.b}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── final CTA + footer (the single dark band) ────── */}
      <section className="lp-scene">
        <div className="mx-auto w-full max-w-6xl px-5 pb-10 pt-20 sm:px-8">
          <div className="text-center">
            <Reveal>
              <h2 className="lp-display mx-auto max-w-2xl text-balance text-3xl font-normal tracking-tight text-[var(--lp-fg)] sm:text-4xl">
                {c.ctaTitle}
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--lp-muted)]">
                {c.ctaBody}
              </p>
            </Reveal>
            <Reveal delay={140}>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href="/today" className="lp-btn h-12 px-6 text-[15px]">
                  {c.ctaPrimary} →
                </Link>
                <Link
                  href="/signin"
                  className="lp-btn-ghost h-12 border-[var(--lp-line-strong)] bg-transparent px-6 text-[15px] text-[var(--lp-fg)]"
                >
                  {c.ctaSecondary}
                </Link>
              </div>
            </Reveal>
          </div>
          <footer className="mt-16 border-t border-[var(--lp-line)] pt-8">
            <div className="flex flex-col justify-between gap-6 md:flex-row">
              <div className="max-w-md">
                <div className="flex items-center gap-2.5">
                  <Mark size={7} />
                  <span className="text-sm font-semibold text-[var(--lp-fg)]">
                    AirAware
                  </span>
                </div>
                <p className="mt-3 text-[12px] leading-relaxed text-[var(--lp-faint)]">
                  {c.footerDisclaimer}
                </p>
              </div>
              <div>
                <div className="lp-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--lp-faint)]">
                  {c.footerLinks}
                </div>
                <ul className="mt-3 space-y-1.5 text-[13px] text-[var(--lp-muted)]">
                  <li>
                    <a href="https://lantr.site" className="hover:text-[var(--lp-fg)]">
                      lantr.site — demo hub
                    </a>
                  </li>
                  <li>
                    <a href="https://analyst.lantr.site" className="hover:text-[var(--lp-fg)]">
                      AI Stock Analyst
                    </a>
                  </li>
                  <li>
                    <a href="https://postpilot.lantr.site" className="hover:text-[var(--lp-fg)]">
                      PostPilot
                    </a>
                  </li>
                  <li>
                    <a href="https://lantr.ai" className="hover:text-[var(--lp-fg)]">
                      lantr.ai
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://github.com/Lantr-Consulting/airaware"
                      className="hover:text-[var(--lp-fg)]"
                    >
                      GitHub
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </footer>
        </div>
      </section>
    </div>
  );
}
