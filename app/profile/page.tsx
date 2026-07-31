"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { ADVISOR } from "@/lib/mock";

const SKIN_TYPES = ["", "I", "II", "III", "IV", "V", "VI"];
const POLLEN_BANDS = ["Low", "Low–medium", "Medium", "Medium–high", "High"];

export default function ProfilePage() {
  const a = ADVISOR;
  const [paused, setPaused] = useState(a.paused);
  const [about, setAbout] = useState(a.profile.notes);

  const thresholdRows = [
    { line: `Sun protection from UV ${a.thresholds.uvProtect}`, why: `Skin type ${SKIN_TYPES[a.profile.skinType]}` },
    { line: `Move midday exposure at UV ${a.thresholds.uvAvoid}+`, why: "WHO very-high band" },
    { line: `Flag hard efforts from AQI ${a.thresholds.aqiCaution}`, why: "Pollen allergies" },
    { line: `Move outdoor plans indoors at AQI ${a.thresholds.aqiAvoid}+`, why: "EPA unhealthy-for-sensitive-groups" },
    { line: `Caution from a feels-like of ${a.thresholds.heatCautionF}°F`, why: `Heat tolerance: ${a.profile.heatTolerance}` },
    { line: `Reschedule at a feels-like of ${a.thresholds.heatAvoidF}°F+`, why: "NWS danger band" },
    { line: `Pollen advice from ${POLLEN_BANDS[a.thresholds.pollenCaution]}`, why: `Allergies: ${a.profile.pollenAllergies.join(", ")}` },
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
            The interpreter arrives in Milestone 3 — it will turn this into a
            proposed profile you review and activate.
          </p>
          <button className="btn-primary px-4 py-1.5 text-sm">Interpret</button>
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
