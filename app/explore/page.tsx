"use client";

import { useState } from "react";
import { Card, ConditionTile } from "@/components/ui";
import { aqiBand, heatBand, pollenBand, uvBand } from "@/lib/bands";
import { EXPLORE_CITIES } from "@/lib/mock";

const CELL_BG = ["bg-band-0", "bg-band-1", "bg-band-2", "bg-band-3", "bg-band-4"];

export default function ExplorePage() {
  const [query, setQuery] = useState("");
  const cities = EXPLORE_CITIES.filter((c) =>
    c.location.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Explore</h1>
        <p className="mt-1 text-sm text-ink-2">
          Conditions anywhere — no account needed. Search a city to see its UV,
          heat, air, and pollen picture.
        </p>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a city…"
          className="mt-4 w-full max-w-md rounded-full border border-hairline bg-surface px-4 py-2.5 text-sm placeholder:text-ink-muted"
        />
      </header>

      <div className="flex flex-col gap-4">
        {cities.map((c) => {
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
                <h2 className="text-[15px] font-semibold tracking-tight">
                  {c.location.name}
                </h2>
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
        {cities.length === 0 && (
          <Card>
            <p className="text-sm text-ink-2">
              No matches in the sample set. Live city search arrives with the
              backend in Milestone 3.
            </p>
          </Card>
        )}
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
