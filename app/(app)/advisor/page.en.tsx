"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui";
import { chat, getThreadMessages, getThreads, getTodayPlan } from "@/lib/api";
import { dayScoreTone } from "@/lib/bands";
import { ADVISOR, HOME, MESSAGES, PLAN_RUNS, THREADS } from "@/lib/mock.en";
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
            content: `Hi! I can see the live sky over **${me.homeLocation.name}**, your limits, and today's plan. Ask about timing, gear, or air quality.`,
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
            "I can't reach the advisor backend right now, so I won't guess at live conditions. Try again in a moment.",
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
            <h1 className="text-2xl font-semibold tracking-tight">Advisor</h1>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                live ? "bg-good/10 text-good" : "bg-ink/10 text-ink-muted"
              }`}
            >
              {live ? "Live" : "Sample"}
            </span>
          </div>
          <p className="mt-1.5 max-w-3xl text-[15px] leading-relaxed text-ink-2">
            Ask anything about your plan or the conditions behind it. Every
            answer cites the same numbers the engine checked.
          </p>
          {signedOut && (
            <Link href="/signin" className="mt-1 inline-block text-xs font-medium text-accent hover:underline">
              Sign in for an advisor that knows your week →
            </Link>
          )}
        </header>

        <div ref={scroller} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-4">
          {messages.map((m) => (
            <Bubble key={m.id} msg={m} />
          ))}
          {thinking && (
            <div className="self-start rounded-2xl bg-surface px-4 py-3 text-sm text-ink-muted">
              Checking the sky…
            </div>
          )}
        </div>

        {live && messages.length <= 1 && !thinking && (
          <div className="mb-2 flex flex-wrap gap-2">
            {[
              "What's my best outdoor window today?",
              "Do I need sunscreen right now?",
              "How's the air for a hard run?",
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
            placeholder="Can I run at lunch? What about the hike Saturday?"
            className="flex-1 rounded-full border border-hairline bg-surface px-4 py-2.5 text-sm placeholder:text-ink-muted"
          />
          <button onClick={() => send()} disabled={thinking} className="btn-primary px-5 py-2.5 text-sm">
            Send
          </button>
        </div>
      </div>

      {/* Right rail */}
      <aside className="hidden w-64 shrink-0 flex-col gap-4 lg:flex">
        {live ? (
          <>
            <Card
              title="Conversations"
              action={
                <button onClick={() => openThread(null)} className="btn-ghost px-2.5 py-0.5 text-[11px]">
                  New
                </button>
              }
            >
              <ul className="flex flex-col gap-1">
                {threads.length === 0 && (
                  <li className="text-sm text-ink-muted">Nothing yet. Say hi.</li>
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
            <Card title="Today at a glance">
              {livePlan ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`text-3xl font-semibold tracking-tight ${dayScoreTone(livePlan.dayScore)}`}
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {livePlan.dayScore}
                    </span>
                    <span className="text-xs text-ink-muted">day score</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-ink-2">
                    {livePlan.summary.length > 160
                      ? livePlan.summary.slice(0, 160) + "…"
                      : livePlan.summary}
                  </p>
                  <Link href="/today" className="mt-3 block text-xs font-medium text-accent hover:underline">
                    Open today&apos;s plan →
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-sm leading-relaxed text-ink-2">No plan for today yet.</p>
                  <Link href="/today" className="mt-2 block text-xs font-medium text-accent hover:underline">
                    Plan my day →
                  </Link>
                </>
              )}
            </Card>
          </>
        ) : (
          <>
            <Card title="Conversations">
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
            <Card title="Latest plan run">
              <p className="text-sm leading-relaxed text-ink-2">{PLAN_RUNS[0].report}</p>
              <p className="mt-2 text-xs text-ink-muted">Ran at 6:02 am · today + tomorrow</p>
            </Card>
          </>
        )}
      </aside>
    </div>
  );
}
