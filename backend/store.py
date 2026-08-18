"""Defaults + schedule helpers.

Milestone 5 moved the actual records to Supabase (db.py); what remains here
is the seed data every new account starts from — a sensible profile and a
starter week the user edits into their own — plus pure schedule math.
"""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

DEFAULT_ADVISOR = {
    "profile": {
        "asthma": False,
        "pollenAllergies": [],
        "skinType": 3,
        "heatTolerance": "typical",
        "kidMode": False,
        "notes": "",
    },
    "thresholds": {
        "uvProtect": 4,
        "uvAvoid": 8,
        "aqiCaution": 100,
        "aqiAvoid": 150,
        "heatCautionF": 95,
        "heatAvoidF": 103,
        "pollenCaution": 2,
    },
    "home": {"name": "美国 · 奥斯汀", "lat": 30.27, "lon": -97.74, "tz": "America/Chicago", "zip": "78701"},
}

DEFAULT_ADVISOR_EN = {
    **DEFAULT_ADVISOR,
    "home": {"name": "Austin, TX", "lat": 30.27, "lon": -97.74, "tz": "America/Chicago", "zip": "78701"},
}

# The starter week (camelCase — the shape db.create_activity accepts).
DEFAULT_ACTIVITIES = [
    {"name": "晨跑", "kind": "run", "daysOfWeek": [1, 3, 5], "startTime": "07:00", "durationMin": 45, "intensity": "high", "flexibility": "flex_time", "indoorAlternative": "健身房跑步机", "enabled": True},
    {"name": "骑车通勤", "kind": "commute", "daysOfWeek": [1, 2, 3, 4, 5], "startTime": "08:30", "durationMin": 25, "intensity": "moderate", "flexibility": "fixed", "enabled": True},
    {"name": "晚间遛狗", "kind": "chores", "daysOfWeek": [0, 1, 2, 3, 4, 5, 6], "startTime": "20:00", "durationMin": 30, "intensity": "low", "flexibility": "flex_time", "enabled": True},
]


DEFAULT_ACTIVITIES_EN = [
    {"name": "Morning run", "kind": "run", "daysOfWeek": [1, 3, 5], "startTime": "07:00", "durationMin": 45, "intensity": "high", "flexibility": "flex_time", "indoorAlternative": "Treadmill at the gym", "enabled": True},
    {"name": "Bike commute", "kind": "commute", "daysOfWeek": [1, 2, 3, 4, 5], "startTime": "08:30", "durationMin": 25, "intensity": "moderate", "flexibility": "fixed", "enabled": True},
    {"name": "Evening dog walk", "kind": "chores", "daysOfWeek": [0, 1, 2, 3, 4, 5, 6], "startTime": "20:00", "durationMin": 30, "intensity": "low", "flexibility": "flex_time", "enabled": True},
]


def _add_min(hhmm: str, minutes: int) -> str:
    hh, mm = map(int, hhmm.split(":"))
    total = hh * 60 + mm + minutes
    return f"{(total // 60) % 24:02d}:{total % 60:02d}"


def today_local(tz_name: str) -> str:
    return datetime.now(ZoneInfo(tz_name)).date().isoformat()


def schedule_for(activities: list[dict], date_iso: str) -> list[dict]:
    """Which activities (camelCase records) land on this date, with windows."""
    dow = datetime.fromisoformat(date_iso).weekday()  # Mon=0
    dow_sun0 = (dow + 1) % 7  # match JS getDay(): Sun=0
    out = []
    for a in activities:
        if a.get("enabled", True) and dow_sun0 in a["daysOfWeek"]:
            out.append({"activity": a, "start": a["startTime"], "end": _add_min(a["startTime"], a["durationMin"])})
    return sorted(out, key=lambda e: e["start"])
