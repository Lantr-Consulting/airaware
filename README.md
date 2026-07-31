# AirAware

Your personal environmental-health planner: it learns your week in plain
English, watches UV, heat, air quality, and pollen where you live, builds a
day-by-day outdoor plan within deterministic exposure rules, and re-plans as
the forecast changes.

> **General guidance, not medical advice.** AirAware translates public agency
> thresholds (WHO, EPA, NWS) into practical daily suggestions. It does not
> diagnose or treat anything.

A Lantr sample project, built in the same order a student builds theirs.

**Live:** https://airaware-omega.vercel.app

## Status: Milestone 2 — Design pass

All seven screens live on Vercel against typed mock data shaped like the
real records (`lib/types.ts`, `lib/mock.ts`) — one coherent Austin week,
hand-checked against the official band scales in `lib/bands.ts`. The design
pass added the feels-like hero curve and now-marker to the timeline, the
wordmark favicon, and a browser-verified polish round. The full design and
build plan is in [DESIGN.md](DESIGN.md).

- **Today** — day score, condition tiles in official band colors, hourly timeline, proposal cards
- **Planner** — the week: activities × forecast bands, re-plan badges
- **Activities** — your recurring schedule, with intensity and flexibility
- **Explore** — any city's UV/air/heat/pollen, public
- **Advisor** — chat grounded in live conditions and your own plan
- **Briefings** — standing daily/weekly/on-change reports
- **Profile & settings** — plain English → interpreted sensitivities → explicit Activate

## Roadmap

| Milestone | What ships |
|---|---|
| 0. Design | This document set: scope, control model, data sources, plan ✅ |
| 1. First Ship | Frontend on Vercel, all seven screens on typed mock data ✅ |
| 2. Design pass | Band-color token system, hourly timeline, visual polish ✅ *(this one)* |
| 3. The Brain | Python backend on Railway; profile interpreter + grounded chat; Explore goes live on real data |
| 4. Hands | Exposure engine (pure code, cited thresholds) + LangChain planner; propose → accept/decline |
| 5. Memory & accounts | Supabase database, sign-in, one advisor per user |
| 6. Make it feel real | Onboarding/Activate, decline-reason lessons, good windows, US pollen adapter |
| 7. Workspace | Async plan runs, threads, forecast-change supersession |
| 8. Briefings | Scheduler with cross-worker claim, on-change triggers |
| 9. Evals | Historical replay benchmark: missed risks, false alarms, measured improvement |
| 10. Polish + Blueprint | Product polish, BLUEPRINT.md demo package, BUILD_GUIDE.md |

## Stack

Next.js + Tailwind on Vercel (this repo) · Python + LangChain + DeepSeek on
Railway · Open-Meteo (weather, UV, air quality, geocoding, history — free, no
key) · Supabase (Postgres + auth). All free tier, no credit card.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.
