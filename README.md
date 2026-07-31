# AirAware

Your personal environmental-health planner: it learns your week in plain
English, watches UV, heat, air quality, and pollen where you live, builds a
day-by-day outdoor plan within deterministic exposure rules, and re-plans as
the forecast changes.

> **General guidance, not medical advice.** AirAware translates public agency
> thresholds (WHO, EPA, NWS) into practical daily suggestions. It does not
> diagnose or treat anything.

A Lantr sample project, built in the same order a student builds theirs.

## Status: Milestone 0 — Designed, not yet built

The full design — product, control model, data sources, data model, and the
milestone-by-milestone build plan — is in [DESIGN.md](DESIGN.md). Seven
screens are planned:

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
| 0. Design | This document set: scope, control model, data sources, plan ✅ *(this one)* |
| 1. First Ship | Frontend on Vercel, all seven screens on typed mock data |
| 2. Design pass | Band-color token system, hourly timeline, visual polish |
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

Nothing to run yet — Milestone 1 ships the frontend.
