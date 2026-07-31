"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { interpretProfile } from "@/lib/api";
import { ADVISOR } from "@/lib/mock";
import type { AdvisorProfile, Thresholds } from "@/lib/types";

const SKIN_TYPES = ["", "I", "II", "III", "IV", "V", "VI"];
const POLLEN_BANDS = ["Low", "Low–medium", "Medium", "Medium–high", "High"];

export default function ProfilePage() {
  const [paused, setPaused] = useState(ADVISOR.paused);
  const [about, setAbout] = useState(ADVISOR.profile.notes);
  const [profile, setProfile] = useState<AdvisorProfile>(ADVISOR.profile);
  const [thresholds, setThresholds] = useState<Thresholds>(ADVISOR.thresholds);
  const [interpreting, setInterpreting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const a = { ...ADVISOR, profile, thresholds };

  async function interpret() {
    const text = about.trim();
    if (!text || interpreting) return;
    setInterpreting(true);
    setNotice(null);
    try {
      const result = await interpretProfile(text);
      setProfile({ ...result.profile, notes: result.profile.notes || text });
      setThresholds(result.thresholds);
      setNotice(
        "Interpreted — the sensitivities and limits below now reflect your description. (Saving and the explicit Activate step arrive with accounts in Milestone 5.)"
      );
    } catch {
      setNotice("The interpreter backend isn't reachable right now — nothing was changed.");
    } finally {
      setInterpreting(false);
    }
  }

  const thresholdRows = [
    { line: `Sun protection from UV ${a.thresholds.uvProtect}`, why: `Skin type ${SKIN_TYPES[a.profile.skinType]}` },
    { line: `Move midday exposure at UV ${a.thresholds.uvAvoid}+`, why: "WHO very-high band" },
    { line: `Flag hard efforts from AQI ${a.thresholds.aqiCaution}`, why: a.profile.asthma ? "Asthma" : "Pollen allergies" },
    { line: `Move outdoor plans indoors at AQI ${a.thresholds.aqiAvoid}+`, why: "EPA unhealthy-for-sensitive-groups" },
    { line: `Caution from a feels-like of ${a.thresholds.heatCautionF}°F`, why: `Heat tolerance: ${a.profile.heatTolerance}` },
    { line: `Reschedule at a feels-like of ${a.thresholds.heatAvoidF}°F+`, why: "NWS danger band" },
    {
      line: `Pollen advice from ${POLLEN_BANDS[a.thresholds.pollenCaution]}`,
      why: a.profile.pollenAllergies.length
        ? `Allergies: ${a.profile.pollenAllergies.join(", ")}`
        : "No pollen allergies",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Profile & settings</h1>
          <p className="mt-1 text-sm text-ink-2">
            You describe yourself in plain English; the advisor turns it into
            the limits below. Nothing changes without your say-so.
          </p>
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
          <button onClick={() => setPaused(!paused)} className="btn-ghost px-4 py-1.5 text-sm">
            {paused ? "Resume" : "Pause"}
          </button>
        </div>
      </header>

      <Card title="How you described yourself">
        <textarea
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-hairline bg-page px-4 py-3 text-sm leading-relaxed text-ink-2"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-ink-muted">
            {notice ??
              "Describe yourself — allergies, skin, heat, kids, routines — and the advisor turns it into the limits below."}
          </p>
          <button
            onClick={interpret}
            disabled={interpreting}
            className="btn-primary px-4 py-1.5 text-sm"
          >
            {interpreting ? "Interpreting…" : "Interpret"}
          </button>
        </div>
      </Card>

      <Card title="Sensitivities">
        <div className="flex flex-wrap gap-2 text-[11px] font-medium">
          <span className="rounded-full border border-hairline px-3 py-1.5 text-ink-2">
            Skin type {SKIN_TYPES[a.profile.skinType]}
          </span>
          {a.profile.pollenAllergies.map((p) => (
            <span key={p} className="rounded-full border border-hairline px-3 py-1.5 capitalize text-ink-2">
              {p} allergy
            </span>
          ))}
          <span className="rounded-full border border-hairline px-3 py-1.5 capitalize text-ink-2">
            Heat tolerance: {a.profile.heatTolerance}
          </span>
          <span className="rounded-full border border-hairline px-3 py-1.5 text-ink-2">
            Asthma: {a.profile.asthma ? "yes" : "no"}
          </span>
          <span className="rounded-full border border-hairline px-3 py-1.5 text-ink-2">
            Kid mode: {a.profile.kidMode ? "on" : "off"}
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
            <span className="font-medium">{a.homeLocation.name}</span>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-hairline py-1 pt-3">
            <span className="text-ink-2">Units</span>
            <span className="font-medium capitalize">{a.units}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
