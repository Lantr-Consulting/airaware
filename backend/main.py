"""AirAware backend — Milestone 3: The Brain.

Public conditions endpoints over Open-Meteo (Explore goes live here), plus
the two LLM endpoints: /interpret-profile (plain English -> the limits the
engine will enforce) and /chat (an advisor grounded in live conditions).
No database yet — that's Milestone 5; the client sends its own context.
"""

from __future__ import annotations

import json
import os

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel

load_dotenv()  # must run before auth/db read SUPABASE_* at import time

import auth  # noqa: E402
import db  # noqa: E402
import env as environment  # noqa: E402
import exposure  # noqa: E402
import store  # noqa: E402
from bands import aqi_band, heat_band, uv_band  # noqa: E402

app = FastAPI(title="AirAware backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3100"],
    allow_origin_regex=r"https://airaware-[a-z0-9-]+\.vercel\.app",
    allow_methods=["*"],
    allow_headers=["*"],
)

DEEPSEEK_KEY = os.getenv("DEEPSEEK_API_KEY", "")
llm = (
    OpenAI(api_key=DEEPSEEK_KEY, base_url="https://api.deepseek.com")
    if DEEPSEEK_KEY
    else None
)
MODEL = "deepseek-chat"


@app.get("/health")
def health():
    return {"ok": True, "llm": llm is not None}


@app.get("/conditions")
def conditions(
    lat: float = Query(...),
    lon: float = Query(...),
    zip: str | None = Query(default=None, max_length=10),
    name: str | None = None,
):
    try:
        data = environment.fetch_conditions(lat, lon, zip_code=zip)
    except Exception as e:  # upstream hiccup -> a clean 502, not a stack trace
        raise HTTPException(status_code=502, detail=f"conditions upstream: {e}")
    data["location"] = {"name": name or f"{lat:.2f}, {lon:.2f}", "lat": lat, "lon": lon, "tz": data["tz"]}
    return data


@app.get("/conditions/search")
def conditions_search(q: str = Query(..., min_length=2)):
    try:
        return {"results": environment.geocode(q)}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"geocoding upstream: {e}")


# ---------- Account (Milestone 5: one advisor per user, rows in Supabase) ----------

def _me(user: dict) -> dict:
    row = db.ensure_advisor(user["id"], user["email"], store.DEFAULT_ADVISOR, store.DEFAULT_ACTIVITIES)
    return db.advisor_out(row)


@app.get("/me")
def me(user: dict = Depends(auth.current_user)):
    return {**_me(user), "email": user["email"]}


class SettingsRequest(BaseModel):
    profile: dict | None = None
    thresholds: dict | None = None
    homeLocation: dict | None = None
    units: str | None = None
    paused: bool | None = None


@app.patch("/me/settings")
def me_settings(req: SettingsRequest, user: dict = Depends(auth.current_user)):
    _me(user)  # ensure the row exists
    fields = {}
    if req.profile is not None:
        fields["profile"] = req.profile
    if req.thresholds is not None:
        fields["thresholds"] = req.thresholds
    if req.homeLocation is not None and {"name", "lat", "lon", "tz"} <= set(req.homeLocation):
        fields["home_location"] = req.homeLocation
    if req.units in ("imperial", "metric"):
        fields["units"] = req.units
    if req.paused is not None:
        fields["paused"] = bool(req.paused)
    if not fields:
        raise HTTPException(status_code=400, detail="nothing to update")
    return db.advisor_out(db.update_advisor(user["id"], fields))


# ---------- Activities ----------

class ActivityRequest(BaseModel):
    name: str
    kind: str
    daysOfWeek: list[int]
    startTime: str
    durationMin: int
    intensity: str
    flexibility: str
    indoorAlternative: str | None = None
    enabled: bool = True


@app.get("/activities")
def activities_list(user: dict = Depends(auth.current_user)):
    _me(user)
    return {"activities": [db.activity_out(r) for r in db.list_activities(user["id"])]}


