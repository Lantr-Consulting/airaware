"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { MESSAGES, PLAN_RUNS, THREADS } from "@/lib/mock";
import type { Message } from "@/lib/types";

// Minimal bold-only rendering for mock messages; real markdown arrives with
// the live advisor in Milestone 3.
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, li) => (
        <p key={li} className={li > 0 ? "mt-2" : ""}>
          {line.split("**").map((part, pi) =>
            pi % 2 === 1 ? (
              <strong key={pi} className="font-semibold text-ink">
                {part}
              </strong>
            ) : (
              <span key={pi}>{part}</span>
            )
          )}
        </p>
      ))}
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

  const messages = [
    ...MESSAGES.filter((m) => m.threadId === threadId),
    ...extra.filter((m) => m.threadId === threadId),
  ];

  function send() {
    const text = draft.trim();
    if (!text) return;
    setExtra((xs) => [
      ...xs,
      { id: `x${xs.length}`, threadId, role: "user", content: text, createdAt: "" },
      {
        id: `x${xs.length + 1}`,
        threadId,
        role: "assistant",
        content:
          "The live advisor arrives in **Milestone 3** — for now I'm sample data. Once the backend ships, replies here are grounded in real conditions and your own plan records.",
        createdAt: "",
      },
    ]);
    setDraft("");
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
