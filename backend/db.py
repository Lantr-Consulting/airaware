"""Supabase data access (PostgREST) — per-user advisors, activities, plans.

The backend uses the secret (service) key, which bypasses Row-Level
Security; authorization happens in auth.py by resolving the caller's JWT to
a user id, and every query here filters on that user id. Users' direct
reads are protected by the RLS policies in schema.sql.

Rows are snake_case in Postgres and camelCase over the API; the _out()
helpers do the renaming so lib/types.ts never changes shape.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

import requests as http

URL = os.environ["SUPABASE_URL"].rstrip("/")
SECRET = os.environ["SUPABASE_SECRET_KEY"]


def _headers(extra: dict[str, str] | None = None) -> dict[str, str]:
    return {
        "apikey": SECRET,
        "Authorization": f"Bearer {SECRET}",
        "Content-Type": "application/json",
        **(extra or {}),
    }


def _rest(method: str, path: str, *, params: dict | None = None, json: Any = None,
          extra_headers: dict | None = None) -> Any:
    r = http.request(
        method,
        f"{URL}/rest/v1/{path}",
        headers=_headers(extra_headers),
        params=params,
        json=json,
        timeout=20,
    )
    r.raise_for_status()
    return r.json() if r.text else None


_REPR = {"Prefer": "return=representation"}


# ---------------------------------------------------------------------------
# Advisors (one row per user)
# ---------------------------------------------------------------------------

def advisor_out(row: dict) -> dict:
    return {
        "profile": row["profile"],
        "thresholds": row["thresholds"],
        "homeLocation": row["home_location"],
        "units": row["units"],
        "activated": row["activated"],
        "paused": row["paused"],
    }


def get_advisor(user_id: str) -> dict | None:
    rows = _rest("GET", "aa_advisors", params={"user_id": f"eq.{user_id}", "limit": 1})
    return rows[0] if rows else None


def ensure_advisor(user_id: str, email: str, defaults: dict, default_activities: list[dict]) -> dict:
    """First sign-in: create the advisor row and seed the starter week of
    activities so the planner has something to plan."""
    advisor = get_advisor(user_id)
    if advisor:
        return advisor
    row = {
        "user_id": user_id,
        "email": email,
        "profile": defaults["profile"],
        "thresholds": defaults["thresholds"],
        "home_location": defaults["home"],
        "units": "metric",
        # New advisors start inactive: describe -> review -> explicit
        # Activate. Nothing plans until the user blesses it.
        "activated": False,
    }
    created = _rest("POST", "aa_advisors", json=row, extra_headers=_REPR)[0]
    for a in default_activities:
        create_activity(user_id, a)
    # Every new account starts with one sensible standing briefing.
    create_briefing(user_id, {
        "title": "晨间简报",
        "prompt": "总结今天：如已有计划则说明当天评分，指出已安排活动的风险、需要穿戴或携带的物品，以及最适合户外活动的一个时段。",
        "cadence": "daily",
        "hourLocal": 7,
    })
    return created


def update_advisor(user_id: str, fields: dict) -> dict:
    fields = {**fields, "updated_at": datetime.now(timezone.utc).isoformat()}
    rows = _rest("PATCH", "aa_advisors", params={"user_id": f"eq.{user_id}"},
                 json=fields, extra_headers=_REPR)
    return rows[0]


# ---------------------------------------------------------------------------
# Activities
# ---------------------------------------------------------------------------

def activity_out(row: dict) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "kind": row["kind"],
        "daysOfWeek": row["days_of_week"],
        "startTime": row["start_time"],
        "durationMin": row["duration_min"],
        "intensity": row["intensity"],
        "flexibility": row["flexibility"],
        "indoorAlternative": row.get("indoor_alternative"),
        "enabled": row["enabled"],
    }


def _activity_in(fields: dict) -> dict:
    mapping = {
        "name": "name", "kind": "kind", "daysOfWeek": "days_of_week",
        "startTime": "start_time", "durationMin": "duration_min",
        "intensity": "intensity", "flexibility": "flexibility",
        "indoorAlternative": "indoor_alternative", "enabled": "enabled",
    }
    return {mapping[k]: v for k, v in fields.items() if k in mapping}


def list_activities(user_id: str) -> list[dict]:
    rows = _rest("GET", "aa_activities",
                 params={"user_id": f"eq.{user_id}", "order": "start_time"})
    return rows


def create_activity(user_id: str, fields: dict) -> dict:
    row = {"user_id": user_id, **_activity_in(fields)}
    return _rest("POST", "aa_activities", json=row, extra_headers=_REPR)[0]


def update_activity(user_id: str, activity_id: str, fields: dict) -> dict | None:
    rows = _rest("PATCH", "aa_activities",
                 params={"id": f"eq.{activity_id}", "user_id": f"eq.{user_id}"},
                 json=_activity_in(fields), extra_headers=_REPR)
    return rows[0] if rows else None


def delete_activity(user_id: str, activity_id: str) -> None:
    _rest("DELETE", "aa_activities",
          params={"id": f"eq.{activity_id}", "user_id": f"eq.{user_id}"})


# ---------------------------------------------------------------------------
# Day plans + items
# ---------------------------------------------------------------------------

def item_out(row: dict) -> dict:
    return {
        "id": row["id"],
        "activityId": row.get("activity_id"),
        "kind": row["kind"],
        "title": row["title"],
        "rationale": row["rationale"],
        "window": row.get("window"),
        "originalWindow": row.get("original_window"),
        "checks": row["checks"],
        "severity": row["severity"],
        "status": row["status"],
        "feedback": row.get("feedback"),
        "evidence": row["evidence"],
        "score": row.get("score"),
    }


def plan_out(plan_row: dict, item_rows: list[dict]) -> dict:
    return {
        "id": plan_row["id"],
        "date": plan_row["date"],
        "location": plan_row["location"],
        "status": plan_row["status"],
        "dayScore": plan_row["day_score"],
        "summary": plan_row["summary"],
        "supersededNote": plan_row.get("superseded_note"),
        "items": [item_out(r) for r in item_rows],
    }


def get_plan(user_id: str, date_iso: str) -> dict | None:
    plans = _rest("GET", "aa_day_plans",
                  params={"user_id": f"eq.{user_id}", "date": f"eq.{date_iso}",
                          "status": "eq.active", "limit": 1})
    if not plans:
        return None
    items = _rest("GET", "aa_plan_items",
                  params={"plan_id": f"eq.{plans[0]['id']}", "order": "created_at"})
    return plan_out(plans[0], items)


def supersede_plan(user_id: str, date_iso: str) -> dict | None:
    """Mark the current active plan superseded; returns it (with its
    conditions snapshot) so the new plan can diff against it."""
    rows = _rest("PATCH", "aa_day_plans",
                 params={"user_id": f"eq.{user_id}", "date": f"eq.{date_iso}", "status": "eq.active"},
                 json={"status": "superseded"}, extra_headers=_REPR)
    return rows[0] if rows else None


def put_plan(user_id: str, plan: dict) -> dict:
    """Insert the new active plan (the old one was superseded first)."""
    plan_row = _rest("POST", "aa_day_plans", json={
        "user_id": user_id,
        "date": plan["date"],
        "location": plan["location"],
        "status": plan["status"],
        "day_score": plan["dayScore"],
        "summary": plan["summary"],
        "conditions_snapshot": plan.get("conditionsSnapshot"),
        "superseded_note": plan.get("supersededNote"),
    }, extra_headers=_REPR)[0]
    item_rows = []
    for it in plan["items"]:
        item_rows.append({
            "plan_id": plan_row["id"],
            "user_id": user_id,
            "activity_id": it.get("activityId"),
            "kind": it["kind"],
            "title": it["title"],
            "rationale": it["rationale"],
            "window": it.get("window"),
            "original_window": it.get("originalWindow"),
            "checks": it["checks"],
            "severity": it["severity"],
            "status": it["status"],
            "evidence": it["evidence"],
            "score": it.get("score"),
        })
    created = _rest("POST", "aa_plan_items", json=item_rows, extra_headers=_REPR) if item_rows else []
    return plan_out(plan_row, created)


def recent_decline_lessons(user_id: str, limit: int = 8) -> list[dict]:
    """The feedback loop: reasons from past declines become standing
    instructions for the next plan."""
    rows = _rest("GET", "aa_plan_items", params={
        "user_id": f"eq.{user_id}",
        "status": "eq.declined",
        "feedback": "not.is.null",
        "order": "created_at.desc",
        "limit": limit,
        "select": "title,feedback,created_at",
    })
    return [
        {"title": r["title"], "reason": (r.get("feedback") or {}).get("reason", "")}
        for r in rows
        if (r.get("feedback") or {}).get("reason")
    ]


def get_item(user_id: str, item_id: str) -> dict | None:
    rows = _rest("GET", "aa_plan_items",
                 params={"id": f"eq.{item_id}", "user_id": f"eq.{user_id}", "limit": 1})
    return rows[0] if rows else None


def update_item(user_id: str, item_id: str, fields: dict) -> dict | None:
    rows = _rest("PATCH", "aa_plan_items",
                 params={"id": f"eq.{item_id}", "user_id": f"eq.{user_id}"},
                 json=fields, extra_headers=_REPR)
    return rows[0] if rows else None


# ---------------------------------------------------------------------------
# Plan runs + the DB run lock (CAS — survives multiple workers)
# ---------------------------------------------------------------------------

def acquire_run_lock(user_id: str, stale_minutes: int = 15) -> bool:
    """Compare-and-swap on aa_advisors.run_lock_at: claim only if free or
    stale. Exactly one of two workers wins."""
    cutoff = datetime.now(timezone.utc).timestamp() - stale_minutes * 60
    cutoff_iso = datetime.fromtimestamp(cutoff, tz=timezone.utc).isoformat()
    rows = _rest("PATCH", "aa_advisors",
                 params={
                     "user_id": f"eq.{user_id}",
                     "or": f"(run_lock_at.is.null,run_lock_at.lt.{cutoff_iso})",
                 },
                 json={"run_lock_at": datetime.now(timezone.utc).isoformat()},
                 extra_headers=_REPR)
    return bool(rows)


def release_run_lock(user_id: str) -> None:
    _rest("PATCH", "aa_advisors", params={"user_id": f"eq.{user_id}"},
          json={"run_lock_at": None})


def run_out(r: dict) -> dict:
    return {
        "id": r["id"],
        "status": r["status"],
        "dates": r["dates"],
        "steer": r["steer"],
        "report": r.get("report"),
        "error": r.get("error"),
        "startedAt": r["started_at"],
        "finishedAt": r.get("finished_at"),
    }


def create_run(user_id: str, dates: list[str]) -> dict:
    return _rest("POST", "aa_plan_runs",
                 json={"user_id": user_id, "dates": dates},
                 extra_headers=_REPR)[0]


def update_run(run_id: str, fields: dict) -> None:
    _rest("PATCH", "aa_plan_runs", params={"id": f"eq.{run_id}"}, json=fields)


def get_run(user_id: str, run_id: str) -> dict | None:
    rows = _rest("GET", "aa_plan_runs",
                 params={"id": f"eq.{run_id}", "user_id": f"eq.{user_id}", "limit": 1})
    return rows[0] if rows else None


def latest_run_steer(user_id: str) -> list[str]:
    """Steering notes from the most recent run — 'saved for the next cycle'."""
    rows = _rest("GET", "aa_plan_runs",
                 params={"user_id": f"eq.{user_id}", "order": "started_at.desc", "limit": 2})
    notes: list[str] = []
    for r in rows:
        notes.extend(n for n in (r.get("steer") or []) if isinstance(n, str))
    return notes[:5]


def append_steer(user_id: str, run_id: str, note: str) -> dict | None:
    run = get_run(user_id, run_id)
    if run is None:
        return None
    steer = (run.get("steer") or []) + [note]
    _rest("PATCH", "aa_plan_runs", params={"id": f"eq.{run_id}"}, json={"steer": steer})
    run["steer"] = steer
    return run


# ---------------------------------------------------------------------------
# Briefings + their runs
# ---------------------------------------------------------------------------

def briefing_out(row: dict) -> dict:
    return {
        "id": row["id"],
        "title": row["title"],
        "prompt": row["prompt"],
        "cadence": row["cadence"],
        "hourLocal": row["hour_local"],
        "trigger": row.get("trigger"),
        "enabled": row["enabled"],
        "lastRunAt": row.get("last_run_at"),
    }


def _briefing_in(fields: dict) -> dict:
    mapping = {"title": "title", "prompt": "prompt", "cadence": "cadence",
               "hourLocal": "hour_local", "trigger": "trigger", "enabled": "enabled"}
    return {mapping[k]: v for k, v in fields.items() if k in mapping}


def list_briefings(user_id: str) -> list[dict]:
    return _rest("GET", "aa_briefings",
                 params={"user_id": f"eq.{user_id}", "order": "created_at"})


def get_briefing(user_id: str, briefing_id: str) -> dict | None:
    rows = _rest("GET", "aa_briefings",
                 params={"id": f"eq.{briefing_id}", "user_id": f"eq.{user_id}", "limit": 1})
    return rows[0] if rows else None


def create_briefing(user_id: str, fields: dict) -> dict:
    row = {"user_id": user_id, **_briefing_in(fields)}
    return _rest("POST", "aa_briefings", json=row, extra_headers=_REPR)[0]


def update_briefing(user_id: str, briefing_id: str, fields: dict) -> dict | None:
    rows = _rest("PATCH", "aa_briefings",
                 params={"id": f"eq.{briefing_id}", "user_id": f"eq.{user_id}"},
                 json=_briefing_in(fields), extra_headers=_REPR)
    return rows[0] if rows else None


def delete_briefing(user_id: str, briefing_id: str) -> None:
    _rest("DELETE", "aa_briefings",
          params={"id": f"eq.{briefing_id}", "user_id": f"eq.{user_id}"})


def all_enabled_briefings() -> list[dict]:
    """Scheduler scan — every user's enabled briefings (service key)."""
    return _rest("GET", "aa_briefings", params={"enabled": "eq.true", "limit": 500})


