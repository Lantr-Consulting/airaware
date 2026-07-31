"""Milestone 4 plan store — plans.json on local disk.

Gitignored and ephemeral on Railway (a restart loses it); Supabase replaces
this in Milestone 5, exactly like the first sample's decisions.json. One
shared demo advisor until accounts exist; these records mirror lib/mock.ts.
"""

from __future__ import annotations

import json
import threading
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

PATH = Path(__file__).parent / "plans.json"
_lock = threading.Lock()

DEFAULT_ADVISOR = {
    "profile": {
        "asthma": False,
        "pollenAllergies": ["grass", "ragweed"],
        "skinType": 2,
        "heatTolerance": "typical",
        "kidMode": False,
        "notes": "Trains for a 10K in October. Prefers mornings but not before 6:30. Dog needs a real walk every evening.",
    },
    "thresholds": {
        "uvProtect": 3,
        "uvAvoid": 8,
        "aqiCaution": 100,
        "aqiAvoid": 150,
        "heatCautionF": 95,
        "heatAvoidF": 103,
        "pollenCaution": 2,
    },
    "home": {"name": "Austin, TX", "lat": 30.27, "lon": -97.74, "tz": "America/Chicago", "zip": "78701"},
}

# The demo user's recurring week (mirror of lib/mock.ts ACTIVITIES).
ACTIVITIES = [
    {"id": "a1", "name": "Morning run", "kind": "run", "daysOfWeek": [1, 3, 5], "startTime": "07:00", "durationMin": 45, "intensity": "high", "flexibility": "flex_time", "indoorAlternative": "Treadmill at the gym"},
    {"id": "a2", "name": "Bike commute", "kind": "commute", "daysOfWeek": [1, 2, 3, 4, 5], "startTime": "08:30", "durationMin": 25, "intensity": "moderate", "flexibility": "fixed"},
    {"id": "a3", "name": "Soccer practice", "kind": "sport", "daysOfWeek": [2, 4], "startTime": "17:30", "durationMin": 90, "intensity": "high", "flexibility": "fixed", "indoorAlternative": "Indoor futsal court"},
    {"id": "a4", "name": "Trail hike", "kind": "hike", "daysOfWeek": [6], "startTime": "09:00", "durationMin": 180, "intensity": "moderate", "flexibility": "flex_day"},
    {"id": "a5", "name": "Evening dog walk", "kind": "chores", "daysOfWeek": [0, 1, 2, 3, 4, 5, 6], "startTime": "20:00", "durationMin": 30, "intensity": "low", "flexibility": "flex_time"},
    {"id": "a6", "name": "Community garden shift", "kind": "volunteer", "daysOfWeek": [0], "startTime": "10:00", "durationMin": 120, "intensity": "moderate", "flexibility": "flex_time"},
]


def activity(activity_id: str) -> dict | None:
    return next((a for a in ACTIVITIES if a["id"] == activity_id), None)


def _add_min(hhmm: str, minutes: int) -> str:
    hh, mm = map(int, hhmm.split(":"))
    total = hh * 60 + mm + minutes
    return f"{(total // 60) % 24:02d}:{total % 60:02d}"


def today_local() -> str:
    tz = ZoneInfo(DEFAULT_ADVISOR["home"]["tz"])
    return datetime.now(tz).date().isoformat()


def schedule_for(date_iso: str) -> list[dict]:
    dow = datetime.fromisoformat(date_iso).weekday()  # Mon=0
    dow_sun0 = (dow + 1) % 7  # match JS getDay(): Sun=0
    out = []
    for a in ACTIVITIES:
        if dow_sun0 in a["daysOfWeek"]:
            out.append({"activity": a, "start": a["startTime"], "end": _add_min(a["startTime"], a["durationMin"])})
    return sorted(out, key=lambda e: e["start"])


# ---------- plans.json ----------

def _load() -> dict:
    if PATH.exists():
        try:
            return json.loads(PATH.read_text())
        except json.JSONDecodeError:
            return {"plans": {}}
    return {"plans": {}}


def _save(data: dict) -> None:
    PATH.write_text(json.dumps(data, indent=1))


def get_plan(date_iso: str) -> dict | None:
    with _lock:
        return _load()["plans"].get(date_iso)


def put_plan(plan: dict) -> None:
    with _lock:
        data = _load()
        data["plans"][plan["date"]] = plan
        _save(data)


def update_item(item_id: str, mutate) -> dict | None:
    """Apply `mutate(item, plan)` to the item with this id; returns the
    updated item or None if not found."""
    with _lock:
        data = _load()
        for plan in data["plans"].values():
            for item in plan.get("items", []):
                if item.get("id") == item_id:
                    mutate(item, plan)
                    _save(data)
                    return item
    return None
