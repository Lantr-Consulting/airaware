"use client";

import { useEffect, useState } from "react";
import { Card, ConditionTile } from "@/components/ui";
import { useToast } from "@/components/toast";
import { aqiBand, heatBand, pollenBand, uvBand } from "@/lib/bands";
import { getConditions, patchSettings, searchCities } from "@/lib/api";
import { EXPLORE_CITIES } from "@/lib/mock.en";
import { invalidateMe, useMe } from "@/lib/use-me";
import type { DailySummary, Location } from "@/lib/types";

const CELL_BG = ["bg-band-0", "bg-band-1", "bg-band-2", "bg-band-3", "bg-band-4"];

interface CityCard {
  location: Location;
  current: { uvIndex: number; usAqi: number; apparentF: number; pollenIdx: number | null };
  daily: DailySummary[];
  live: boolean;
}

const SAMPLE_CARDS: CityCard[] = EXPLORE_CITIES.map((c) => ({ ...c, live: false }));

export default function ExplorePage() {
  const toast = useToast();
  const { me } = useMe();
  const [query, setQuery] = useState("");
  const [cards, setCards] = useState<CityCard[]>(SAMPLE_CARDS);
  const [offline, setOffline] = useState(false);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function setAsHome(loc: Location) {
    try {
      await patchSettings({ homeLocation: loc });
      invalidateMe();
      toast("success", `Home set to ${loc.name} — Today and the planner follow.`);
    } catch {
      toast("error", "Couldn't set home — try again.");
    }
  }

  // Upgrade the featured cities from sample to live on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results = await Promise.allSettled(
        EXPLORE_CITIES.map((c) =>
          getConditions({
            lat: c.location.lat,
            lon: c.location.lon,
            zip: c.location.zip,
            name: c.location.name,
          })
        )
      );
      if (cancelled) return;
      if (results.every((r) => r.status === "rejected")) {
        setOffline(true);
        return;
      }
      setCards((prev) =>
        prev.map((card, i) => {
          const r = results[i];
          if (r.status !== "fulfilled") return card;
          const d = r.value;
          return {
            location: { ...card.location, ...d.location },
            current: {
              uvIndex: d.current.uvIndex,
              usAqi: d.current.usAqi,
              apparentF: d.current.apparentF,
              pollenIdx: d.current.pollen?.index ?? null,
            },
            daily: d.daily,
            live: true,
          };
        })
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function runSearch() {
    const q = query.trim();
    if (q.length < 2 || offline || searching) return;
    setSearching(true);
    setNotice(null);
    try {
      const hits = await searchCities(q);
      if (hits.length === 0) {
        setNotice(`No city found for “${q}”.`);
        return;
      }
      const top = hits[0];
      const d = await getConditions({ lat: top.lat, lon: top.lon, name: top.name });
      const card: CityCard = {
        location: top,
        current: {
          uvIndex: d.current.uvIndex,
          usAqi: d.current.usAqi,
          apparentF: d.current.apparentF,
          pollenIdx: d.current.pollen?.index ?? null,
        },
        daily: d.daily,
        live: true,
      };
      setCards((prev) => [card, ...prev.filter((c) => c.location.name !== top.name)]);
      setQuery("");
    } catch {
      setNotice("Search is unavailable right now — showing sample cities.");
    } finally {
      setSearching(false);
    }
  }

  const visible = cards.filter((c) =>
    c.location.name.toLowerCase().includes(query.toLowerCase())
  );
  const shown = visible.length > 0 ? visible : cards;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Explore</h1>
        <p className="mt-1 text-sm text-ink-2">
          Conditions anywhere — no account needed. Search any city on Earth for
          its UV, heat, air, and pollen picture.
        </p>
        <div className="mt-4 flex max-w-md items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder={offline ? "Backend offline — filtering samples…" : "Search any city…"}
            className="flex-1 rounded-full border border-hairline bg-surface px-4 py-2.5 text-sm placeholder:text-ink-muted"
          />
          <button
            onClick={runSearch}
            disabled={offline || searching}
            className="btn-primary px-4 py-2.5 text-sm"
          >
            {searching ? "…" : "Search"}
          </button>
        </div>
        {notice && <p className="mt-2 text-xs text-ink-muted">{notice}</p>}
        {offline && (
          <p className="mt-2 text-xs text-ink-muted">
            The conditions backend isn&apos;t reachable — these cards are sample
            data until it comes back.
          </p>
        )}
      </header>

      <div className="flex flex-col gap-4">
        {shown.map((c) => {
          const worstByDay = c.daily.map((day) =>
            Math.max(
              uvBand(day.uvMax).severity,
              heatBand(day.apparentMaxF).severity,
              aqiBand(day.aqiMax).severity,
              day.pollen ? pollenBand(day.pollen.index).severity : 0
            )
          );
          return (
            <Card key={c.location.name}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-[15px] font-semibold tracking-tight">
                    {c.location.name}
                  </h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      c.live ? "bg-good/10 text-good" : "bg-ink/10 text-ink-muted"
                    }`}
                  >
                    {c.live ? "Live" : "Sample"}
                  </span>
                  {me && me.homeLocation.name !== c.location.name && (
                    <button
                      onClick={() => setAsHome(c.location)}
                      className="btn-ghost px-2.5 py-0.5 text-[11px]"
                    >
                      Set as home
                    </button>
                  )}
                  {me && me.homeLocation.name === c.location.name && (
                    <span className="text-[11px] font-medium text-accent">Home</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="mr-1 text-[11px] text-ink-muted">Next 7 days</span>
                  {worstByDay.map((sev, i) => (
                    <span
                      key={i}
                      aria-hidden
                      className={`inline-block size-3 rounded-sm ${CELL_BG[sev]} opacity-90`}
                    />
                  ))}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <ConditionTile label="UV index" value={String(c.current.uvIndex)} band={uvBand(c.current.uvIndex)} />
                <ConditionTile label="Feels like" value={String(c.current.apparentF)} unit="°F" band={heatBand(c.current.apparentF)} />
                <ConditionTile label="US AQI" value={String(c.current.usAqi)} band={aqiBand(c.current.usAqi)} />
                <ConditionTile
                  label="Pollen"
                  value={c.current.pollenIdx === null ? "—" : c.current.pollenIdx.toFixed(1)}
                  band={c.current.pollenIdx === null ? undefined : pollenBand(c.current.pollenIdx)}
                  noCoverage={c.current.pollenIdx === null}
                />
              </div>
            </Card>
          );
        })}
      </div>

      <Card title="What the bands mean">
        <div className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
          <div>
            <div className="font-medium">UV index (WHO)</div>
            <p className="mt-1 leading-relaxed text-ink-2">
              0–2 Low · 3–5 Moderate · 6–7 High · 8–10 Very high · 11+ Extreme.
              Protection starts mattering at Moderate — clouds are not sunscreen.
            </p>
          </div>
          <div>
            <div className="font-medium">US AQI (EPA)</div>
            <p className="mt-1 leading-relaxed text-ink-2">
              0–50 Good · 51–100 Moderate · 101–150 Unhealthy for sensitive
              groups · 151–200 Unhealthy · 201+ Very unhealthy. Hard exercise
              multiplies your intake.
            </p>
          </div>
          <div>
            <div className="font-medium">Heat index (NWS)</div>
            <p className="mt-1 leading-relaxed text-ink-2">
              Feels-like under 80°F is comfortable; 80–89 Caution · 90–102
              Extreme caution · 103–124 Danger. Humidity is what turns hot into
              dangerous.
            </p>
          </div>
          <div>
            <div className="font-medium">Pollen (0–12 index)</div>
            <p className="mt-1 leading-relaxed text-ink-2">
              Under 2.5 Low · to 4.9 Low–medium · to 7.3 Medium · to 9.7
              Medium–high · above that High. Coverage is regional — where
              there&apos;s no data, AirAware says so instead of guessing.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
