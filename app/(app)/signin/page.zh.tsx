"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui";

export default function SignInPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const creds = { email: email.trim(), password };
    const { error } =
      mode === "signup"
        ? await supabase.auth.signUp(creds)
        : await supabase.auth.signInWithPassword(creds);
    if (error) {
      setError(
        mode === "signin" && error.message.includes("Invalid login credentials")
          ? "邮箱或密码不正确；如果还没有账户，请先注册。"
          : "登录遇到问题，请检查邮箱和密码后重试。"
      );
      setBusy(false);
      return;
    }
    router.push("/today");
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5">
      <header className="text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          {mode === "signin" ? "登录" : "创建账户"}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          每个账户都有独立的活动安排、敏感因素与规划记录。
        </p>
      </header>
      <Card>
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-full bg-page p-1">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                m === mode
                  ? "btn-primary"
                  : "text-ink-2 hover:text-ink"
              }`}
            >
              {m === "signin" ? "登录" : "注册"}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="text-sm font-medium" htmlFor="email">
            邮箱
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="rounded-lg border border-hairline bg-page px-3.5 py-2.5 text-sm outline-none placeholder:text-ink-muted focus:border-accent"
          />
          <label className="text-sm font-medium" htmlFor="password">
            密码
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "signup" ? "至少 6 个字符" : "请输入密码"}
            className="rounded-lg border border-hairline bg-page px-3.5 py-2.5 text-sm outline-none placeholder:text-ink-muted focus:border-accent"
          />
          <button
            type="submit"
            disabled={busy}
            className="btn-primary px-3.5 py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {busy
              ? "请稍候…"
              : mode === "signin"
                ? "登录"
                : "注册并继续"}
          </button>
          {error && <p className="text-xs text-critical">{error}</p>}
        </form>
      </Card>
      <p className="text-center text-xs text-ink-muted">
        仅供日常参考，不替代医疗建议。
      </p>
    </div>
  );
}
