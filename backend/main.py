"""AirAware backend — Milestone 3: The Brain.

Public conditions endpoints over Open-Meteo (Explore goes live here), plus
the two LLM endpoints: /interpret-profile (plain English -> the limits the
engine will enforce) and /chat (an advisor grounded in live conditions).
No database yet — that's Milestone 5; the client sends its own context.
"""

from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timezone

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel

load_dotenv()  # must run before auth/db read SUPABASE_* at import time

import auth  # noqa: E402
import db  # noqa: E402
import demo  # noqa: E402
import env as environment  # noqa: E402
import exposure  # noqa: E402
import store  # noqa: E402
from bands import aqi_band, heat_band, uv_band  # noqa: E402

app = FastAPI(title="AirAware backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3100",
        "https://airaware.lantr.site",
        "https://lantr.site",
        "https://www.lantr.site",
    ],
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


def _request_language(request: Request) -> str:
    return "en" if request.headers.get("accept-language", "").lower().startswith("en") else "zh"


def _language_rule(language: str) -> str:
    if language == "en":
        return "Write every user-facing field in natural English and use Fahrenheit. Never use em dashes; join clauses with commas or periods."
    return "Write every user-facing field in idiomatic Simplified Chinese as a native Chinese health-and-lifestyle product would; avoid literal English translation patterns and convert Fahrenheit to Celsius. 不要使用破折号（——），改用逗号或句号。"


@app.get("/health")
def health():
    return {"ok": True, "llm": llm is not None}


class DemoSessionRequest(BaseModel):
    language: str = "zh"
    code: str | None = None


@app.get("/demo/config")
def demo_config():
    return demo.config()


@app.post("/demo/session")
def demo_session(req: DemoSessionRequest, request: Request):
    return demo.create_session(
        request,
        language="en" if req.language == "en" else "zh",
        code=req.code,
    )


@app.get("/demo/status")
def demo_status(user: dict = Depends(auth.current_user)):
    return demo.status(user)


@app.post("/demo/reset")
def demo_reset(request: Request, user: dict = Depends(auth.current_user)):
    return demo.reset_session(request, user)


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
        raise HTTPException(status_code=502, detail="环境数据服务暂不可用，请稍后重试")
    data["location"] = {"name": name or f"{lat:.2f}, {lon:.2f}", "lat": lat, "lon": lon, "tz": data["tz"]}
    return data


@app.get("/conditions/search")
def conditions_search(request: Request, q: str = Query(..., min_length=2), count: int = Query(default=5, ge=1, le=10)):
    try:
        return {"results": environment.geocode(q, count=count, language=_request_language(request))}
    except Exception as e:
        raise HTTPException(status_code=502, detail="城市搜索服务暂不可用，请稍后重试")


# ---------- Account (Milestone 5: one advisor per user, rows in Supabase) ----------

def _demo_seed(language: str) -> tuple[dict, list[dict]]:
    if language == "en":
        advisor = {
            "profile": {"asthma": False, "pollenAllergies": ["grass", "ragweed"],
                        "skinType": 2, "heatTolerance": "typical", "kidMode": False,
                        "notes": "Training for a 10K. Prefers mornings after 6:30 and needs a real dog walk every evening."},
            "thresholds": {"uvProtect": 3, "uvAvoid": 8, "aqiCaution": 100,
                           "aqiAvoid": 150, "heatCautionF": 95, "heatAvoidF": 103,
                           "pollenCaution": 2},
            "home": {"name": "Austin, TX", "lat": 30.27, "lon": -97.74,
                     "tz": "America/Chicago", "zip": "78701"},
        }
        activities = [
            {"name": "Morning run", "kind": "run", "daysOfWeek": [1, 3, 5], "startTime": "07:00", "durationMin": 45, "intensity": "high", "flexibility": "flex_time", "indoorAlternative": "Treadmill at the gym", "enabled": True},
            {"name": "Bike commute", "kind": "commute", "daysOfWeek": [1, 2, 3, 4, 5], "startTime": "08:30", "durationMin": 25, "intensity": "moderate", "flexibility": "fixed", "enabled": True},
            {"name": "Evening dog walk", "kind": "chores", "daysOfWeek": [0, 1, 2, 3, 4, 5, 6], "startTime": "20:00", "durationMin": 30, "intensity": "low", "flexibility": "flex_time", "enabled": True},
        ]
        return advisor, activities
    advisor = {
        "profile": {"asthma": False, "pollenAllergies": ["grass", "ragweed"],
                    "skinType": 2, "heatTolerance": "typical", "kidMode": False,
                    "notes": "正在为 10 公里跑步做准备。更喜欢早晨，但不希望早于 6:30；每天晚上都要遛狗。"},
        "thresholds": {"uvProtect": 3, "uvAvoid": 8, "aqiCaution": 100,
                       "aqiAvoid": 150, "heatCautionF": 95, "heatAvoidF": 103,
                       "pollenCaution": 2},
        "home": {"name": "美国 · 奥斯汀", "lat": 30.27, "lon": -97.74,
                 "tz": "America/Chicago", "zip": "78701"},
    }
    activities = [
        {"name": "晨跑", "kind": "run", "daysOfWeek": [1, 3, 5], "startTime": "07:00", "durationMin": 45, "intensity": "high", "flexibility": "flex_time", "indoorAlternative": "健身房跑步机", "enabled": True},
        {"name": "骑车通勤", "kind": "commute", "daysOfWeek": [1, 2, 3, 4, 5], "startTime": "08:30", "durationMin": 25, "intensity": "moderate", "flexibility": "fixed", "enabled": True},
        {"name": "晚间遛狗", "kind": "chores", "daysOfWeek": [0, 1, 2, 3, 4, 5, 6], "startTime": "20:00", "durationMin": 30, "intensity": "low", "flexibility": "flex_time", "enabled": True},
    ]
    return advisor, activities


