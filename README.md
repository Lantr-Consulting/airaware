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

## Status: Milestone 4 — Hands

The planner is real. `backend/exposure.py` is the deterministic exposure
engine — NWS Rothfusz heat index, WHO/EPA/Pollen.com bands,
intensity-scaled thresholds, all **unit-tested against published tables**
(`pytest`). A LangChain agent builds the day plan holding the engine as a
tool (`score_window`), and the server re-runs the same engine over every
item it proposes — including the veto that strips a "great window" label
the numbers don't support, which fired on our very first live run (pollen).
**Today is live:** plan generation, hourly timeline from the real forecast,
and accept/decline — accept re-checks against the *latest* forecast and
refuses windows that now cross an avoid line. The advisor chats grounded in
live conditions; Explore searches any city on Earth. Everything degrades to
sample data offline. Full design in [DESIGN.md](DESIGN.md).

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
| 3. The Brain | Python backend on Railway; profile interpreter + grounded chat; Explore goes live on real data ✅ |
| 4. Hands | Exposure engine (pure code, cited thresholds) + LangChain planner; propose → accept/decline ✅ *(this one)* |
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