@app.post("/activities")
def activities_create(req: ActivityRequest, user: dict = Depends(auth.current_user)):
    _me(user)
    return db.activity_out(db.create_activity(user["id"], req.model_dump()))


class ActivityPatch(BaseModel):
    name: str | None = None
    kind: str | None = None
    daysOfWeek: list[int] | None = None
    startTime: str | None = None
    durationMin: int | None = None
    intensity: str | None = None
    flexibility: str | None = None
    indoorAlternative: str | None = None
    enabled: bool | None = None


@app.patch("/activities/{activity_id}")
def activities_update(activity_id: str, req: ActivityPatch, user: dict = Depends(auth.current_user)):
    row = db.update_activity(user["id"], activity_id, req.model_dump(exclude_none=True))
    if row is None:
        raise HTTPException(status_code=404, detail="activity not found")
    return db.activity_out(row)


@app.delete("/activities/{activity_id}")
def activities_delete(activity_id: str, user: dict = Depends(auth.current_user)):
    db.delete_activity(user["id"], activity_id)
    return {"ok": True}


# ---------- Day plans (per user) ----------

class GenerateRequest(BaseModel):
    date: str | None = None


class AcceptRequest(BaseModel):
    window: dict | None = None  # optional edited {start, end}


class DeclineRequest(BaseModel):
    reason: str


def _advisor_ctx(user: dict) -> tuple[dict, list[dict]]:
    advisor = _me(user)
    activities = [db.activity_out(r) for r in db.list_activities(user["id"])]
    return advisor, activities


@app.get("/plan/today")
def plan_today(user: dict = Depends(auth.current_user)):
    advisor = _me(user)
    plan = db.get_plan(user["id"], store.today_local(advisor["homeLocation"]["tz"]))
    if plan is None:
        raise HTTPException(status_code=404, detail="no plan for today yet")
    return plan


@app.post("/plan/generate")
def plan_generate(req: GenerateRequest, user: dict = Depends(auth.current_user)):
    if llm is None:
        raise HTTPException(status_code=503, detail="LLM not configured")
    advisor, activities = _advisor_ctx(user)
    if advisor["paused"]:
        raise HTTPException(status_code=409, detail="advisor is paused")
    today = store.today_local(advisor["homeLocation"]["tz"])
    date_iso = req.date or today
    if date_iso != today:
        raise HTTPException(status_code=400, detail="plans are today-only until async runs arrive")
    import agent  # heavy import; loaded on first use

    try:
        plan = agent.run_plan(date_iso, advisor, activities)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"planner failed: {e}")
    return db.put_plan(user["id"], plan)


@app.post("/plan-items/{item_id}/accept")
def accept_item(item_id: str, req: AcceptRequest, user: dict = Depends(auth.current_user)):
    """Accept re-measures against the LATEST forecast — never the one the
    proposal was born under. If an avoid-line check fails now, we refuse."""
    row = db.get_item(user["id"], item_id)
    if row is None:
        raise HTTPException(status_code=404, detail="plan item not found")
    advisor, activities = _advisor_ctx(user)
    home = advisor["homeLocation"]
    hourly = environment.fetch_conditions(home["lat"], home["lon"], zip_code=home.get("zip"))["hourly"]

    item = db.item_out(row)
    if req.window and "start" in req.window and "end" in req.window:
        item["window"] = {"start": req.window["start"], "end": req.window["end"]}
    activity = next((a for a in activities if a["id"] == item.get("activityId")), None)
    exposure.annotate_item(item, hourly, activity, advisor["thresholds"], advisor["profile"])

    blocked = any(not c["pass"] and "avoid" in c.get("thresholdSource", "") for c in item["checks"])
    fields = {
        "window": item.get("window"),
        "checks": item["checks"],
        "severity": item["severity"],
        "score": item.get("score"),
        "kind": item["kind"],  # the veto may have rewritten it
        "title": item["title"],
        "rationale": item["rationale"],
    }
    if blocked:
        db.update_item(user["id"], item_id, fields)
        raise HTTPException(
            status_code=409,
            detail={"message": "Conditions moved — this window now crosses an avoid line. Fresh checks attached.", "item": item},
        )
    updated = db.update_item(user["id"], item_id, {**fields, "status": "accepted"})
    return db.item_out(updated)


