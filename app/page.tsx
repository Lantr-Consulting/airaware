"use client";

/* Marketing landing at "/". FORGE design language (matching lantr.site).
   The product lives behind it under /today etc. */

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
    hub: "Student showcase",
    signIn: "Sign in",
    openApp: "Try the demo",
    openDash: "Open your planner",
    badge: "Past Lantr student project · Hosted demo · General guidance",
    h1: "Plan outdoor time around the day’s UV, heat, air quality, and pollen.",
    subLead: "Add your city, schedule, and sensitivities. ",
    subEm: "AirAware checks each outdoor plan",
    subRest:
      " against live forecasts and public guidance from WHO, EPA, and NWS. When the conditions change, it helps you find a better time.",
    ctaPrimary: "Start a private demo",
    ctaSecondary: "Sign in",
    trust: [
      "Real forecasts from Open-Meteo",
      "Health bands from WHO, EPA & NWS guide each check",
      "Every suggestion shows its checks",
    ],
    frameCaption: "The student’s finished planner, using live environmental data.",
    featuresKicker: "What it does",
    featuresTitle: "A forecast you can plan around",
    features: [
      {
        t: "Built around your actual week",
        b: "Add the Tuesday run, the weekend hike, or the evening dog walk. AirAware checks the conditions for the time and place of each activity.",
      },
      {
        t: "Health guidance with sources",
        b: "UV, heat, air quality, and pollen are checked against published bands, including WHO UV levels, the NWS heat index, and EPA AQI breakpoints. The source appears beside each result.",
      },
      {
        t: "A practical plan for the day",
        b: "AirAware can keep an activity, move it, shorten it, take it indoors, suggest protection, or point out a better window. Every time slot remains editable.",
      },
      {
        t: "A fresh check before you save",
        b: "When you accept a suggestion, AirAware reads the latest forecast again. If the air quality or weather has worsened, it warns you and updates the plan.",
      },
      {
        t: "Feedback it can remember",
        b: "If a suggestion does not work, say why: “lunch is fixed” or “I hate treadmills,” for example. AirAware keeps that in mind for the next plan.",
      },
      {
        t: "Briefings for your schedule",
        b: "Set a morning or weekly briefing, and get an extra alert when conditions move into a new band. Each update focuses on the activities already on your calendar.",
      },
    ],
    howKicker: "How it works",
    howTitle: "Add your schedule and let the forecast shape the plan.",
    how: [
      {
        t: "Open your private demo",
        b: "A private sample schedule opens instantly, ready for you to change and explore.",
      },
      {
        t: "Tell it about you",
        b: "Add your home city, usual week, allergies, and sensitivities, then review the profile AirAware creates.",
      },
      {
        t: "It plans your day",
        b: "It checks each outdoor window against the forecast and shows the readings behind every suggestion.",
      },
      {
        t: "Keep the plan up to date",
        b: "Briefings arrive when you choose, plans refresh with the forecast, and your feedback shapes the next suggestion.",
      },
    ],
    hoodKicker: "How the student built it",
    hoodTitle: "The student started with one useful daily decision.",
    hoodBody:
      "A past Lantr student began by helping someone choose a better time for one outdoor activity. Live environmental data, planning tools, published health bands, user accounts, memory, and scheduled briefings were added as the project grew. Lantr now hosts the finished work for visitors to explore.",
    hoodLink: "Read the source on GitHub",
    whoKicker: "The student's direction",
    whoTitle: "A practical project built around environmental health.",
    whoBody:
      "The student wanted to know when environmental data becomes useful in an ordinary day. Answering that question brought public health, live forecasts, and software into the same product.",
    who: [
      {
        t: "Public Health & Pre-Med",
        b: "WHO UV bands, the NWS heat index, and EPA AQI thresholds become checks people can see and use.",
      },
      {
        t: "Environmental Science",
        b: "Live UV, air-quality, and pollen feeds become practical choices about timing and protection.",
      },
      {
        t: "Computer Science & AI",
        b: "The AI reads forecast tools and remembers feedback, while a separate rules layer handles the health-band checks.",
      },
    ],
    ctaTitle: "Check the best outdoor window in today’s forecast.",
    ctaBody: "No signup. Your schedule stays private and clears automatically after 24 hours.",
    footerDisclaimer:
      "A past Lantr student project, hosted by Lantr for demonstration. General guidance, not medical advice. Runs on real public forecasts.",
    footerLinks: "More from Lantr",
  },
  zh: {
    nav: { features: "主要功能", how: "使用流程", who: "作品方向" },
    hub: "往届作品",
    signIn: "登录",
    openApp: "互动体验",
    openDash: "打开活动安排",
    badge: "Lantr 往届学生作品 · 使用公开环境数据 · 不代替医疗建议",
    h1: "今天几点适合跑步？AirAware 会把天气、空气和你的日程放在一起看。",
    subLead: "告诉它你住在哪、这周怎么安排、对什么比较敏感，",
    subEm: "AirAware 会逐项检查你的户外安排",
    subRest:
      "，同时查看紫外线、气温、空气质量和花粉。预报有变化，安排也会跟着更新。",
    ctaPrimary: "开始专属演示",
    ctaSecondary: "登录账户",
    trust: [
      "使用公开环境预报数据",
      "健康分级写成明确规则",
      "每条建议都说明判断依据",
    ],
    frameCaption: "学生完成的产品界面：天气、空气质量和个人日程都放进同一个活动安排里。",
    featuresKicker: "学生做了什么",
    featuresTitle: "把天气预报放进你的日程里。",
    features: [
      {
        t: "围绕你真实的一周来安排",
        b: "把周二晨跑、周末远足或每天遛狗加进日程，产品会检查每项活动所在时间和地点的环境情况。",
      },
      {
        t: "每项判断都有依据",
        b: "紫外线、高温、空气质量和花粉都按照公开标准判断。WHO、NWS 和 EPA 的分级写进了规则，页面上也能看到出处。",
      },
      {
        t: "一键安排今天的户外活动",
        b: "产品会建议保留原计划、换时间、缩短时长、改到室内或增加防护。每一项安排都可以继续调整。",
      },
      {
        t: "确认前再查一次最新预报",
        b: "当你确认一项安排时，产品会重新读取最新数据。如果空气质量已经变差，它会提醒你并更新建议。",
      },
      {
        t: "不合适，可以说明原因",
        b: "如果某个建议不方便，可以告诉它原因，例如午休时间不能改。下次安排时，产品会把这些情况考虑进去。",
      },
      {
        t: "按时提醒，也会留意突然变化",
        b: "可以收到每天或每周的提醒；当环境指标进入新的等级时，产品也会结合你的日程发出提示。",
      },
    ],
    howKicker: "实际怎么用",
    howTitle: "填好日程，让最新预报帮你调整安排。",
    how: [
      {
        t: "直接进入专属演示",
        b: "无需注册，系统会立即准备一份可以修改的个人日程和环境偏好。",
      },
      {
        t: "告诉它你的情况",
        b: "填写所在城市、每周安排、过敏情况和特别在意的环境因素，确认无误后保存。",
      },
      {
        t: "生成当天安排",
        b: "产品会逐段检查当天的户外时间，并说明每项建议依据了哪些数据。",
      },
      {
        t: "根据变化及时调整",
        b: "预报变化后可以重新安排；你提出的不便和偏好，也会在下次计划中得到考虑。",
      },
    ],
    hoodKicker: "作品是怎么完成的",
    hoodTitle: "学生从一天里最实用的选择开始做。",
    hoodBody:
      "这位 Lantr 往届学生最先解决的问题很具体：帮用户为一项户外活动选个更合适的时间。随着项目推进，公开环境数据、个人日程、判断规则、用户账户和定时提醒陆续加入。课程结束后，Lantr 继续托管这件作品，供访客体验。",
    hoodLink: "在 GitHub 阅读源码",
    whoKicker: "学生为什么选择这个题目",
    whoTitle: "这个项目把环境健康落到了每天的安排里。",
    whoBody:
      "学生想知道，实时预报怎样才能真正帮人决定几点出门。于是，公开标准、环境数据和个人日程被放进了同一套产品。",
    who: [
      {
        t: "公共卫生与医学预科",
        b: "把紫外线、体感温度和空气质量标准写成用户看得见的检查结果。",
      },
      {
        t: "环境科学",
        b: "处理紫外线、空气质量和花粉等公开数据，再把它们转成清楚的行动建议。",
      },
      {
        t: "计算机与人工智能",
        b: "让 AI 调用天气工具、记住用户偏好，同时用明确规则保证每项判断有据可查。",
      },
    ],
    ctaTitle: "看看今天什么时候更适合出门。",
    ctaBody: "无需注册，所有修改只有你能看到，并会在 24 小时后自动清除。",
    footerDisclaimer:
      "Lantr 往届学生作品，由 Lantr 继续托管。内容根据公开预报数据生成，只供日常参考，不代替医疗建议。",
    footerLinks: "更多学生作品",
  },
} as const;

