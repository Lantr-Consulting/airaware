# AirAware — Design, Scope & Build Plan

> The second flagship sample for Lantr's AI Agent Builder track, sibling of
> the AI Stock Analyst. A student with zero experience, following the course,
> ends with this: a live, multi-user environmental-health planner that reads
> your week and the sky and tells you when to be outside. This document is the
> approved design — written *before* the build. A `BUILD_GUIDE.md` (what
> actually happened, phase by phase) gets written after, as reconstruction
> notes, like the first sample.
>
> **General guidance, not medical advice.** Every screen carries this label.

---

## 1. What it is

**One-liner:** *AirAware is for anyone who lives part of their day outdoors —
students, runners, commuters, parents — and doesn't want to decode UV
indexes, AQI numbers, heat advisories, and pollen counts. You describe your
week in plain English, and it watches the sky for you: builds a day-by-day
plan, flags the risky hours, highlights the genuinely great outdoor windows,
and re-plans as the forecast changes.*

**Minimum complete product:** a signed-in user can describe their weekly
activities and health sensitivities in plain English, review and activate the
interpreted schedule + protection profile, generate a rule-checked day plan
whose adjustment proposals (shift the run, shorten practice, move indoors,
add sunscreen/water) they accept or decline with reasons, chat with an
advisor grounded in live conditions and their own records, and schedule a
daily morning briefing — with every recommendation traceable to a coded
threshold, and every screen labeled "guidance, not medical advice."

**Control model:** the LLM narrates; **`exposure.py` decides what's risky.**
All thresholds live in pure code, never in the prompt: WHO UV bands, the NWS
heat-index formula (Rothfusz regression) + NWS heat-risk categories, EPA
US-AQI breakpoint categories, pollen level bands, and activity-intensity
multipliers (a hard run at AQI 130 is not a picnic at AQI 130). Every plan
item carries the engine's check annotations; the engine can veto (a "great
window" label can't be awarded while any alert-band check fires) and
re-checks at accept time against the *latest* forecast. Sensitivities the
user blessed (asthma → stricter AQI cutoffs, skin type I–VI → stricter UV,
heat tolerance, kid-mode) tighten the coded thresholds. The user owns every
limit. This is the first sample's `risk.py` with one upgrade worth teaching:
these thresholds have authoritative published sources (EPA, NWS, WHO), so
"code disposes" also means **"code cites."**

It must work for **any user in any location**: home location is geocoded from
a plain-English place name, and every signal degrades gracefully where
coverage ends (see §4 — pollen is the worked example).

## 2. Capability map

| Surface | Capabilities |
|---|---|
| **Today** | Hero day-score + one-line verdict; condition tiles (UV / air / heat / pollen) in official band colors; hourly timeline with activity blocks overlaid on risk shading; plan items + pending proposal cards; "best window today" highlight; per-item "why" (the check annotations) |
| **Planner** | 7-day grid of activities × forecast bands; per-day plan status (draft / active / superseded); regenerate; forecast-change badges ("re-planned 2:10 pm — air quality worsened") |
| **Activities** | Recurring activities CRUD: name, kind (run / commute / sport / hike / chores / volunteer), days, start, duration, intensity, location, flexibility (fixed / flex-time / flex-day), has-indoor-alternative |
| **Explore** (public) | Search any city; current + 7-day UV/air/heat/pollen with band-colored charts; "what the bands mean" education panel |
| **Advisor** | Threaded persistent chat (markdown), live condition tools, "plan my day" launches a plan run into the conversation with progress, inline proposal cards with accept/decline, right rail of threads + decision history |
| **Briefings** | User-authored standing briefings (custom prompt + cadence: manual / daily / weekly / on-change when a band crosses a threshold), latest report + past runs per briefing, scheduler with cross-worker claim |
| **Profile & Settings** | Plain-English "about me" → interpreted sensitivities + threshold table; review-and-**Activate** onboarding (nothing runs until the user blesses it); home location; units; pause switch |

