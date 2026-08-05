"""Resolve the caller's Supabase session token to a user.

The frontend sends `Authorization: Bearer <access_token>` (from the user's
magic-link session). We ask Supabase Auth who the token belongs to; every
data endpoint then operates only on that user's rows. Same pattern as the
first sample — this file is deliberately identical in shape.
"""

import os
import time
from datetime import datetime, timezone
from typing import Any

import requests as http
from fastapi import Header, HTTPException

URL = os.environ["SUPABASE_URL"].rstrip("/")
PUBLISHABLE = os.environ["SUPABASE_PUBLISHABLE_KEY"]

# Tiny cache so a burst of requests doesn't hammer the auth endpoint.
_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_TTL = 60.0


def current_user(authorization: str = Header(default="")) -> dict[str, Any]:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="请先登录")
    token = authorization.removeprefix("Bearer ").strip()

    hit = _cache.get(token)
    if hit and time.time() - hit[0] < _TTL:
        return hit[1]

    r = http.get(
        f"{URL}/auth/v1/user",
        headers={"apikey": PUBLISHABLE, "Authorization": f"Bearer {token}"},
        timeout=10,
    )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="登录状态无效或已过期，请重新登录")
    body = r.json()
    metadata = body.get("user_metadata") or {}
    if metadata.get("demo_kind") == "lantr-private-demo":
        try:
            expires = datetime.fromisoformat(
                str(metadata.get("demo_expires_at", "")).replace("Z", "+00:00")
            )
            if expires <= datetime.now(timezone.utc):
                raise HTTPException(status_code=401, detail="这次演示已经结束，请重新开始")
        except ValueError:
            raise HTTPException(status_code=401, detail="演示登录状态无效，请重新开始")
    user = {"id": body["id"], "email": body.get("email", ""), "metadata": metadata}
    _cache[token] = (time.time(), user)
    if len(_cache) > 500:
        _cache.clear()
    return user
