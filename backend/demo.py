"""Small, shared demo-session layer for the Lantr student-project fleet.

Each visitor receives a real Supabase user with a random credential. Existing
foreign-key cascades provide workspace isolation and make reset/delete cheap.
The credential is returned once to the browser and is never logged here.
"""

from __future__ import annotations

import hmac
import os
import secrets
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Any

import requests as http
from fastapi import HTTPException, Request

import db

DEMO_KIND = "lantr-private-demo"
PUBLISHABLE = os.environ["SUPABASE_PUBLISHABLE_KEY"]
_rate_lock = threading.Lock()
_quota_lock = threading.Lock()
_recent_creations: dict[str, list[float]] = {}


def _int_env(name: str, default: int, floor: int, ceiling: int) -> int:
    try:
        return max(floor, min(ceiling, int(os.getenv(name, str(default)))))
    except ValueError:
        return default


def _duration_hours() -> int:
    return _int_env("DEMO_DURATION_HOURS", 24, 1, 168)


def _action_limit() -> int:
    return _int_env("DEMO_MAX_AI_ACTIONS", 15, 1, 100)


def _daily_action_limit() -> int:
    return _int_env("DEMO_DAILY_AI_LIMIT", 300, 10, 10000)


def _session_limit() -> int:
    return _int_env("DEMO_MAX_ACTIVE_SESSIONS", 250, 10, 5000)


def access_mode() -> str:
    return "invite" if os.getenv("DEMO_ACCESS_MODE", "public").lower() == "invite" else "public"


def config() -> dict[str, Any]:
    return {"accessMode": access_mode(), "durationHours": _duration_hours(),
            "aiActionLimit": _action_limit()}


def is_demo_user(user: dict[str, Any] | None) -> bool:
    return bool(user and (user.get("metadata") or {}).get("demo_kind") == DEMO_KIND)


def language_for(user: dict[str, Any] | None) -> str:
    return "en" if (user or {}).get("metadata", {}).get("demo_language") == "en" else "zh"


def _headers() -> dict[str, str]:
    return {"apikey": db.SECRET, "Authorization": f"Bearer {db.SECRET}",
            "Content-Type": "application/json"}


def _auth_request(method: str, path: str, *, payload: dict[str, Any] | None = None,
                  params: dict[str, Any] | None = None,
                  expected: tuple[int, ...] = (200,)) -> Any:
    response = http.request(method, f"{db.URL}/auth/v1/{path.lstrip('/')}",
                            headers=_headers(), json=payload, params=params, timeout=20)
    if response.status_code not in expected:
        raise HTTPException(status_code=502, detail="演示工作区暂时无法创建，请稍后再试")
    return response.json() if response.text else None


def _metadata(auth_user: dict[str, Any]) -> dict[str, Any]:
    return dict(auth_user.get("user_metadata") or {})


