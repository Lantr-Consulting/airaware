"""The planner — a LangChain tool-calling agent with the ruler in its hand.

The agent reads the schedule and the sky, and it can call score_window —
the exposure engine itself — while searching for better times. Whatever it
proposes, the SERVER re-runs the same engine over every item (annotate +
veto) before anything reaches the user. Model proposes; code disposes.
"""

from __future__ import annotations

import json
import os
import uuid

from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI

import env as environment
import exposure
import store

# Context for the current run — set by run_plan, read by the tools.
_ctx: dict = {"hourly": [], "date": None}

ADJUSTMENT_KINDS = {"shift", "shorten", "relocate", "indoor"}
ALL_KINDS = ADJUSTMENT_KINDS | {"keep", "gear", "good_window", "warning"}


@tool
def get_conditions() -> str:
    """Today's hourly forecast for the user's home: time, UV index, feels-like
    (F), US AQI, and pollen index (null = no coverage)."""
    compact = [
        {
            "t": h["time"][11:16],
            "uv": h["uvIndex"],
            "feelsF": h["apparentF"],
            "aqi": h["usAqi"],
            "pollen": h["pollen"]["index"] if h.get("pollen") else None,
        }
        for h in _ctx["hourly"]
        if 6 <= int(h["time"][11:13]) <= 21
    ]
    return json.dumps(compact)


@tool
def get_schedule() -> str:
    """The user's scheduled activities for the day being planned: id, name,
    window, intensity, flexibility (fixed / flex_time / flex_day), and any
    indoor alternative."""
    entries = store.schedule_for(_ctx["date"])
    return json.dumps(
        [
            {
                "activityId": e["activity"]["id"],
                "name": e["activity"]["name"],
                "window": {"start": e["start"], "end": e["end"]},
                "intensity": e["activity"]["intensity"],
                "flexibility": e["activity"]["flexibility"],
                "indoorAlternative": e["activity"].get("indoorAlternative"),
            }
            for e in entries
        ]
    )


@tool
def score_window(activity_id: str, start: str, end: str) -> str:
    """Score a candidate time window (HH:MM-HH:MM) for an activity with the
    deterministic exposure engine. Use this BEFORE proposing any window.
    Returns score 0-100, severity, whether 'great' is allowed, and every
    check with the number that fired."""
    activity = store.activity(activity_id)
    if activity is None and activity_id not in ("", "none", "free"):
        return f"ERROR: unknown activity_id '{activity_id}'. Use get_schedule for valid ids, or 'free' for an unscheduled window."
    try:
        hours = exposure.hours_in_window(_ctx["hourly"], start, end)
    except (ValueError, IndexError) as e:
        return f"ERROR: bad window '{start}-{end}' (use HH:MM): {e}"
    verdict = exposure.evaluate_window(
        hours,
        (activity or {}).get("intensity", "moderate"),
        store.DEFAULT_ADVISOR["thresholds"],
        store.DEFAULT_ADVISOR["profile"],
    )
    return json.dumps(
        {
            "score": verdict["score"],
            "severity": verdict["severity"],
            "greatAllowed": verdict["greatAllowed"],
            "checks": [{"detail": c["detail"], "pass": c["pass"]} for c in verdict["checks"]],
        }
    )


SYSTEM = """You are AirAware's day planner. Build today's outdoor plan for the
user from their schedule and the hourly forecast.

Procedure — follow it exactly:
1. get_schedule, then get_conditions.
2. For EVERY scheduled activity, score its current window with score_window.
3. If a window scores poorly and the activity is flexible, search for a
   better one WITH score_window (flex_time: same day; fixed: you may only
   warn, suggest gear, shorten, or the indoor alternative).
4. Score any window before you call it good. At most one good_window item,
   for the best free slot of the day (activity_id 'free').

Then answer with ONLY a JSON object (no prose, no code fences):
{{"summary": "<2-3 sentences on the day, citing real numbers>",
 "items": [{{"kind": "keep|shift|shorten|relocate|indoor|gear|good_window|warning",
            "activityId": "<id or null>",
            "title": "<short, human, specific>",
            "rationale": "<cite the actual numbers from your tool calls>",
            "window": {{"start": "HH:MM", "end": "HH:MM"}} or null,
            "originalWindow": {{"start": "HH:MM", "end": "HH:MM"}} or null}}]}}

Rules:
- 3 to 6 items. Exactly one item per scheduled activity, plus at most one
  good_window and at most one day-level warning.
- shift/shorten/relocate/indoor MUST include both window and originalWindow.
- Never state a number you did not get from a tool. Pollen null means no
  coverage — say so if relevant, never guess a level.
- Respect flexibility: never move a fixed activity's time.
- Tone: practical and specific, not alarmist. Prefer better windows over
  bans; highlight what's genuinely good about the day."""


