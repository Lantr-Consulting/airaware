"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { useToast } from "@/components/toast";
import { interpretProfile, patchSettings, searchCities } from "@/lib/api";
import { ADVISOR } from "@/lib/mock.en";
import { invalidateMe, useMe } from "@/lib/use-me";
import type { AdvisorProfile, Location, Thresholds } from "@/lib/types";

const SKIN_TYPES = ["", "I", "II", "III", "IV", "V", "VI"];
const POLLEN_BANDS = ["Low", "Low–medium", "Medium", "Medium–high", "High"];

function HomeEditor({
  home,
  onSaved,
}: {
  home: Location;
  onSaved: (loc: Location) => void;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Location[]>([]);
  const [chosen, setChosen] = useState<Location | null>(null);
  const [zip, setZip] = useState("");
  const [saving, setSaving] = useState(false);

  // Debounced live search; all state changes ride the timer.
  useEffect(() => {
    if (!editing || chosen) return;
    const q = query.trim();
    const t = setTimeout(() => {
      if (q.length < 2) {
        setResults([]);
        return;
      }
      searchCities(q)
        .then(setResults)
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [query, editing, chosen]);

  async function save() {
    if (!chosen || saving) return;
    setSaving(true);
    try {
      const loc: Location = { ...chosen, zip: zip.trim() || chosen.zip };
      await patchSettings({ homeLocation: loc });
      invalidateMe();
      onSaved(loc);
      setEditing(false);
      setChosen(null);
      setQuery("");
      toast("success", `Home set to ${loc.name} — plans now use its sky.`);
    } catch {
      toast("error", "Couldn't save your location — try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-4 py-1">
        <span className="text-ink-2">Home location</span>
        <span className="flex items-center gap-3">
          <span className="font-medium">{home.name}</span>
          <button onClick={() => setEditing(true)} className="btn-ghost px-3 py-1 text-xs">
            Change
          </button>
        </span>
      </div>
    );
  }

  const isUS = (chosen?.tz ?? "").startsWith("America/") || Boolean(chosen?.zip);

  return (
    <div className="flex flex-col gap-2 py-1">
      <div className="flex items-center justify-between gap-4">
        <span className="text-ink-2">Home location</span>
        <button
          onClick={() => {
            setEditing(false);
            setChosen(null);
            setQuery("");
          }}
          className="text-xs text-ink-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>
      {!chosen ? (
        <div className="relative">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any city…"
            className="w-full rounded-lg border border-hairline bg-page px-3.5 py-2.5 text-sm placeholder:text-ink-muted"
          />
          {results.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-hairline bg-surface-2 shadow-xl">
              {results.slice(0, 5).map((r) => (
                <li key={`${r.lat},${r.lon}`}>
                  <button
                    onClick={() => {
                      setChosen(r);
                      setZip(r.zip ?? "");
                    }}
                    className="w-full px-3.5 py-2.5 text-left text-sm text-ink-2 hover:bg-ink/5 hover:text-ink"
                  >
                    {r.name}
                    <span className="ml-2 text-xs text-ink-muted">{r.tz}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-accent/15 px-3 py-1.5 text-sm font-medium text-accent">
            {chosen.name}
          </span>
          {isUS && (
            <input
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              placeholder="ZIP (for pollen)"
              className="w-32 rounded-lg border border-hairline bg-page px-3 py-1.5 text-sm placeholder:text-ink-muted"
            />
          )}
          <button onClick={save} disabled={saving} className="btn-primary px-4 py-1.5 text-sm">
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={() => setChosen(null)}
            className="text-xs text-ink-muted hover:text-ink"
          >
            Pick another
          </button>
          {isUS && !zip && (
            <span className="w-full text-xs text-ink-muted">
              No ZIP means pollen shows as “no coverage” — everything else still works.
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const toast = useToast();
  const { me, loading } = useMe();
  const [paused, setPaused] = useState(ADVISOR.paused);
  const [activated, setActivated] = useState(true);
  const [about, setAbout] = useState(ADVISOR.profile.notes);
  const [profile, setProfile] = useState<AdvisorProfile>(ADVISOR.profile);
  const [thresholds, setThresholds] = useState<Thresholds>(ADVISOR.thresholds);
  const [home, setHome] = useState<Location>(ADVISOR.homeLocation);
  const [units, setUnits] = useState<string>(ADVISOR.units);
  const [interpreting, setInterpreting] = useState(false);
  const [activating, setActivating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const signedOut = !loading && me === null;
  const live = me !== null;

  // Adopt the account's values when /me (re)loads — state-during-render
  // pattern, so there's no cascading effect.
  const [adoptedMe, setAdoptedMe] = useState<typeof me>(null);
  if (me !== adoptedMe) {
    setAdoptedMe(me);
    if (me) {
      setProfile(me.profile);
      setThresholds(me.thresholds);
      setHome(me.homeLocation);
      setUnits(me.units);
      setPaused(me.paused);
      setActivated(me.activated);
      setAbout(me.profile.notes);
    }
  }

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
        invalidateMe();
        toast("success", "Profile interpreted and saved — the limits below are now enforced.");
      } else {
        setNotice("Interpreted (preview only — sign in to save it to your account).");
      }
      setProfile(nextProfile);
      setThresholds(result.thresholds);
    } catch {
      toast("error", "The interpreter isn't reachable right now — nothing was changed.");
    } finally {
      setInterpreting(false);
    }
  }

  async function activate() {
    if (activating) return;
    setActivating(true);
    try {
      await patchSettings({ activated: true });
      setActivated(true);
      invalidateMe();
      toast("success", "Advisor activated — go plan your day.");
    } catch {
      toast("error", "Couldn't activate — try again.");
    } finally {
      setActivating(false);
    }
  }

  async function togglePause() {
    const next = !paused;
    setPaused(next);
    if (live) {
      try {
        await patchSettings({ paused: next });
        toast("info", next ? "Advisor paused." : "Advisor resumed.");
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
                live ? "bg-good/10 text-good" : "bg-ink/10 text-ink-muted"
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
          {live && !activated ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-band-1/10 px-3 py-1 text-xs font-medium text-band-1">
              <span aria-hidden className="inline-block size-2 rounded-full bg-current" />
              Not activated
            </span>
          ) : (
            <>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                  paused ? "bg-ink/10 text-ink-2" : "bg-good/10 text-good"
                }`}
              >
                <span aria-hidden className="inline-block size-2 rounded-full bg-current" />
                {paused ? "Paused" : "Active"}
              </span>
              <button onClick={togglePause} className="btn-ghost px-4 py-1.5 text-sm">
                {paused ? "Resume" : "Pause"}
              </button>
            </>
          )}
        </div>
      </header>

      {live && !activated && (
        <Card className="border border-accent/30">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold tracking-tight">Review, then activate</h2>
              <p className="mt-1 max-w-xl text-sm text-ink-2">
                Set your home below, describe yourself, and check the limits
                table. When it looks like you, activate — nothing plans until
                you do.
              </p>
            </div>
            <button onClick={activate} disabled={activating} className="btn-primary px-5 py-2 text-sm">
              {activating ? "Activating…" : "Activate my advisor"}
            </button>
          </div>
        </Card>
      )}

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
          {live ? (
            <HomeEditor home={home} onSaved={setHome} />
          ) : (
            <div className="flex items-center justify-between gap-4 py-1">
              <span className="text-ink-2">Home location</span>
              <span className="font-medium">{home.name}</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-4 border-t border-hairline py-1 pt-3">
            <span className="text-ink-2">Units</span>
            <span className="font-medium capitalize">{units}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
