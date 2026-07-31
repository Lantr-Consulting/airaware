"""The exposure engine — deterministic, pure code, cited thresholds.

This is where AirAware's safety lives. The LLM narrates and proposes;
every window it touches is measured HERE, and the server re-measures at
accept time. Nothing in this file consults a model.

Sources ("code disposes" means "code cites"):
  - Heat index: NWS Rothfusz regression + official adjustments
    (https://www.wpc.ncep.noaa.gov/html/heatindex_equation.shtml)
  - UV bands: WHO Global Solar UV Index
  - AQI categories: EPA breakpoints; intensity scaling approximates EPA's
    "reduce prolonged or heavy exertion" guidance for sensitive groups
  - Pollen bands: Pollen.com 0-12 index
"""

from __future__ import annotations

import math

from bands import aqi_band, heat_band, pollen_band, uv_band

# A hard run is not a picnic: effort scales the effective AQI thresholds.
INTENSITY_FACTOR = {"low": 1.0, "moderate": 0.9, "high": 0.75}

GREAT_SCORE_FLOOR = 80  # a "great window" needs this score AND zero failed checks


def heat_index_f(temp_f: float, rh: float) -> float:
    """NWS heat index (Rothfusz regression, with the official low/high-RH
    adjustments). Valid for temp >= 80F; below that we return the simple
    average NWS uses as the fallback."""
    simple = 0.5 * (temp_f + 61.0 + (temp_f - 68.0) * 1.2 + rh * 0.094)
    if (simple + temp_f) / 2 < 80:
        return simple
    hi = (
        -42.379
        + 2.04901523 * temp_f
        + 10.14333127 * rh
        - 0.22475541 * temp_f * rh
        - 6.83783e-3 * temp_f**2
        - 5.481717e-2 * rh**2
        + 1.22874e-3 * temp_f**2 * rh
        + 8.5282e-4 * temp_f * rh**2
        - 1.99e-6 * temp_f**2 * rh**2
    )
    if rh < 13 and 80 <= temp_f <= 112:
        hi -= ((13 - rh) / 4) * math.sqrt((17 - abs(temp_f - 95)) / 17)
    elif rh > 85 and 80 <= temp_f <= 87:
        hi += ((rh - 85) / 10) * ((87 - temp_f) / 5)
    return hi


def _check(rule, detail, value, band, source, ok) -> dict:
    return {
        "rule": rule,
        "detail": detail,
        "value": value,
        "band": band,
        "thresholdSource": source,
        "pass": bool(ok),
    }


def _hhmm_to_min(hhmm: str) -> int:
    hh, mm = hhmm.split(":")
    return int(hh) * 60 + int(mm)


def hours_in_window(hourly: list[dict], start: str, end: str) -> list[dict]:
    """Hourly records whose hour overlaps [start, end) on the same day."""
    s, e = _hhmm_to_min(start), _hhmm_to_min(end)
    out = []
    for h in hourly:
        m = _hhmm_to_min(h["time"][11:16])
        if m + 60 > s and m < e:
            out.append(h)
    return out