def _me(user: dict, language: str = "zh") -> dict:
    if demo.is_demo_user(user):
        defaults, activities = _demo_seed(demo.language_for(user))
    elif language == "en":
        defaults, activities = store.DEFAULT_ADVISOR_EN, store.DEFAULT_ACTIVITIES_EN
    else:
        defaults, activities = store.DEFAULT_ADVISOR, store.DEFAULT_ACTIVITIES
    row = db.ensure_advisor(user["id"], user["email"], defaults, activities)
    if demo.is_demo_user(user):
        if not row["activated"]:
            row = db.update_advisor(user["id"], {"activated": True})
        language = demo.language_for(user)
        for briefing in db.list_briefings(user["id"]):
            fields = {"enabled": False} if briefing["enabled"] else {}
            if briefing["title"] in ("晨间简报", "Morning briefing"):
                fields.update({
                    "title": "Morning briefing" if language == "en" else "晨间简报",
                    "prompt": (
                        "Summarize today: include the day score if a plan exists, flag risks for scheduled activities, list useful gear, and name the best outdoor window."
                        if language == "en" else
                        "总结今天：如已有计划则说明当天评分，指出已安排活动的风险、需要穿戴或携带的物品，以及最适合户外活动的一个时段。"
                    ),
                })
            if fields:
                db.update_briefing(user["id"], briefing["id"], fields)
    return db.advisor_out(row)


@app.get("/me")
def me(request: Request, user: dict = Depends(auth.current_user)):
    return {**_me(user, _request_language(request)), "email": user["email"],
            "demo": demo.status(user) if demo.is_demo_user(user) else {"isDemo": False}}


class SettingsRequest(BaseModel):
    profile: dict | None = None
    thresholds: dict | None = None
    homeLocation: dict | None = None
    units: str | None = None
    paused: bool | None = None
    activated: bool | None = None


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
    if req.activated is not None:
        fields["activated"] = bool(req.activated)
    if not fields:
        raise HTTPException(status_code=400, detail="没有需要更新的内容")
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
        raise HTTPException(status_code=404, detail="没有找到这项活动")
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
        raise HTTPException(status_code=404, detail="今天还没有生成安排")
    return plan


def _supersede_note(
    old_plan: dict | None,
    new_hourly: list[dict] | None,
    language: str = "zh",
) -> str | None:
    """Human sentence about WHY the re-plan differs — diffed from the old
    plan's conditions snapshot, never invented."""
    if old_plan is None:
        return None
    stamp = datetime.now(timezone.utc).strftime("%H:%M UTC")
    old_hourly = old_plan.get("conditions_snapshot") or []
    if not old_hourly or not new_hourly:
        return f"Replanned at {stamp}." if language == "en" else f"已于 {stamp} 重新规划。"
    deltas = []
    for label, key, unit, floor in (
        ("空气质量", "usAqi", " AQI", 15),
        ("体感温度", "apparentF", "°F", 4),
        ("紫外线指数", "uvIndex", "", 2),
    ):
        old_max = max(h[key] for h in old_hourly)
        new_max = max(h[key] for h in new_hourly)
        if abs(new_max - old_max) >= floor:
            direction = "变差" if new_max > old_max else "改善"
            if key == "apparentF":
                old_text = f"{round((old_max - 32) * 5 / 9)}°C"
                new_text = f"{round((new_max - 32) * 5 / 9)}°C"
            else:
                old_text = f"{old_max}{unit}"
                new_text = f"{new_max}{unit}"
            deltas.append((abs(new_max - old_max) / max(floor, 1), f"{label}{direction}（{old_text} → {new_text}）"))
    if not deltas:
        return f"Replanned at {stamp}; the forecast changed only slightly." if language == "en" else f"已于 {stamp} 重新规划，预报整体变化不大。"
    deltas.sort(reverse=True)
    return (
        f"Replanned at {stamp} because the forecast changed."
        if language == "en"
        else f"已于 {stamp} 重新规划：{deltas[0][1]}。"
    )


