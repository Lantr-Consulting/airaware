"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui";
import { chat, getThreadMessages, getThreads, getTodayPlan } from "@/lib/api";
import { dayScoreTone } from "@/lib/bands";
import { ADVISOR, HOME, MESSAGES, PLAN_RUNS, THREADS } from "@/lib/mock";
import { useMe } from "@/lib/use-me";
import type { DayPlan, Message, Thread } from "@/lib/types";

// Minimal bold + bullet rendering for messages.
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, li) => {
        const bullet = line.startsWith("- ");
        const body = bullet ? line.slice(2) : line;
        return (
          <p key={li} className={`${li > 0 ? "mt-2" : ""} ${bullet ? "flex gap-2" : ""}`}>
            {bullet && <span aria-hidden className="text-accent">•</span>}
            <span>
              {body.split("**").map((part, pi) =>
                pi % 2 === 1 ? (
                  <strong key={pi} className="font-semibold text-ink">
                    {part}
                  </strong>
                ) : (
                  <span key={pi}>{part}</span>
                )
              )}
            </span>
          </p>
        );
      })}
    </>
  );
}

function Bubble({ msg }: { msg: Message }) {
  const mine = msg.role === "user";
  return (
    <div
      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
        mine ? "self-end bg-accent text-accent-contrast" : "self-start bg-surface text-ink-2"
      }`}
      style={{ animation: "msg-in 0.15s ease" }}
    >
      <Rich text={msg.content} />
    </div>
  );
}

export default function AdvisorPage() {
  const { me, loading: meLoading } = useMe();
  // Sample mode (signed out)
  const [mockThreadId, setMockThreadId] = useState(THREADS[0].id);
  // Live mode: persistent threads from the backend
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null); // null = new conversation
  const [dbMsgs, setDbMsgs] = useState<Message[]>([]);
  const [extra, setExtra] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [livePlan, setLivePlan] = useState<DayPlan | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const live = me !== null;
  const signedOut = !meLoading && me === null;

  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    getThreads().then((t) => !cancelled && setThreads(t)).catch(() => {});
    getTodayPlan().then((p) => !cancelled && setLivePlan(p)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [me]);

  useEffect(() => {
    if (!me || activeId === null) return;
    let cancelled = false;
    getThreadMessages(activeId)
      .then((ms) => {
        if (cancelled) return;
        setDbMsgs(ms as Message[]);
        setExtra([]); // the DB now holds what we sent optimistically
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [me, activeId]);

  const greeting: Message[] =
    live && activeId === null
      ? [
          {
            id: "greet",
            threadId: "new",
            role: "assistant",
            content: `你好！我可以查看 **${me.homeLocation.name}** 的实时环境、你的个人提醒线和今日安排。可以问我活动时段、装备准备或空气质量。`,
            createdAt: "",
          },
        ]
      : [];

  const messages = live
    ? [...greeting, ...(activeId === null ? [] : dbMsgs), ...extra]
    : [
        ...MESSAGES.filter((m) => m.threadId === mockThreadId),
        ...extra.filter((m) => m.threadId === mockThreadId),
      ];

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, thinking]);

  function openThread(id: string | null) {
    setActiveId(id);
    setExtra([]);
    if (id === null) setDbMsgs([]);
  }

  async function send(preset?: string) {
    const text = (preset ?? draft).trim();
    if (!text || thinking) return;
    const tid = live ? (activeId ?? "new") : mockThreadId;
    const mine: Message = { id: `x${extra.length}-u`, threadId: tid, role: "user", content: text, createdAt: "" };
    setExtra((xs) => [...xs, mine]);
    setDraft("");
    setThinking(true);
    try {
      if (live) {
        const res = await chat({ message: text, threadId: activeId });
        setExtra((xs) => [
          ...xs,
          { id: `x${xs.length}-a`, threadId: tid, role: "assistant", content: res.reply, createdAt: "" },
        ]);
        if (res.threadId && res.threadId !== activeId) {
          setActiveId(res.threadId);
          getThreads().then(setThreads).catch(() => {});
        }
      } else {
        const home = HOME;
        const res = await chat({
          message: text,
          history: [...messages, mine].map((m) => ({ role: m.role, content: m.content })),
          location: { name: home.name, lat: home.lat, lon: home.lon, zip: home.zip },
          profile: ADVISOR.profile,
          thresholds: ADVISOR.thresholds,
        });
        setExtra((xs) => [
          ...xs,
          { id: `x${xs.length}-a`, threadId: tid, role: "assistant", content: res.reply, createdAt: "" },
        ]);
      }
    } catch {
      setExtra((xs) => [
        ...xs,
        {
          id: `x${xs.length}-a`,
          threadId: tid,
          role: "assistant",
          content:
            "暂时无法连接环境服务，我不会猜测实时条件。请稍后再试。",
          createdAt: "",
        },
      ]);
    }
    setThinking(false);
  }

  return (
    <div className="flex min-h-0 flex-1 gap-6">
      {/* Conversation */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="mb-4">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight">环境问答</h1>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                live ? "bg-good/10 text-good" : "bg-ink/10 text-ink-muted"
              }`}
            >
              {live ? "实时" : "演示"}
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-2">
            可以询问活动安排及其背后的环境条件；回答会引用评估时使用的同一组数据。
          </p>
          {signedOut && (
            <Link href="/signin" className="mt-1 inline-block text-xs font-medium text-accent hover:underline">
              登录后让助手了解你的每周安排 →
            </Link>
          )}
        </header>

        <div ref={scroller} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-4">
          {messages.map((m) => (
            <Bubble key={m.id} msg={m} />
          ))}
          {thinking && (
            <div className="self-start rounded-2xl bg-surface px-4 py-3 text-sm text-ink-muted">
              正在查看环境数据…
            </div>
          )}
        </div>

        {live && messages.length <= 1 && !thinking && (
          <div className="mb-2 flex flex-wrap gap-2">
            {[
              "今天最适合户外活动的时段是什么？",
              "现在需要防晒吗？",
              "当前空气质量适合高强度跑步吗？",
            ].map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="btn-ghost px-3.5 py-1.5 text-xs"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        <div className="mt-2 flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="午休时间适合跑步吗？周六徒步应该怎么安排？"
            className="flex-1 rounded-full border border-hairline bg-surface px-4 py-2.5 text-sm placeholder:text-ink-muted"
          />
          <button onClick={() => send()} disabled={thinking} className="btn-primary px-5 py-2.5 text-sm">
            发送
          </button>
        </div>
      </div>

      {/* Right rail */}
      <aside className="hidden w-64 shrink-0 flex-col gap-4 lg:flex">
        {live ? (
          <>
            <Card
              title="对话记录"
              action={
                <button onClick={() => openThread(null)} className="btn-ghost px-2.5 py-0.5 text-[11px]">
                  新对话
                </button>
              }
            >
              <ul className="flex flex-col gap-1">
                {threads.length === 0 && (
                  <li className="text-sm text-ink-muted">还没有对话，可以先问一个问题。</li>
                )}
                {threads.map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => openThread(t.id)}
                      className={`w-full truncate rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        t.id === activeId
                          ? "bg-ink/10 font-medium text-ink"
                          : "text-ink-2 hover:bg-ink/5"
                      }`}
                    >
                      {t.title}
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="今日概览">
              {livePlan ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`text-3xl font-semibold tracking-tight ${dayScoreTone(livePlan.dayScore)}`}
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {livePlan.dayScore}
                    </span>
                    <span className="text-xs text-ink-muted">今日适宜度</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-ink-2">
                    {livePlan.summary.length > 160
                      ? livePlan.summary.slice(0, 160) + "…"
                      : livePlan.summary}
                  </p>
                  <Link href="/today" className="mt-3 block text-xs font-medium text-accent hover:underline">
                    打开今日安排 →
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-sm leading-relaxed text-ink-2">今天还没有生成安排。</p>
                  <Link href="/today" className="mt-2 block text-xs font-medium text-accent hover:underline">
                    生成今日安排 →
                  </Link>
                </>
              )}
            </Card>
          </>
        ) : (
          <>
            <Card title="对话记录">
              <ul className="flex flex-col gap-1">
                {THREADS.map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => setMockThreadId(t.id)}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        t.id === mockThreadId
                          ? "bg-ink/10 font-medium text-ink"
                          : "text-ink-2 hover:bg-ink/5"
                      }`}
                    >
                      {t.title}
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="最近一次规划">
              <p className="text-sm leading-relaxed text-ink-2">{PLAN_RUNS[0].report}</p>
              <p className="mt-2 text-xs text-ink-muted">06:02 运行 · 覆盖今天和明天</p>
            </Card>
          </>
        )}
      </aside>
    </div>
  );
}