/* The AirAware mark. Wind glyph on the sky-blue chip (matches the app icon). */
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

/* A stylized still of the product. The sky-dark planner inside a window frame. */
function ProductFrame({ lang }: { lang: Lang }) {
  const zh = lang === "zh";
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
            {zh ? "今天 · 奥斯汀" : "Today · Austin"}
          </div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-[#eef4fb]">
            36°C{" "}
            <span className="text-base font-medium text-[#7d8ea3]">
              {zh ? "体感温度" : "feels like"}
            </span>
          </div>
          <div className="mt-1 text-sm font-medium text-[#4cc3ff]">
            {zh ? "建议时间：上午 7:00, 9:00" : "Best window: 7:00 – 9:00 AM"}
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
              [zh ? "紫外线 8 · 高" : "UV 8 · High", "#ff9f5a"],
              [zh ? "空气质量 62 · 良" : "AQI 62 · Moderate", "#ffd166"],
              [zh ? "花粉 6.7 · 中等" : "Pollen 6.7 · Med", "#ffd166"],
              [zh ? "高温 · 注意" : "Heat · Caution", "#ff9f5a"],
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
            {zh ? "今天的活动安排" : "Plan for today"}
          </div>
          <div className="mt-3 rounded-xl bg-[#182338] p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-[#eef4fb]">
                {zh ? "晨跑" : "Morning run"}
              </span>
              <span className="lp-mono text-[12px] text-[#a9b8cb]">
                {zh ? "调整到上午 7:00, 7:45" : "shift → 7:00 – 7:45 AM"}
              </span>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-[#a9b8cb]">
              {zh
                ? "早点出门可以避开紫外线和高温时段。花粉浓度仍然偏高，记得做好平时使用的防护。"
                : "Going earlier avoids the highest UV and heat. Pollen remains elevated, so follow your usual protection plan."}
            </p>
            <ul className="mt-3 space-y-1.5">
              {[
                ["ok", zh ? "上午 9 点前紫外线较低" : "UV below caution before 9 AM"],
                ["ok", zh ? "空气质量中等，可以正常活动" : "AQI moderate. Intensity OK"],
                ["warn", zh ? "花粉浓度中等，注意草类过敏" : "Pollen medium. Grass allergy"],
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
                {zh ? "采用" : "Accept"}
              </span>
              <span className="inline-flex flex-1 items-center justify-center rounded-full border border-white/15 px-3 py-1.5 text-[12px] font-medium text-[#a9b8cb]">
                {zh ? "暂不采用" : "Decline"}
              </span>
            </div>
          </div>
          <p className="lp-mono mt-3 text-[10px] leading-relaxed text-[#5b6a7e]">
            {zh ? "只供日常参考，不代替医疗建议。" : "General guidance. Not medical advice."}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const [lang, setLang] = useState<Lang>("zh");
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const languageTimer = window.setTimeout(() => {
      const requestedLanguage = new URLSearchParams(window.location.search).get("lang");
      const savedLanguage = requestedLanguage === "en" || requestedLanguage === "zh"
        ? requestedLanguage
        : readLang();
      if (requestedLanguage === "en" || requestedLanguage === "zh") persistLang(savedLanguage);
      setLang(savedLanguage);
      document.documentElement.lang = savedLanguage === "zh" ? "zh-CN" : "en";
    }, 0);
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(Boolean(data.session));
    });
    return () => window.clearTimeout(languageTimer);
  }, []);

  function switchLang(next: Lang) {
    setLang(next);
    persistLang(next);
    const url = new URL(window.location.href);
    url.searchParams.set("lang", next);
    window.history.replaceState(null, "", url);
    document.documentElement.lang = next === "zh" ? "zh-CN" : "en";
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
              href={lang === "en" ? "https://lantr.site/en" : "https://lantr.site"}
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
                <Link href="/demo" className="lp-btn h-9 px-4 text-[13px]">
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
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-5 pb-16 pt-16 sm:px-8 sm:pt-20 lg:grid-cols-[0.95fr_1.05fr] lg:gap-12 lg:pb-20">
          <div>
            <Reveal>
              <span className="lp-mono inline-flex items-center gap-2 rounded-full border border-[var(--lp-line-strong)] bg-[var(--lp-surface)] px-4 py-2 text-[11px] font-medium text-[var(--lp-muted)]">
                <span aria-hidden className="size-1.5 rounded-full bg-[var(--lp-accent)]" />
                {c.badge}
              </span>
            </Reveal>
            <h1 className="lp-display mt-7 max-w-3xl text-balance text-[2.6rem] font-normal leading-[1.04] tracking-[-0.02em] text-[var(--lp-fg)] sm:text-[4rem] lg:text-[3.8rem]">
              <Words text={c.h1} delay={120} />
            </h1>
            <Reveal delay={200}>
              <p className="mt-7 max-w-xl text-pretty text-base leading-relaxed text-[var(--lp-muted)] sm:text-lg">
                {c.subLead}
                <em className="lp-display italic text-[var(--lp-ink)]">{c.subEm}</em>
                {c.subRest}
              </p>
            </Reveal>
            <Reveal delay={280}>
              <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row">
                <Link href="/demo" className="lp-btn h-12 px-6 text-[15px]">
                  {c.ctaPrimary} →
                </Link>
                <Link href="/signin" className="lp-btn-ghost h-12 px-6 text-[15px]">
                  {c.ctaSecondary}
                </Link>
              </div>
            </Reveal>
            <Reveal delay={360}>
              <div className="mt-8 grid gap-2 text-[13px] text-[var(--lp-muted)]">
                {c.trust.map((t) => (
                  <span key={t} className="flex items-center gap-2">
                    <span aria-hidden className="h-1 w-1 rounded-full bg-[var(--lp-accent)]" />
                    {t}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>
          <Reveal delay={360} className="min-w-0 lg:-mr-14">
            <ProductFrame lang={lang} />
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
                <Link href="/demo" className="lp-btn h-12 px-6 text-[15px]">
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
                    <a
                      href={lang === "en" ? "https://lantr.site/en" : "https://lantr.site"}
                      className="hover:text-[var(--lp-fg)]"
                    >
                      lantr.site. {lang === "en" ? "student showcase" : "学生作品展"}
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