def claim_briefing(briefing_id: str, fire_cutoff_iso: str) -> bool:
    """CAS: set last_run_at=now only if it predates this firing window.
    With two workers, exactly one PATCH matches and returns a row."""
    rows = _rest("PATCH", "aa_briefings",
                 params={
                     "id": f"eq.{briefing_id}",
                     "or": f"(last_run_at.is.null,last_run_at.lt.{fire_cutoff_iso})",
                 },
                 json={"last_run_at": datetime.now(timezone.utc).isoformat()},
                 extra_headers=_REPR)
    return bool(rows)


def set_trigger_state(briefing_id: str, state: dict) -> None:
    _rest("PATCH", "aa_briefings", params={"id": f"eq.{briefing_id}"},
          json={"trigger_state": state})


def create_briefing_run(user_id: str, briefing_id: str, report: str) -> dict:
    return _rest("POST", "aa_briefing_runs",
                 json={"user_id": user_id, "briefing_id": briefing_id, "report": report},
                 extra_headers=_REPR)[0]


def runs_for_briefings(user_id: str, briefing_ids: list[str], limit: int = 40) -> list[dict]:
    if not briefing_ids:
        return []
    ids = ",".join(briefing_ids)
    return _rest("GET", "aa_briefing_runs",
                 params={"user_id": f"eq.{user_id}", "briefing_id": f"in.({ids})",
                         "order": "created_at.desc", "limit": limit})