def _parse_time(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _all_demo_users(*, clean_expired: bool = False) -> list[dict[str, Any]]:
    body = _auth_request("GET", "admin/users", params={"page": 1, "per_page": 1000})
    users = body.get("users", []) if isinstance(body, dict) else []
    now = datetime.now(timezone.utc)
    active = []
    for auth_user in users:
        meta = _metadata(auth_user)
        if meta.get("demo_kind") != DEMO_KIND:
            continue
        expires = _parse_time(meta.get("demo_expires_at"))
        if clean_expired and expires and expires <= now:
            try:
                _auth_request("DELETE", f"admin/users/{auth_user['id']}", expected=(200, 204))
            except HTTPException:
                pass
            continue
        active.append(auth_user)
    return active


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip()
    return forwarded or (request.client.host if request.client else "unknown")


def _check_creation_rate(request: Request) -> None:
    now = time.time(); cutoff = now - 15 * 60; ip = _client_ip(request)
    with _rate_lock:
        recent = [stamp for stamp in _recent_creations.get(ip, []) if stamp > cutoff]
        if len(recent) >= 4:
            raise HTTPException(status_code=429, detail="演示启动次数过多，请稍后再试")
        recent.append(now); _recent_creations[ip] = recent
        if len(_recent_creations) > 2000:
            for key in list(_recent_creations):
                kept = [stamp for stamp in _recent_creations[key] if stamp > cutoff]
                if kept: _recent_creations[key] = kept
                else: _recent_creations.pop(key, None)


def _check_invite(code: str | None) -> None:
    if access_mode() != "invite":
        return
    expected = os.getenv("DEMO_ACCESS_CODE", "")
    if not expected:
        raise HTTPException(status_code=503, detail="邀请体验尚未配置")
    if not code or not hmac.compare_digest(code.strip(), expected):
        raise HTTPException(status_code=403, detail="请输入有效的邀请码")


def _delete_auth_user(user_id: str) -> None:
    _auth_request("DELETE", f"admin/users/{user_id}", expected=(200, 204))


def create_session(request: Request, *, language: str = "zh", code: str | None = None,
                   check_access: bool = True, check_rate: bool = True) -> dict[str, Any]:
    if check_access: _check_invite(code)
    if check_rate: _check_creation_rate(request)
    active = _all_demo_users(clean_expired=True)
    if len(active) >= _session_limit():
        raise HTTPException(status_code=429, detail="今天的演示名额已满，请稍后再试")
    expires = datetime.now(timezone.utc) + timedelta(hours=_duration_hours())
    email = f"demo-{secrets.token_hex(10)}@guest.lantr.site"
    password = secrets.token_urlsafe(36)
    meta = {"demo_kind": DEMO_KIND, "demo_language": "en" if language == "en" else "zh",
            "demo_expires_at": expires.isoformat(), "ai_actions_used": 0,
            "ai_actions_limit": _action_limit()}
    created = _auth_request("POST", "admin/users",
                            payload={"email": email, "password": password, "email_confirm": True,
                                     "user_metadata": meta}, expected=(200, 201))
    try:
        response = http.post(f"{db.URL}/auth/v1/token", params={"grant_type": "password"},
                             headers={"apikey": PUBLISHABLE, "Content-Type": "application/json"},
                             json={"email": email, "password": password}, timeout=20)
        if response.status_code != 200:
            raise HTTPException(status_code=502, detail="演示工作区登录失败，请稍后再试")
        token = response.json()
    except Exception:
        try: _delete_auth_user(created["id"])
        except Exception: pass
        raise
    return {"session": {"accessToken": token["access_token"], "refreshToken": token["refresh_token"],
                        "expiresAt": token.get("expires_at")},
            "demo": {"expiresAt": expires.isoformat(), "aiActionsUsed": 0,
                     "aiActionLimit": _action_limit()}}


def reset_session(request: Request, user: dict[str, Any]) -> dict[str, Any]:
    if not is_demo_user(user):
        raise HTTPException(status_code=403, detail="只有临时演示工作区可以重置")
    # Reset in the language the visitor is USING now, not the one the old
    # workspace was seeded with.
    header_lang = (request.headers.get("accept-language") or "").lower()
    language = "en" if header_lang.startswith("en") else "zh" if header_lang.startswith("zh") else language_for(user)
    _delete_auth_user(user["id"])
    return create_session(request, language=language, check_access=False, check_rate=False)


def status(user: dict[str, Any]) -> dict[str, Any]:
    if not is_demo_user(user): return {"isDemo": False}
    auth_user = _auth_request("GET", f"admin/users/{user['id']}")
    meta = _metadata(auth_user)
    limit = int(meta.get("ai_actions_limit", _action_limit())); used = int(meta.get("ai_actions_used", 0))
    return {"isDemo": True, "expiresAt": meta.get("demo_expires_at"),
            "aiActionsUsed": used, "aiActionLimit": limit,
            "aiActionsRemaining": max(0, limit - used)}


def consume_ai_action(user: dict[str, Any]) -> None:
    if not is_demo_user(user): return
    with _quota_lock:
        auth_user = _auth_request("GET", f"admin/users/{user['id']}")
        meta = _metadata(auth_user); expires = _parse_time(meta.get("demo_expires_at"))
        if expires and expires <= datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="这次演示已经结束，请重新开始")
        limit = int(meta.get("ai_actions_limit", _action_limit())); used = int(meta.get("ai_actions_used", 0))
        if used >= limit:
            raise HTTPException(status_code=429, detail="本次演示的 AI 体验次数已用完，可以重置后再试")
        daily_used = sum(int(_metadata(item).get("ai_actions_used", 0))
                         for item in _all_demo_users(clean_expired=True))
        if daily_used >= _daily_action_limit():
            raise HTTPException(status_code=429, detail="今天的 AI 演示额度已用完，请明天再来")
        meta["ai_actions_used"] = used + 1
        _auth_request("PUT", f"admin/users/{user['id']}", payload={"user_metadata": meta})


def is_demo_user_id(user_id: str) -> bool:
    try: auth_user = _auth_request("GET", f"admin/users/{user_id}")
    except HTTPException: return False
    return _metadata(auth_user).get("demo_kind") == DEMO_KIND
