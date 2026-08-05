"""Briefings — standing instructions the advisor runs on its own.

The report writer is a single grounded completion: the user's prompt plus
live conditions, today's plan, and the day's schedule. Same hard rule as
chat: never state a number that isn't in the context.

The scheduler is a 60-second loop per worker; aa_briefings.last_run_at is
the compare-and-swap claim column, so with two uvicorn workers exactly one
fires any given briefing.
"""

from __future__ import annotations

import json
import os
import time
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from openai import OpenAI

import db
import demo
import env as environment
import store
from bands import aqi_band, heat_band, uv_band

_llm: OpenAI | None = None


def _client() -> OpenAI:
    global _llm
    if _llm is None:
        _llm = OpenAI(api_key=os.environ["DEEPSEEK_API_KEY"], base_url="https://api.deepseek.com")
    return _llm


REPORT_SYSTEM = """You write AirAware briefings: short, practical reports the
user scheduled in advance. Execute their STANDING INSTRUCTION using only the
CONTEXT JSON — never state a UV level, AQI, temperature, or pollen level that
is not in it; if pollen is null, say there is no coverage. Reference their
thresholds when relevant. Markdown, under 200 words, numbers in **bold**,
no greeting and no sign-off. General guidance, not medical advice — say so
only if the instruction asks about health treatment.

{language_rule}
Keep the tone calm and practical, and never diagnose or recommend medication."""


def write_report(user_id: str, advisor: dict, briefing: dict, language: str = "zh") -> str:
    home = advisor["homeLocation"]
    cond = environment.fetch_conditions(home["lat"], home["lon"], zip_code=home.get("zip"))
    cur = cond["current"]
    today = cond["daily"][0] if cond["daily"] else {}
    plan = db.get_plan(user_id, store.today_local(home["tz"]))
    activities = [db.activity_out(r) for r in db.list_activities(user_id)]
    schedule = store.schedule_for(activities, store.today_local(home["tz"]))

    context = {
        "place": home["name"],
        "now": {**cur, "uvBand": uv_band(cur["uvIndex"])[0],
                "aqiBand": aqi_band(cur["usAqi"])[0],
                "heatBand": heat_band(cur["apparentF"])[0]},
        "today": today,
        "nextHours": cond["hourly"][cond["nowIndex"]: cond["nowIndex"] + 8],
        "todaysPlan": {
            "dayScore": plan["dayScore"],
            "summary": plan["summary"],
            "items": [{"kind": i["kind"], "title": i["title"], "status": i["status"]} for i in plan["items"]],
        } if plan else None,
        "schedule": [
            {"name": e["activity"]["name"], "start": e["start"], "end": e["end"],
             "intensity": e["activity"]["intensity"]}
            for e in schedule
        ],
        "thresholds": advisor["thresholds"],
    }

    resp = _client().chat.completions.create(
        model="deepseek-chat",
        messages=[
            {"role": "system", "content": REPORT_SYSTEM.format(
                language_rule=(
                    "Write in natural English and use Fahrenheit in user-facing text."
                    if language == "en"
                    else "Write in natural Simplified Chinese and convert Fahrenheit to Celsius in user-facing text."
                )
            ) + "\n\nCONTEXT " + json.dumps(context)},
            {"role": "user", "content": ("Standing briefing instruction: " if language == "en" else "长期简报要求：") + briefing["prompt"][:800]},
        ],
        temperature=0.5,
    )
    return resp.choices[0].message.content


def run_briefing(user_id: str, briefing: dict, advisor: dict, language: str = "zh") -> dict:
    report = write_report(user_id, advisor, briefing, language)
    return db.create_briefing_run(user_id, briefing["id"], report)


# ---------------------------------------------------------------------------
# Due logic
# ---------------------------------------------------------------------------

def _fire_cutoff(briefing: dict, tz_name: str) -> str | None:
    """If this daily/weekly briefing is due, return the ISO timestamp of this
    firing window's start (the CAS cutoff); else None."""
    tz = ZoneInfo(tz_name)
    now_local = datetime.now(tz)
    if briefing["cadence"] == "weekly" and now_local.weekday() != 4:  # Fridays
        return None
    fire_local = now_local.replace(hour=briefing["hour_local"], minute=0, second=0, microsecond=0)
    if now_local < fire_local:
        return None
    if briefing["cadence"] == "weekly":
        pass  # today is Friday and past the hour
    return fire_local.astimezone(timezone.utc).isoformat()


def _on_change_check(briefing: dict, advisor: dict) -> tuple[bool, dict]:
    """Fire when the watched signal crosses INTO the trigger band from below."""
    trigger = briefing.get("trigger") or {}
    signal = trigger.get("signal", "aqi")
    threshold = int(trigger.get("severity", 2))
    home = advisor["homeLocation"]
    cond = environment.fetch_conditions(home["lat"], home["lon"], zip_code=home.get("zip"))
    cur = cond["current"]
    severity = {
        "aqi": aqi_band(cur["usAqi"])[1],
        "uv": uv_band(cur["uvIndex"])[1],
        "heat": heat_band(cur["apparentF"])[1],
        "pollen": (cur["pollen"] or {}).get("severity", 0),
    }.get(signal, 0)
    last = int((briefing.get("trigger_state") or {}).get("lastSeverity", -1))
    fires = severity >= threshold and last < threshold
    return fires, {"lastSeverity": severity, "checkedAt": datetime.now(timezone.utc).isoformat()}


# ---------------------------------------------------------------------------
# The scheduler loop (one per worker; CAS makes firing exclusive)
# ---------------------------------------------------------------------------

ON_CHANGE_EVERY_MIN = 10
ON_CHANGE_MIN_GAP = timedelta(hours=1)


def scheduler_tick(now_utc: datetime | None = None) -> int:
    """One pass over every enabled briefing; returns how many fired."""
    fired = 0
    now_utc = now_utc or datetime.now(timezone.utc)
    advisors: dict[str, dict | None] = {}
    for b in db.all_enabled_briefings():
        try:
            uid = b["user_id"]
            if demo.is_demo_user_id(uid):
                continue
            if uid not in advisors:
                row = db.get_advisor(uid)
                advisors[uid] = db.advisor_out(row) if row else None
            advisor = advisors[uid]
            if advisor is None or advisor["paused"]:
                continue

            if b["cadence"] in ("daily", "weekly"):
                cutoff = _fire_cutoff(b, advisor["homeLocation"]["tz"])
                if cutoff and db.claim_briefing(b["id"], cutoff):
                    run_briefing(uid, b, advisor)
                    fired += 1

            elif b["cadence"] == "on_change" and now_utc.minute % ON_CHANGE_EVERY_MIN == 0:
                fires, state = _on_change_check(b, advisor)
                db.set_trigger_state(b["id"], state)
                gap_cutoff = (now_utc - ON_CHANGE_MIN_GAP).isoformat()
                if fires and db.claim_briefing(b["id"], gap_cutoff):
                    run_briefing(uid, b, advisor)
                    fired += 1
        except Exception:
            continue  # one bad briefing must not stall the loop
    return fired


def scheduler_loop() -> None:
    while True:
        try:
            scheduler_tick()
        except Exception:
            pass
        time.sleep(60)
