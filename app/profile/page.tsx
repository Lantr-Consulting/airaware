"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { getMe, interpretProfile, patchSettings } from "@/lib/api";
import { ADVISOR } from "@/lib/mock";
import { supabase } from "@/lib/supabase";
import type { AdvisorProfile, Location, Thresholds } from "@/lib/types";

const SKIN_TYPES = ["", "I", "II", "III", "IV", "V", "VI"];
const POLLEN_BANDS = ["Low", "Low–medium", "Medium", "Medium–high", "High"];

export default function ProfilePage() {
  const [signedOut, setSignedOut] = useState(false);
  const [offline, setOffline] = useState(false);
  const [paused, setPaused] = useState(ADVISOR.paused);
  const [about, setAbout] = useState(ADVISOR.profile.notes);
  const [profile, setProfile] = useState<AdvisorProfile>(ADVISOR.profile);
  const [thresholds, setThresholds] = useState<Thresholds>(ADVISOR.thresholds);
  const [home, setHome] = useState<Location>(ADVISOR.homeLocation);
  const [units, setUnits] = useState<string>(ADVISOR.units);
  const [interpreting, setInterpreting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const live = !signedOut && !offline;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        setSignedOut(true);
        return;
      }
      try {
        const me = await getMe();
        if (cancelled) return;
        setProfile(me.profile);
        setThresholds(me.thresholds);
        setHome(me.homeLocation);
        setUnits(me.units);
        setPaused(me.paused);
        setAbout(me.profile.notes);
      } catch {
        if (!cancelled) setOffline(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function interpret() {
    const text = about.trim();
    if (!text || interpreting) return;
    setInterpreting(true);
    setNotice(null);
    try {
      const result = await interpretProfile(text);
      const nextProfile = { ...result.profile, notes: result.profile.notes || text };
      if (live) {
        await patchSettings({ profile: nextProfile, thresholds: result.thresholds });
        setNotice("Interpreted and saved — these are now the limits the engine enforces for your account.");
      } else {
        setNotice("Interpreted (preview only — sign in to save it to your account).");
      }
      setProfile(nextProfile);
      setThresholds(result.thresholds);
    } catch {
      setNotice("The interpreter backend isn't reachable right now — nothing was changed.");
    } finally {
      setInterpreting(false);
    }
  }

  async function togglePause() {
    const next = !paused;
    setPaused(next);
    if (live) {
      try {
        await patchSettings({ paused: next });
      } catch {
        setPaused(!next);
      }
    }
  }

  const thresholdRows = [
    { line: `Sun protection from UV ${thresholds.uvProtect}`, why: `Skin type ${SKIN_TYPES[profile.skinType]}` },
    { line: `Move midday exposure at UV ${thresholds.uvAvoid}+`, why: "WHO very-high band" },
    { line: `Flag hard efforts from AQI ${thresholds.aqiCaution}`, why: profile.asthma ? "Asthma" : profile.pollenAllergies.length ? "Pollen allergies" : "EPA guidance" },
    { line: `Move outdoor plans indoors at AQI ${thresholds.aqiAvoid}+`, why: "EPA unhealthy-for-sensitive-groups" },
    { line: `Caution from a feels-like of ${thresholds.heatCautionF}°F`, why: `Heat tolerance: ${profile.heatTolerance}` },
    { line: `Reschedule at a feels-like of ${thresholds.heatAvoidF}°F+`, why: "NWS danger band" },
    {
      line: `Pollen advice from ${POLLEN_BANDS[thresholds.pollenCaution]}`,
      why: profile.pollenAllergies.length ? `Allergies: ${profile.pollenAllergies.join(", ")}` : "No pollen allergies",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight">Profile & settings</h1>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                live ? "bg-good/10 text-good" : "bg-white/10 text-ink-muted"
              }`}
            >
              {live ? "Live" : "Sample"}
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-2">
            You describe yourself in plain English; the advisor turns it into
            the limits below. Nothing changes without your say-so.
          </p>
          {signedOut && (
            <Link href="/signin" className="mt-1 inline-block text-xs font-medium text-accent hover:underline">
              Sign in to make this profile yours →
            </Link>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              paused ? "bg-white/10 text-ink-2" : "bg-good/10 text-good"
            }`}
          >
            <span aria-hidden className="inline-block size-2 rounded-full bg-current" />
            {paused ? "Paused" : "Active"}
          </span>
          <button onClick={togglePause} className="btn-ghost px-4 py-1.5 text-sm">
            {paused ? "Resume" : "Pause"}
          </button>
        </div>
      </header>

      <Card title="How you described yourself">
        <textarea
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          rows={3}
          placeholder="Allergies, skin, heat, kids, routines — plain English."
          className="w-full rounded-xl border border-hairline bg-page px-4 py-3 text-sm leading-relaxed text-ink-2 placeholder:text-ink-muted"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-ink-muted">
            {notice ?? "Describe yourself and press Interpret — the limits below update (and save, when signed in)."}
          </p>
          <button onClick={interpret} disabled={interpreting} className="btn-primary px-4 py-1.5 text-sm">
            {interpreting ? "Interpreting…" : "Interpret"}
          </button>
        </div>
      </Card>

      <Card title="Sensitivities">
        <div className="flex flex-wrap gap-2 text-[11px] font-medium">
          <span className="rounded-full border border-hairline px-3 py-1.5 text-ink-2">
            Skin type {SKIN_TYPES[profile.skinType]}
          </span>
          {profile.pollenAllergies.map((p) => (
            <span key={p} className="rounded-full border border-hairline px-3 py-1.5 capitalize text-ink-2">
              {p} allergy
            </span>
          ))}
          <span className="rounded-full border border-hairline px-3 py-1.5 capitalize text-ink-2">
            Heat tolerance: {profile.heatTolerance}
          </span>
          <span className="rounded-full border border-hairline px-3 py-1.5 text-ink-2">
            Asthma: {profile.asthma ? "yes" : "no"}
          </span>
          <span className="rounded-full border border-hairline px-3 py-1.5 text-ink-2">
            Kid mode: {profile.kidMode ? "on" : "off"}
          </span>
        </div>
      </Card>

      <Card title="Your limits — what the engine enforces">
        <ul className="flex flex-col divide-y divide-hairline">
          {thresholdRows.map((r) => (
            <li key={r.line} className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <span className="text-ink-2">{r.line}</span>
              <span className="shrink-0 text-xs text-ink-muted">{r.why}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-muted">
          Every plan item shows which of these lines fired. Change one and the
          engine changes with it — the rules live in code, not in a prompt.
        </p>
      </Card>

      <Card title="Home & units">
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between gap-4 py-1">
            <span className="text-ink-2">Home location</span>
            <span className="font-medium">{home.name}</span>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-hairline py-1 pt-3">
            <span className="text-ink-2">Units</span>
            <span className="font-medium capitalize">{units}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
