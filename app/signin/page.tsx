"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) setError(error.message);
    else setSent(true);
    setBusy(false);
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5">
      <header className="text-center">
        <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-ink-muted">
          One advisor per person. Your schedule, sensitivities, and plans are
          yours alone — magic link, no password.
        </p>
      </header>
      <Card>
        {sent ? (
          <div className="text-center">
            <p className="text-sm font-medium">Check your email</p>
            <p className="mt-1 text-sm text-ink-2">
              We sent a sign-in link to <strong>{email}</strong>. Open it on
              this device and you&apos;ll land back here, signed in.
            </p>
          </div>
        ) : (
          <form onSubmit={send} className="flex flex-col gap-3">
            <label className="text-sm font-medium" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="rounded-lg border border-hairline bg-page px-3.5 py-2.5 text-sm outline-none placeholder:text-ink-muted focus:border-accent"
            />
            <button
              type="submit"
              disabled={busy}
              className="btn-primary px-3.5 py-2.5 text-sm font-medium disabled:opacity-50"
            >
              {busy ? "Sending…" : "Email me a sign-in link"}
            </button>
            {error && <p className="text-xs text-critical">{error}</p>}
          </form>
        )}
      </Card>
      <p className="text-center text-xs text-ink-muted">
        General guidance, not medical advice.
      </p>
    </div>
  );
}