@app.post("/plan-items/{item_id}/decline")
def decline_item(item_id: str, req: DeclineRequest, user: dict = Depends(auth.current_user)):
    updated = db.update_item(
        user["id"], item_id,
        {"status": "declined", "feedback": {"reason": req.reason.strip()[:300]}},
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="plan item not found")
    return db.item_out(updated)


# ---------- LLM: profile interpreter ----------

class InterpretRequest(BaseModel):
    text: str


INTERPRET_SYSTEM = """You turn a person's plain-English description of their life,
health sensitivities, and preferences into AirAware's profile + thresholds JSON.

Rules:
- Output ONLY a JSON object with exactly these keys:
  profile: {asthma (bool), pollenAllergies (array of lowercase strings from:
    grass, ragweed, birch, alder, mugwort, olive, tree, weed), skinType (int 1-6,
    Fitzpatrick; fair burns-easily=1-2, medium=3-4, deep=5-6; default 3 if unsaid),
    heatTolerance ("low"|"typical"|"high"), kidMode (bool — true only if they plan
    for a child), notes (one-sentence summary of preferences worth remembering)}
  thresholds: {uvProtect (int 1-11), uvAvoid (int 3-12), aqiCaution (int 50-150),
    aqiAvoid (int 100-300), heatCautionF (int 80-105), heatAvoidF (int 95-125),
    pollenCaution (int 0-4)}
- Derive thresholds from the profile using public-agency logic: skin type 1-2 ->
  uvProtect 3; type 3-4 -> 4; type 5-6 -> 6. Asthma or pollen allergies ->
  aqiCaution 100 (else 125) and pollenCaution 2 (else 3). Low heat tolerance or
  kidMode -> heatCautionF 90, heatAvoidF 100; typical -> 95/103; high -> 98/107.
  uvAvoid 8 unless they say they burn instantly (then 6).
- Be conservative when unsure; never invent medical conditions they didn't state.
"""


@app.post("/interpret-profile")
def interpret_profile(req: InterpretRequest):
    if llm is None:
        raise HTTPException(status_code=503, detail="LLM not configured")
    resp = llm.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": INTERPRET_SYSTEM},
            {"role": "user", "content": req.text.strip()[:2000]},
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
    )
    try:
        data = json.loads(resp.choices[0].message.content)
    except (json.JSONDecodeError, TypeError):
        raise HTTPException(status_code=502, detail="interpreter returned non-JSON")
    return _validate_interpretation(data)


def _clamp(v, lo, hi, default):
    try:
        return max(lo, min(hi, int(v)))
    except (TypeError, ValueError):
        return default