def _plan_job(
    user_id: str,
    run_id: str,
    date_iso: str,
    advisor: dict,
    activities: list[dict],
    language: str = "zh",
) -> None:
    """Runs on a background thread; state lives in the DB so either worker
    can answer the frontend's polling."""
    try:
        lessons = db.recent_decline_lessons(user_id)
        steer = db.latest_run_steer(user_id)
        import agent

        plan = agent.run_plan(date_iso, advisor, activities, lessons, steer, language)
        old = db.supersede_plan(user_id, date_iso)
        plan["supersededNote"] = _supersede_note(old, plan.get("conditionsSnapshot"), language)
        db.put_plan(user_id, plan)
        db.update_run(run_id, {
            "status": "done",
            "report": plan["summary"],
            "finished_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        db.update_run(run_id, {
            "status": "error",
            "error": str(e)[:500],
            "finished_at": datetime.now(timezone.utc).isoformat(),
        })
    finally:
        db.release_run_lock(user_id)


@app.post("/plan/generate")
def plan_generate(req: GenerateRequest, request: Request, user: dict = Depends(auth.current_user)):
    if llm is None:
        raise HTTPException(status_code=503, detail="规划模型尚未配置")
    advisor, activities = _advisor_ctx(user)
    if not advisor["activated"]:
        raise HTTPException(status_code=409, detail="请先确认个人情况和提醒线，再启用户外助手")
    if advisor["paused"]:
        raise HTTPException(status_code=409, detail="户外助手当前已暂停")
    demo.consume_ai_action(user)
    today = store.today_local(advisor["homeLocation"]["tz"])
    date_iso = req.date or today
    if date_iso != today:
        raise HTTPException(status_code=400, detail="当前版本仅支持生成今日安排")
    if not db.acquire_run_lock(user["id"]):
        raise HTTPException(status_code=409, detail="已有一次规划正在运行，可以补充要求或稍候")
    run = db.create_run(user["id"], [date_iso])
    threading.Thread(
        target=_plan_job,
        args=(user["id"], run["id"], date_iso, advisor, activities, _request_language(request)),
        daemon=True,
    ).start()
    return {"runId": run["id"], "status": "running"}


@app.get("/plan-runs/{run_id}")
def plan_run_status(run_id: str, user: dict = Depends(auth.current_user)):
    run = db.get_run(user["id"], run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="没有找到这次规划")
    return db.run_out(run)


class SteerRequest(BaseModel):
    note: str


@app.post("/plan-runs/{run_id}/steer")
def plan_run_steer(run_id: str, req: SteerRequest, user: dict = Depends(auth.current_user)):
    note = req.note.strip()[:300]
    if not note:
        raise HTTPException(status_code=400, detail="补充要求不能为空")
    run = db.append_steer(user["id"], run_id, note)
    if run is None:
        raise HTTPException(status_code=404, detail="没有找到这次规划")
    return db.run_out(run)


@app.post("/plan-items/{item_id}/accept")
def accept_item(item_id: str, req: AcceptRequest, user: dict = Depends(auth.current_user)):
    """Accept re-measures against the LATEST forecast — never the one the
    proposal was born under. If an avoid-line check fails now, we refuse."""
    row = db.get_item(user["id"], item_id)
    if row is None:
        raise HTTPException(status_code=404, detail="没有找到这条安排")
    advisor, activities = _advisor_ctx(user)
    home = advisor["homeLocation"]
    hourly = environment.fetch_conditions(home["lat"], home["lon"], zip_code=home.get("zip"))["hourly"]

    item = db.item_out(row)
    if req.window and "start" in req.window and "end" in req.window:
        item["window"] = {"start": req.window["start"], "end": req.window["end"]}
    activity = next((a for a in activities if a["id"] == item.get("activityId")), None)
    exposure.annotate_item(item, hourly, activity, advisor["thresholds"], advisor["profile"])

    blocked = any(not c["pass"] and "避免线" in c.get("detail", "") for c in item["checks"])
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
            detail={"message": "环境条件已经变化，这个时段现在越过了避免线；已附上最新检查结果。", "item": item},
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
        raise HTTPException(status_code=404, detail="没有找到这条安排")
    return db.item_out(updated)


