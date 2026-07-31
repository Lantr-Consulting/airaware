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

## Status: Milestone 3 — The Brain

The Python backend is live on Railway and the app now touches the real sky:
**Explore searches any city on Earth** (Open-Meteo forecast + air quality +
geocoding, no key), pollen via regional adapters (CAMS in Europe, Pollen.com
by US ZIP, honest "no coverage" elsewhere), the **Advisor chats grounded in
live conditions** (DeepSeek), and **Interpret** turns a plain-English
description into the sensitivity profile and threshold table. Every call
degrades gracefully to the sample data when the backend is unreachable.
Today/Planner stay on the mock week until the exposure engine lands in
Milestone 4. The full design and build plan is in [DESIGN.md](DESIGN.md).

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
| 2. Design pass | Band-color token system, hourly timeline, visual polish ✅ |
| 3. The Brain | Python backend on Railway; profile interpreter + grounded chat; Explore goes live on real data ✅ *(this one)* |
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

Then open http://localhost:3000. For the backend (optional — the frontend
falls back to sample data without it):

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
echo "DEEPSEEK_API_KEY=sk-..." > .env   # any OpenAI-compatible key works
.venv/bin/uvicorn main:app --port 8010
```

Backend in production: https://airaware-backend-production.up.railway.app
