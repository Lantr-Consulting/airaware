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
        "units": "imperial",
        # New advisors start inactive: describe -> review -> explicit
        # Activate. Nothing plans until the user blesses it.
        "activated": False,
    }
    created = _rest("POST", "aa_advisors", json=row, extra_headers=_REPR)[0]
    for a in default_activities:
        create_activity(user_id, a)
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
        "items": [item_out(r) for r in item_rows],
    }


def get_plan(user_id: str, date_iso: str) -> dict | None:
    plans = _rest("GET", "aa_day_plans",
                  params={"user_id": f"eq.{user_id}", "date": f"eq.{date_iso}", "limit": 1})
    if not plans:
        return None
    items = _rest("GET", "aa_plan_items",
                  params={"plan_id": f"eq.{plans[0]['id']}", "order": "created_at"})
    return plan_out(plans[0], items)


def put_plan(user_id: str, plan: dict) -> dict:
    """Replace the user's plan for that date (a re-plan supersedes)."""
    _rest("DELETE", "aa_day_plans",
          params={"user_id": f"eq.{user_id}", "date": f"eq.{plan['date']}"})
    plan_row = _rest("POST", "aa_day_plans", json={
        "user_id": user_id,
        "date": plan["date"],
        "location": plan["location"],
        "status": plan["status"],
        "day_score": plan["dayScore"],
        "summary": plan["summary"],
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