# ---------- Briefings (Milestone 8: always-on) ----------

class BriefingRequest(BaseModel):
    title: str
    prompt: str
    cadence: str = "daily"
    hourLocal: int = 7
    trigger: dict | None = None


class BriefingPatch(BaseModel):
    title: str | None = None
    prompt: str | None = None
    cadence: str | None = None
    hourLocal: int | None = None
    trigger: dict | None = None
    enabled: bool | None = None


VALID_CADENCES = {"manual", "daily", "weekly", "on_change"}


def _briefings_view(user_id: str) -> list[dict]:
    rows = db.list_briefings(user_id)
    runs = db.runs_for_briefings(user_id, [r["id"] for r in rows])
    by_briefing: dict[str, list[dict]] = {}
    for run in runs:
        by_briefing.setdefault(run["briefing_id"], []).append(run)
    out = []
    for row in rows:
        b = db.briefing_out(row)
        mine = by_briefing.get(row["id"], [])
        b["latestReport"] = mine[0]["report"] if mine else None
        b["pastRuns"] = [
            {"date": r["created_at"][:10], "summary": r["report"][:140]}
            for r in mine[1:5]
        ]
        out.append(b)
    return out


@app.get("/briefings")
def briefings_list(user: dict = Depends(auth.current_user)):
    _me(user)
    return {"briefings": _briefings_view(user["id"])}


@app.post("/briefings")
def briefings_create(req: BriefingRequest, user: dict = Depends(auth.current_user)):
    _me(user)
    if req.cadence not in VALID_CADENCES:
        raise HTTPException(status_code=400, detail="不支持这个运行频率")
    fields = req.model_dump()
    fields["hourLocal"] = max(0, min(23, fields["hourLocal"]))
    if demo.is_demo_user(user):
        fields["enabled"] = False
    row = db.create_briefing(user["id"], fields)
    return db.briefing_out(row)


@app.patch("/briefings/{briefing_id}")
def briefings_update(briefing_id: str, req: BriefingPatch, user: dict = Depends(auth.current_user)):
    fields = req.model_dump(exclude_none=True)
    if "cadence" in fields and fields["cadence"] not in VALID_CADENCES:
        raise HTTPException(status_code=400, detail="不支持这个运行频率")
    if demo.is_demo_user(user) and "enabled" in fields:
        fields["enabled"] = False
    row = db.update_briefing(user["id"], briefing_id, fields)
    if row is None:
        raise HTTPException(status_code=404, detail="没有找到这份简报")
    return db.briefing_out(row)


@app.delete("/briefings/{briefing_id}")
def briefings_delete(briefing_id: str, user: dict = Depends(auth.current_user)):
    db.delete_briefing(user["id"], briefing_id)
    return {"ok": True}


@app.post("/briefings/{briefing_id}/run")
def briefings_run(briefing_id: str, request: Request, user: dict = Depends(auth.current_user)):
    if llm is None:
        raise HTTPException(status_code=503, detail="简报模型尚未配置")
    row = db.get_briefing(user["id"], briefing_id)
    if row is None:
        raise HTTPException(status_code=404, detail="没有找到这份简报")
    demo.consume_ai_action(user)
    advisor = _me(user)
    import briefing as briefing_engine

    run = briefing_engine.run_briefing(user["id"], row, advisor, _request_language(request))
    db.claim_briefing(briefing_id, datetime.now(timezone.utc).isoformat())
    return {"report": run["report"], "createdAt": run["created_at"]}


@app.on_event("startup")
def _start_scheduler():
    """One scheduler thread per worker; the CAS claim in claim_briefing
    makes any given firing exclusive."""
    import briefing as briefing_engine

    threading.Thread(target=briefing_engine.scheduler_loop, daemon=True).start()


# ---------- LLM: profile interpreter ----------

class InterpretRequest(BaseModel):
    text: str


INTERPRET_SYSTEM = """You turn a person's description of their life,
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
- Follow the per-request language instruction appended below for profile.notes.
  Keep internal enum values and JSON keys exactly as specified. Terms for
  allergens in any language must still map to the allowed English enum values.
"""