def evaluate_window(
    hours: list[dict],
    intensity: str,
    thresholds: dict,
    profile: dict,
) -> dict:
    """Measure one time window for one effort level. Returns checks (each
    with the number that fired and whose limit it was), the item severity,
    a 0-100 score, and whether a 'great' label is even allowed."""
    if not hours:
        return {
            "checks": [_check("window", "No forecast hours in this window", None, "—", "exposure_engine", False)],
            "severity": "caution",
            "score": 0,
            "greatAllowed": False,
        }

    factor = INTENSITY_FACTOR.get(intensity, 1.0)
    checks: list[dict] = []
    penalties = 0

    # --- UV ---
    uv = max(h["uvIndex"] for h in hours)
    band, _ = uv_band(uv)
    if uv >= thresholds["uvAvoid"]:
        checks.append(_check("uv_band", f"UV {uv} ({band}) — at or above your avoid-at-{thresholds['uvAvoid']} line", uv, band, "user_uv_avoid", False))
        penalties += 35
    elif uv >= thresholds["uvProtect"]:
        checks.append(_check("uv_band", f"UV {uv} ({band}) — protection required from UV {thresholds['uvProtect']}", uv, band, f"skin_type_{profile.get('skinType', 3)}", False))
        penalties += 10
    else:
        checks.append(_check("uv_band", f"UV {uv} ({band}) — under your protection line", uv, band, "who_uv", True))

    # --- Heat (feels-like; Open-Meteo apparent temp, NWS bands) ---
    heat = max(h["apparentF"] for h in hours)
    band, _ = heat_band(heat)
    if heat >= thresholds["heatAvoidF"]:
        checks.append(_check("heat_index", f"Feels like {heat}°F ({band}) — above your {thresholds['heatAvoidF']}°F avoid line", heat, band, "user_heat_avoid", False))
        penalties += 35
    elif heat >= thresholds["heatCautionF"]:
        checks.append(_check("heat_index", f"Feels like {heat}°F ({band}) — above your {thresholds['heatCautionF']}°F caution line", heat, band, "user_heat_caution", False))
        penalties += 18
    else:
        checks.append(_check("heat_index", f"Feels like {heat}°F ({band}) — under your caution line", heat, band, "nws_heat", True))

    # --- Air quality, scaled by effort ---
    aqi = max(h["usAqi"] for h in hours)
    band, _ = aqi_band(aqi)
    caution_line = round(thresholds["aqiCaution"] * factor)
    avoid_line = round(thresholds["aqiAvoid"] * factor)
    src = f"user_aqi_x{factor}" if factor != 1.0 else "user_aqi"
    if aqi >= avoid_line:
        checks.append(_check("aqi_intensity", f"AQI {aqi} ({band}) at {intensity} intensity — above your effective {avoid_line} avoid line", aqi, band, src, False))
        penalties += 35
    elif aqi >= caution_line:
        checks.append(_check("aqi_intensity", f"AQI {aqi} ({band}) at {intensity} intensity — above your effective {caution_line} caution line", aqi, band, src, False))
        penalties += 18
    else:
        checks.append(_check("aqi_intensity", f"AQI {aqi} ({band}) at {intensity} intensity — under your effective {caution_line} line", aqi, band, "epa_aqi", True))

    # --- Pollen: nullable, never guessed ---
    readings = [h["pollen"] for h in hours if h.get("pollen")]
    if readings:
        worst = max(readings, key=lambda p: p["index"])
        band, sev = pollen_band(worst["index"])
        sensitive = bool(profile.get("pollenAllergies")) or profile.get("asthma")
        line = thresholds["pollenCaution"] if sensitive else min(4, thresholds["pollenCaution"] + 1)
        src = "user_pollen_allergies" if sensitive else "pollen_band"
        if sev >= line:
            allergens = ", ".join(worst.get("topAllergens", [])) or "pollen"
            checks.append(_check("pollen_band", f"Pollen {worst['index']} ({band}; {allergens}) — at or above your advice band", worst["index"], band, src, False))
            penalties += 12 if sensitive else 6
        else:
            checks.append(_check("pollen_band", f"Pollen {worst['index']} ({band}) — under your advice band", worst["index"], band, src, True))
    else:
        checks.append(_check("pollen_band", "Pollen: no coverage for this location — skipped, not guessed", None, "No data", "exposure_engine", True))

    score = max(0, 100 - penalties)
    failed = [c for c in checks if not c["pass"]]
    alert = any(c["thresholdSource"].startswith("user_") and "avoid" in c["thresholdSource"] for c in failed)
    severity = "alert" if alert or penalties >= 35 else ("caution" if failed else "info")

    return {
        "checks": checks,
        "severity": severity,
        "score": score,
        "greatAllowed": not failed and score >= GREAT_SCORE_FLOOR,
    }


def annotate_item(item: dict, hourly: list[dict], activity: dict | None, thresholds: dict, profile: dict) -> dict:
    """Re-measure a plan item against the (latest) forecast. This runs when
    the agent proposes and AGAIN at accept time. The engine can veto: a
    good_window the numbers don't support is downgraded to a warning."""
    window = item.get("window")
    intensity = (activity or {}).get("intensity", "moderate")
    if not window:
        item["checks"] = [_check("window", "No time window on this item", None, "—", "exposure_engine", True)]
        item["severity"] = item.get("severity", "info")
        return item

    verdict = evaluate_window(
        hours_in_window(hourly, window["start"], window["end"]),
        intensity,
        thresholds,
        profile,
    )
    item["checks"] = verdict["checks"]

    if item.get("kind") == "good_window":
        if verdict["greatAllowed"]:
            item["severity"] = "great"
        else:
            # The veto. Model proposes; code disposes.
            item["kind"] = "warning"
            item["severity"] = verdict["severity"]
            item["title"] = f"Not a great window: {item.get('title', '')}".strip().rstrip(":")
            item["rationale"] = (
                "The planner suggested this as a great window, but the engine's "
                "checks disagree — see below. " + item.get("rationale", "")
            )
    else:
        item["severity"] = verdict["severity"] if item.get("kind") != "keep" or verdict["severity"] != "info" else "info"

    item["score"] = verdict["score"]
    return item


def day_score(hourly: list[dict], schedule: list[dict], thresholds: dict, profile: dict) -> int:
    """0-100 for the whole day: the average of each scheduled activity's
    window score, blended with the best free daylight window (so an empty
    day still has a score)."""
    scores = []
    for entry in schedule:
        verdict = evaluate_window(
            hours_in_window(hourly, entry["start"], entry["end"]),
            entry["activity"].get("intensity", "moderate"),
            thresholds,
            profile,
        )
        scores.append(verdict["score"])
    daylight = [h for h in hourly if 6 <= int(h["time"][11:13]) <= 20]
    best_free = max(
        (
            evaluate_window(daylight[i : i + 2], "moderate", thresholds, profile)["score"]
            for i in range(len(daylight) - 1)
        ),
        default=0,
    )
    if not scores:
        return best_free
    return round(0.75 * (sum(scores) / len(scores)) + 0.25 * best_free)
