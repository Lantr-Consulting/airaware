"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { chat, getMe, type Me } from "@/lib/api";
import { ADVISOR, HOME, MESSAGES, PLAN_RUNS, THREADS } from "@/lib/mock";
import { supabase } from "@/lib/supabase";
import type { Message } from "@/lib/types";

// Minimal bold-only rendering for mock messages; real markdown arrives with
// the live advisor in Milestone 3.
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
        mine
          ? "self-end bg-accent text-[#04121c]"
          : "self-start bg-surface text-ink-2"
      }`}
      style={{ animation: "msg-in 0.15s ease" }}
    >
      <Rich text={msg.content} />
    </div>
  );
}

export default function AdvisorPage() {
  const [threadId, setThreadId] = useState(THREADS[0].id);
  const [extra, setExtra] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session || cancelled) return;
      try {
        const m = await getMe();
        if (!cancelled) setMe(m);
      } catch {}
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const messages = [
    ...MESSAGES.filter((m) => m.threadId === threadId),
    ...extra.filter((m) => m.threadId === threadId),
  ];

  async function send() {
    const text = draft.trim();
    if (!text || thinking) return;
    const mine: Message = {
      id: `x${extra.length}-u`,
      threadId,
      role: "user",
      content: text,
      createdAt: "",
    };
    setExtra((xs) => [...xs, mine]);
    setDraft("");
    setThinking(true);
    let reply: string;
    try {
      const home = me?.homeLocation ?? HOME;
      reply = await chat({
        message: text,
        history: [...messages, mine].map((m) => ({ role: m.role, content: m.content })),
        location: { name: home.name, lat: home.lat, lon: home.lon, zip: home.zip },
        profile: me?.profile ?? ADVISOR.profile,
        thresholds: me?.thresholds ?? ADVISOR.thresholds,
      });
    } catch {
      reply =
        "I can't reach the advisor backend right now, so I won't guess at live conditions. Try again in a moment — or check Explore once the connection is back.";
    }
    setExtra((xs) => [
      ...xs,
      { id: `x${xs.length}-a`, threadId, role: "assistant", content: reply, createdAt: "" },
    ]);
    setThinking(false);
  }

  return (
    <div className="flex min-h-0 flex-1 gap-6">
      {/* Conversation */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="mb-4">
          <h1 className="text-2xl font-semibold tracking-tight">Advisor</h1>
          <p className="mt-1 text-sm text-ink-2">
            Ask anything about your plan or the conditions behind it. Every
            answer cites the same numbers the engine checked.
          </p>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-4">
          {messages.map((m) => (
            <Bubble key={m.id} msg={m} />
          ))}
          {thinking && (
            <div className="self-start rounded-2xl bg-surface px-4 py-3 text-sm text-ink-muted">
              Checking the sky…
            </div>
          )}
        </div>

        <div className="mt-2 flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Can I run at lunch? What about the hike Saturday?"
            className="flex-1 rounded-full border border-hairline bg-surface px-4 py-2.5 text-sm placeholder:text-ink-muted"
          />
          <button onClick={send} className="btn-primary px-5 py-2.5 text-sm">
            Send
          </button>
        </div>
      </div>

      {/* Right rail */}
      <aside className="hidden w-64 shrink-0 flex-col gap-4 lg:flex">
        <Card title="Conversations">
          <ul className="flex flex-col gap-1">
            {THREADS.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => setThreadId(t.id)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    t.id === threadId
                      ? "bg-white/10 font-medium text-ink"
                      : "text-ink-2 hover:bg-white/5"
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
      </aside>
    </div>
  );
}