def _validate_interpretation(data: dict) -> dict:
    """The model proposes; this code disposes. Whatever came back is forced
    into the exact shape and ranges the frontend types expect."""
    p = data.get("profile") or {}
    t = data.get("thresholds") or {}
    allowed = {"grass", "ragweed", "birch", "alder", "mugwort", "olive", "tree", "weed"}
    profile = {
        "asthma": bool(p.get("asthma", False)),
        "pollenAllergies": [a for a in (p.get("pollenAllergies") or []) if a in allowed][:4],
        "skinType": _clamp(p.get("skinType"), 1, 6, 3),
        "heatTolerance": p.get("heatTolerance") if p.get("heatTolerance") in ("low", "typical", "high") else "typical",
        "kidMode": bool(p.get("kidMode", False)),
        "notes": str(p.get("notes", ""))[:300],
    }
    thresholds = {
        "uvProtect": _clamp(t.get("uvProtect"), 1, 11, 4),
        "uvAvoid": _clamp(t.get("uvAvoid"), 3, 12, 8),
        "aqiCaution": _clamp(t.get("aqiCaution"), 50, 150, 100),
        "aqiAvoid": _clamp(t.get("aqiAvoid"), 100, 300, 150),
        "heatCautionF": _clamp(t.get("heatCautionF"), 80, 105, 95),
        "heatAvoidF": _clamp(t.get("heatAvoidF"), 95, 125, 103),
        "pollenCaution": _clamp(t.get("pollenCaution"), 0, 4, 2),
    }
    if thresholds["uvAvoid"] <= thresholds["uvProtect"]:
        thresholds["uvAvoid"] = min(12, thresholds["uvProtect"] + 3)
    if thresholds["heatAvoidF"] <= thresholds["heatCautionF"]:
        thresholds["heatAvoidF"] = thresholds["heatCautionF"] + 6
    if thresholds["aqiAvoid"] <= thresholds["aqiCaution"]:
        thresholds["aqiAvoid"] = thresholds["aqiCaution"] + 50
    return {"profile": profile, "thresholds": thresholds}


# ---------- LLM: grounded advisor chat ----------

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatLocation(BaseModel):
    name: str = "your area"
    lat: float
    lon: float
    zip: str | None = None


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []
    location: ChatLocation | None = None
    profile: dict | None = None
    thresholds: dict | None = None


CHAT_SYSTEM = """You are the AirAware advisor: practical, concise, numbers-first
guidance about UV, heat, air quality, pollen, and outdoor timing.

Hard rules:
- Ground every claim in the CONDITIONS JSON provided. Never state a UV level,
  AQI, temperature, or pollen level that is not in it. If pollen is null, say
  there is no pollen coverage for this location — never guess.
- Reference the user's own thresholds when relevant ("over your 95°F caution
  line"), from the THRESHOLDS JSON if given.
- You are general guidance, not medical advice; if asked for diagnosis or
  treatment, say so and suggest a clinician.
- Prefer giving a better time window over saying "no".
- Keep replies under 180 words. Use **bold** for the key numbers.
"""


@app.post("/chat")
def chat(req: ChatRequest):
    if llm is None:
        raise HTTPException(status_code=503, detail="LLM not configured")

    context_parts = []
    if req.location is not None:
        try:
            cond = environment.fetch_conditions(
                req.location.lat, req.location.lon, zip_code=req.location.zip
            )
            today = cond["daily"][0] if cond["daily"] else {}
            cur = cond["current"]
            context_parts.append(
                "CONDITIONS "
                + json.dumps(
                    {
                        "place": req.location.name,
                        "now": {
                            **cur,
                            "uvBand": uv_band(cur["uvIndex"])[0],
                            "aqiBand": aqi_band(cur["usAqi"])[0],
                            "heatBand": heat_band(cur["apparentF"])[0],
                        },
                        "today": today,
                        "next6Hours": cond["hourly"][cond["nowIndex"] : cond["nowIndex"] + 6],
                    }
                )
            )
        except Exception as e:
            context_parts.append(f"CONDITIONS unavailable ({e}) — say so; do not invent numbers.")
    else:
        context_parts.append("CONDITIONS not provided — say you need a location; do not invent numbers.")

    if req.profile:
        context_parts.append("PROFILE " + json.dumps(req.profile))
    if req.thresholds:
        context_parts.append("THRESHOLDS " + json.dumps(req.thresholds))

    messages = [{"role": "system", "content": CHAT_SYSTEM + "\n\n" + "\n".join(context_parts)}]
    for m in req.history[-10:]:
        if m.role in ("user", "assistant") and m.content.strip():
            messages.append({"role": m.role, "content": m.content[:2000]})
    messages.append({"role": "user", "content": req.message.strip()[:2000]})

    resp = llm.chat.completions.create(model=MODEL, messages=messages, temperature=0.6)
    return {"reply": resp.choices[0].message.content}