**The proposal loop:** plan items come in kinds
`keep | shift | shorten | relocate | indoor | gear | good_window | warning`.
Adjustment kinds arrive as proposal cards — window, rationale, evidence,
check rows, an **editable time window** (the analog of the first sample's
editable share count). Accept → the engine re-checks against the latest
forecast before the item joins the active plan. Decline requires a reason;
the last N decline reasons are injected into the planner prompt as standing
lessons ("declined 'move run to 6 am' three times: too early — stop proposing
pre-7-am windows"). Informational items (`warning`, `good_window`, `keep`)
are `auto` — no approval theater for things that change nothing.

## 3. Architecture

```
Browser (Next.js on Vercel)
   │  supabase-js session token on every request
   ▼
FastAPI on Railway (2 uvicorn workers)
   ├─ auth.py      Bearer token → Supabase /auth/v1/user → user id
   ├─ main.py      endpoints + scheduler thread + plan-run threads
   ├─ agent.py     LangChain tool-calling planner/advisor (DeepSeek)
   ├─ env.py       Open-Meteo fetchers (forecast, air quality, geocode,
   │               archive) + PollenProvider adapters (CAMS-EU, Pollen.com-US)
   ├─ exposure.py  deterministic exposure engine (pure code, cited thresholds)
   └─ db.py        PostgREST client (service key) → Supabase Postgres
External: DeepSeek (LLM, OpenAI-compatible) · Open-Meteo (weather, UV, air
quality, geocoding, history — no key) · Pollen.com (US pollen, unofficial,
no key) · Supabase (Postgres, Auth, RLS)
```

**Stack (all free tier, no credit card):** Next.js + Tailwind 4 on Vercel ·
Python FastAPI + LangChain on Railway · DeepSeek `deepseek-chat` (students
may use Claude) · Open-Meteo · Supabase.

**Data model** (typed in `lib/types.ts` from Milestone 1, mirrored by
`backend/schema.sql` in Milestone 5):

- `advisors` — one per user: profile jsonb (asthma, pollen_allergies[],
  skin_type 1–6, heat_tolerance, kid_mode, notes), thresholds jsonb (the
  user-blessed per-signal cutoffs the engine enforces), home_location jsonb
  {name, lat, lon, tz, zip?}, activated, paused.
- `activities` — name, kind, days_of_week[], start_time, duration_min,
  intensity (low/moderate/high), location jsonb, flexibility,
  indoor_alternative, enabled.
- `day_plans` — date, location, status (draft/active/superseded), day_score
  0–100, summary, conditions_snapshot jsonb (the hourly bands the plan was
  built on — makes supersession diffable), run_id.
- `plan_items` — the decisions analog: plan_id, activity_id?, kind, title,
  rationale, window jsonb {start, end}, checks jsonb[] (e.g. `{rule:
  "uv_band", value: 9, band: "very_high", threshold_source: "skin_type_2",
  pass: false}`), severity (info/caution/alert/great), status
  (proposed/accepted/declined/auto), feedback jsonb {reason}, evidence[].
- `plan_runs` — status, steer[], report, briefing_id?, dates.
- `threads` + `messages` — advisor chat.
- `briefings` — title, prompt, cadence (manual/daily/weekly/on_change),
  hour_local, trigger jsonb (signal + band for on_change), enabled,
  last_run_at (CAS claim column).

RLS: users read only their own rows ("two people, two worlds"); writes go
through the backend service key. Explore uses public endpoints.

**Key API surface:** `/me`, `/me/settings`, `/me/activate`,
`/interpret-profile`, `/activities` CRUD, `/plan/today`, `/plan-runs`
(+ `/steer`), `/plan-items/{id}/accept` (with edited window) / `/decline`
(with reason), `/chat` (+ `/chat/history`), `/threads`, `/briefings`
(+ `/run`), public `/conditions?lat&lon` and `/conditions/search?q=`.

**Agent tools:** `get_hourly_conditions`, `get_air_quality`, `get_pollen`
(null-tolerant), `get_user_schedule(date)`, `geocode_place`, and
`score_window(activity, start, end)` — the exposure engine itself exposed as
a tool. The agent searches for good windows *with the ruler in hand*, and the
server re-runs the same engine on whatever it proposes. Model proposes; code
still measures the final cut.

## 4. Data sources

All verified free, keyless, and card-free (Open-Meteo non-commercial limits:
600/min, 10,000/day — ample for a whole cohort):

| Signal | Source |
|---|---|
| Weather, UV, heat inputs | `api.open-meteo.com/v1/forecast` — hourly temperature, apparent temperature, humidity, uv_index, cloud cover, precipitation probability, wind; daily maxes; 7–16-day horizon |
| Air quality | `air-quality-api.open-meteo.com/v1/air-quality` — us_aqi, european_aqi, pm2_5, pm10, ozone; **global**; supports past dates for replay |
| Geocoding | `geocoding-api.open-meteo.com/v1/search` — any city, worldwide |
| Historical weather (evals) | `archive-api.open-meteo.com/v1/archive` — actuals back to 1940 |
| Pollen — Europe | Open-Meteo air-quality API pollen fields (CAMS; alder, birch, grass, mugwort, olive, ragweed) — official, Europe-only |
| Pollen — US | `www.pollen.com/api/forecast/current/pollen/{zip}` (+ `/extended` 5-day) — **unofficial**, no key; needs a `Referer: https://www.pollen.com` header |

**The pollen decision (teachable):** there is no official global pollen API
that satisfies the no-credit-card rule (Google Pollen requires a billing
account; Tomorrow.io gates pollen behind premium; AccuWeather's free tier
became an expiring trial). So `env.py` exposes one `get_pollen()` behind a
provider interface — CAMS in Europe, Pollen.com in the US, `null` elsewhere —
and **pollen is a nullable signal end-to-end**: the engine skips pollen
checks when data is null, the UI says "Pollen: no coverage here," and the
agent is prompted never to invent pollen levels (this project's version of
"never assert market facts from memory"). The US adapter is taught explicitly
as *an unofficial API that will break someday* — real environmental products
face exactly this geography problem, and "tool errors are data."

## 5. Build plan: milestone by milestone

Each milestone is one working session ending with a deploy and a git tag,
mapped onto the AI Agent Builder modules the same way the first sample was.

### Milestone 0 — Design (this commit) — `milestone-0-design`
This document, README, conventions files. No code: the project brief precedes
the dev environment in the course, and the sample stays honest to that order.

### Milestone 1 — First Ship: the face — `milestone-1-first-ship`
Scaffold Next.js + Tailwind. Build all seven screens against **typed mock
data shaped like the real records** (`lib/types.ts`, `lib/mock.ts` — a full
mock week for a fixture user) so later milestones swap mocks for APIs without
reshaping UI. GitHub public repo, Vercel deploy. Known gotchas from the first
sample apply: lowercase folder name, connect the repo and ship via push.

### Milestone 2 — Design pass — `milestone-2-design`
Design tokens in `globals.css` — including the **official band palettes**
(UV green→violet, EPA AQI green→maroon) as CSS custom properties; here the
color system *is* the domain model. Hourly timeline SVG, wordmark, favicon,
focus states. Verify in the browser, not just the build.

### Milestone 3 — The Brain — `milestone-3-brain`
FastAPI on Railway (Procfile, 2 workers, `.railwayignore`).
`/interpret-profile` (plain English → sensitivities/threshold JSON via
JSON-mode prompt) and `/chat` grounded in current conditions. **First real
data ships here:** `env.py` + the public `/conditions` endpoints power
Explore live — Open-Meteo's keylessness lets this sample touch real data a
full phase earlier than the stock analyst could.

### Milestone 4 — Hands — `milestone-4-hands`
`exposure.py`: bands, NWS heat index, EPA cutpoints, intensity multipliers,
window scoring, veto — with unit-tested thresholds against published tables.
LangChain planner agent + tools including `score_window`. Day-plan generation
→ proposal cards → accept/decline. The set-piece demo: the agent proposes a
noon run at UV 10 and the engine strips the "great window" label — model
proposes, code disposes.

### Milestone 5 — Memory & accounts — `milestone-5-memory`
Supabase: schema above, magic-link sign-in, RLS read-own policies, backend
auth dependency; plans, threads, and activities move to Postgres; per-user
thresholds enforced server-side. First-sample gotchas carry over: ~2 magic
links/hour on free email, set Site URL + redirect allowlist early, admin
`generate_link` is the test harness.

### Milestone 6 — Make it feel real — `milestone-6-feel-real`
The user-feedback lab. Onboarding: advisors start empty + inactive → describe
→ review interpreted profile & thresholds → explicit Activate.
Decline-reasons → standing lessons injection. A "highlight good windows, not
just warnings" pass (prompt + the engine's `great` band). The US pollen
adapter + graceful-degradation UX. Scrub stale language from every prompt —
and patch prompts with asserts.

### Milestone 7 — Workspace — `milestone-7-workspace`
Async plan runs (background thread + DB-status polling + progress UI +
steering saved for the next run), threaded chat history, **forecast-change
supersession** (a re-plan diffs against `conditions_snapshot` and supersedes
stale proposals), per-user run lock in the database (CAS — an in-memory lock
dies with 2 workers).

### Milestone 8 — Briefings — `milestone-8-briefings`
`briefings` CRUD + Run now; 60-second scheduler claiming due briefings via
compare-and-swap so exactly one worker fires; the `on_change` cadence polls
bands and fires on a threshold cross. Briefing reports live on their own
cards; chat-initiated plan runs report into their thread — keep the surfaces
separate.

### Milestone 9 — Evals: the replay benchmark — `milestone-9-evals`
Where this sample beats the first one pedagogically: **ground truth is
computable.** Three fixture personas × fixed weekly schedules (one persona on
the EU pollen path). Replay ~30 past days per location: fetch actuals from
the archive + air-quality history APIs, have the system plan each day from
that day's data, then run `exposure.py` over the actuals as the oracle.
Deterministic scores: *missed-risk rate* (activity-hours in an oracle alert
band with no covering warning/adjustment), *false-alarm rate* (the cry-wolf
metric), *good-window precision* (did `good_window` items land in
oracle-green hours?). Plus an LLM-judge rubric for clarity, actionability,
and grounding (does the rationale cite the numbers in `checks`?). Commit the
baseline, then land **one measured improvement**.

### Milestone 10 — Polish + BLUEPRINT — `milestone-10-blueprint`
Theme finalization (light/dark token sets), markdown chat bubbles, optimistic
actions + toasts, notification bell, status filters, sticky rails. Write
`BLUEPRINT.md` as the Demo Day package and `BUILD_GUIDE.md` as the
reconstruction record.

## 6. Deliberately out of scope

No medical diagnosis or treatment advice — thresholds and phrasing stay at
the level of public agency guidance, and the "general guidance, not medical
advice" label is permanent. No push notifications/SMS in v1 (briefings render
in-app). No wearables or health-record integrations. No route-level
micro-navigation (we suggest "the shaded park loop instead of the exposed
track," not turn-by-turn). No paid data sources, ever — the no-credit-card
rule is a design constraint, not a budget preference.