# ---------------------------------------------------------------------------
# Chat threads + messages
# ---------------------------------------------------------------------------

def list_threads(user_id: str) -> list[dict]:
    rows = _rest("GET", "aa_threads",
                 params={"user_id": f"eq.{user_id}", "order": "updated_at.desc", "limit": 20})
    return [{"id": r["id"], "title": r["title"], "updatedAt": r["updated_at"]} for r in rows]


def create_thread(user_id: str, title: str) -> dict:
    row = _rest("POST", "aa_threads",
                json={"user_id": user_id, "title": title[:60]},
                extra_headers=_REPR)[0]
    return {"id": row["id"], "title": row["title"], "updatedAt": row["updated_at"]}


def touch_thread(user_id: str, thread_id: str) -> None:
    _rest("PATCH", "aa_threads",
          params={"id": f"eq.{thread_id}", "user_id": f"eq.{user_id}"},
          json={"updated_at": datetime.now(timezone.utc).isoformat()})


def list_messages(user_id: str, thread_id: str) -> list[dict]:
    rows = _rest("GET", "aa_messages",
                 params={"thread_id": f"eq.{thread_id}", "user_id": f"eq.{user_id}",
                         "order": "created_at", "limit": 100})
    return [
        {"id": r["id"], "threadId": r["thread_id"], "role": r["role"],
         "content": r["content"], "createdAt": r["created_at"]}
        for r in rows
    ]


def add_message(user_id: str, thread_id: str, role: str, content: str) -> None:
    _rest("POST", "aa_messages",
          json={"thread_id": thread_id, "user_id": user_id, "role": role, "content": content})