def _build_executor() -> AgentExecutor:
    llm = ChatOpenAI(
        model="deepseek-chat",
        api_key=os.getenv("DEEPSEEK_API_KEY"),
        base_url="https://api.deepseek.com",
        temperature=0.3,
    )
    prompt = ChatPromptTemplate.from_messages(
        [("system", SYSTEM), ("human", "{input}"), ("placeholder", "{agent_scratchpad}")]
    )
    tools = [get_conditions, get_schedule, score_window]
    return AgentExecutor(
        agent=create_tool_calling_agent(llm, tools, prompt),
        tools=tools,
        max_iterations=18,
        handle_parsing_errors=True,
    )


def _extract_json(text: str) -> dict:
    """The model was told 'JSON only', but belts and suspenders: find the
    first balanced object in the output."""
    start = text.find("{")
    if start == -1:
        raise ValueError("no JSON object in agent output")
    depth = 0
    for i in range(start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                return json.loads(text[start : i + 1])
    raise ValueError("unbalanced JSON in agent output")


def run_plan(date_iso: str) -> dict:
    """Generate, engine-check, and return the day plan record."""
    home = store.DEFAULT_ADVISOR["home"]
    hourly = environment.fetch_conditions(home["lat"], home["lon"], zip_code=home.get("zip"))["hourly"]
    _ctx["hourly"] = hourly
    _ctx["date"] = date_iso

    result = _build_executor().invoke(
        {"input": f"Build the day plan for {date_iso}. The user's home is {home['name']}."}
    )
    raw = _extract_json(result["output"])

    thresholds = store.DEFAULT_ADVISOR["thresholds"]
    profile = store.DEFAULT_ADVISOR["profile"]
    schedule = store.schedule_for(date_iso)

    items = []
    for raw_item in (raw.get("items") or [])[:6]:
        kind = raw_item.get("kind")
        if kind not in ALL_KINDS:
            continue
        window = raw_item.get("window")
        if window and not (isinstance(window, dict) and "start" in window and "end" in window):
            window = None
        activity = store.activity(raw_item.get("activityId") or "")
        if kind in ADJUSTMENT_KINDS and activity and activity["flexibility"] == "fixed" and kind == "shift":
            continue  # the engine's schedule rules also dispose
        item = {
            "id": uuid.uuid4().hex[:12],
            "activityId": activity["id"] if activity else None,
            "kind": kind,
            "title": str(raw_item.get("title", ""))[:120],
            "rationale": str(raw_item.get("rationale", ""))[:600],
            "window": window,
            "originalWindow": raw_item.get("originalWindow") if kind in ADJUSTMENT_KINDS else None,
            "severity": "info",
            "status": "proposed" if kind in ADJUSTMENT_KINDS else "auto",
            "evidence": ["Hourly forecast + air quality, Open-Meteo (live)", "Exposure engine checks"],
        }
        items.append(exposure.annotate_item(item, hourly, activity, thresholds, profile))

    return {
        "id": uuid.uuid4().hex[:12],
        "date": date_iso,
        "location": {"name": home["name"], "lat": home["lat"], "lon": home["lon"], "tz": home["tz"]},
        "status": "active",
        "dayScore": exposure.day_score(hourly, schedule, thresholds, profile),
        "summary": str(raw.get("summary", ""))[:600],
        "items": items,
    }