@app.post("/interpret-profile")
def interpret_profile(req: InterpretRequest, request: Request, user: dict = Depends(auth.current_user)):
    if llm is None:
        raise HTTPException(status_code=503, detail="解析模型尚未配置")
    demo.consume_ai_action(user)
    resp = llm.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": INTERPRET_SYSTEM + "\n" + _language_rule(_request_language(request))},
            {"role": "user", "content": req.text.strip()[:2000]},
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
    )
    try:
        data = json.loads(resp.choices[0].message.content)
    except (json.JSONDecodeError, TypeError):
        raise HTTPException(status_code=502, detail="解析服务没有返回有效结果")
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
    threadId: str | None = None


def optional_user(authorization: str = Header(default="")) -> dict | None:
    """Chat works signed-out (client context, nothing saved) and signed-in
    (server-side truth, persisted threads)."""
    if not authorization.startswith("Bearer "):
        return None
    try:
        return auth.current_user(authorization)
    except HTTPException:
        return None


@app.get("/threads")
def threads_list(user: dict = Depends(auth.current_user)):
    return {"threads": db.list_threads(user["id"])}


@app.get("/threads/{thread_id}/messages")
def thread_messages(thread_id: str, user: dict = Depends(auth.current_user)):
    return {"messages": db.list_messages(user["id"], thread_id)}


CHAT_SYSTEM = """You are the AirAware advisor: practical, concise, numbers-first
guidance about UV, heat, air quality, pollen, and outdoor timing.

Hard rules:
- Ground every claim in the CONDITIONS JSON provided. Never state a UV level,
  AQI, temperature, or pollen level that is not in it. If pollen is null, say
  there is no pollen coverage for this location — never guess.
- Reference the user's own thresholds when relevant, from the THRESHOLDS JSON
  if given. Use the units required by the final per-request language instruction.
- You are general guidance, not medical advice; if asked for diagnosis or
  treatment, say so and suggest a clinician.
- Prefer giving a better time window over saying "no".
- Keep replies under 180 words. Use **bold** for the key numbers.
- Follow the final per-request language instruction. Do not diagnose, recommend
  medication, or present general guidance as medical advice.
"""


@app.post("/chat")
def chat(req: ChatRequest, request: Request, user: dict = Depends(auth.current_user)):
    if llm is None:
        raise HTTPException(status_code=503, detail="问答模型尚未配置")
    demo.consume_ai_action(user)

    language = _request_language(request)

    # Signed in: the server's records are the truth — location, profile,
    # thresholds, and today's plan come from the user's own rows.
    thread_id: str | None = None
    advisor = _me(user)
    home = advisor["homeLocation"]
    req.location = ChatLocation(name=home["name"], lat=home["lat"], lon=home["lon"], zip=home.get("zip"))
    req.profile = advisor["profile"]
    req.thresholds = advisor["thresholds"]
    thread_id = req.threadId
    if thread_id is None:
        thread_id = db.create_thread(
            user["id"], req.message.strip()[:48] or ("New conversation" if language == "en" else "新对话")
        )["id"]
        req.history = []
    else:
        req.history = [ChatMessage(**m) for m in (
            {"role": m["role"], "content": m["content"]}
            for m in db.list_messages(user["id"], thread_id)
        )]
    db.add_message(user["id"], thread_id, "user", req.message.strip()[:2000])

    context_parts = []
    plan = db.get_plan(user["id"], store.today_local(advisor["homeLocation"]["tz"]))
    if plan:
        context_parts.append("TODAYS_PLAN " + json.dumps({
            "dayScore": plan["dayScore"],
            "summary": plan["summary"],
            "items": [
                {"kind": i["kind"], "title": i["title"], "status": i["status"], "window": i.get("window")}
                for i in plan["items"]
            ],
        }))
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
            context_parts.append(f"环境数据暂不可用（{e}），请明确说明，不要编造数值。")
    else:
        context_parts.append("没有提供环境数据；请说明需要地点信息，不要编造数值。")

    if req.profile:
        context_parts.append("PROFILE " + json.dumps(req.profile))
    if req.thresholds:
        context_parts.append("THRESHOLDS " + json.dumps(req.thresholds))

    messages = [{
        "role": "system",
        "content": CHAT_SYSTEM + "\n\n" + "\n".join(context_parts) + "\n\n" + _language_rule(language),
    }]
    for m in req.history[-10:]:
        if m.role in ("user", "assistant") and m.content.strip():
            messages.append({"role": m.role, "content": m.content[:2000]})
    messages.append({"role": "user", "content": req.message.strip()[:2000]})

    resp = llm.chat.completions.create(model=MODEL, messages=messages, temperature=0.6)
    reply = resp.choices[0].message.content
    if thread_id is not None:
        db.add_message(user["id"], thread_id, "assistant", reply)
        db.touch_thread(user["id"], thread_id)
    return {"reply": reply, "threadId": thread_id}
