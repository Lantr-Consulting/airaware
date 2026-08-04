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


def _c(fahrenheit: float) -> int:
    return round((fahrenheit - 32) * 5 / 9)


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
            "checks": [_check("window", "这个时段没有可用的逐小时预报", None, "—", "综合暴露评估", False)],
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
        checks.append(_check("uv_band", f"紫外线指数 {uv}（{band}），达到或超过你设定的 {thresholds['uvAvoid']} 避免线", uv, band, "个人紫外线避免线", False))
        penalties += 35
    elif uv >= thresholds["uvProtect"]:
        checks.append(_check("uv_band", f"紫外线指数 {uv}（{band}），从 {thresholds['uvProtect']} 开始需要采取防护", uv, band, f"皮肤类型 {profile.get('skinType', 3)}", False))
        penalties += 10
    else:
        checks.append(_check("uv_band", f"紫外线指数 {uv}（{band}），低于你的防护线", uv, band, "WHO 紫外线分级", True))

    # --- Heat (feels-like; Open-Meteo apparent temp, NWS bands) ---
    heat = max(h["apparentF"] for h in hours)
    band, _ = heat_band(heat)
    if heat >= thresholds["heatAvoidF"]:
        checks.append(_check("heat_index", f"体感约 {_c(heat)}°C（{band}），高于你设定的 {_c(thresholds['heatAvoidF'])}°C 避免线", heat, band, "个人高温避免线", False))
        penalties += 35
    elif heat >= thresholds["heatCautionF"]:
        checks.append(_check("heat_index", f"体感约 {_c(heat)}°C（{band}），高于你设定的 {_c(thresholds['heatCautionF'])}°C 提醒线", heat, band, "个人高温提醒", False))
        penalties += 18
    else:
        checks.append(_check("heat_index", f"体感约 {_c(heat)}°C（{band}），低于你的高温提醒线", heat, band, "NWS 体感温度分级", True))

    # --- Air quality, scaled by effort ---
    aqi = max(h["usAqi"] for h in hours)
    band, _ = aqi_band(aqi)
    caution_line = round(thresholds["aqiCaution"] * factor)
    avoid_line = round(thresholds["aqiAvoid"] * factor)
    src = f"个人 AQI 强度系数 {factor}" if factor != 1.0 else "个人 AQI 提醒线"
    intensity_label = {"low": "低", "moderate": "中等", "high": "高"}.get(intensity, intensity)
    if aqi >= avoid_line:
        checks.append(_check("aqi_intensity", f"{intensity_label}强度活动时 AQI {aqi}（{band}），超过实际采用的 {avoid_line} 避免线", aqi, band, src, False))
        penalties += 35
    elif aqi >= caution_line:
        checks.append(_check("aqi_intensity", f"{intensity_label}强度活动时 AQI {aqi}（{band}），超过实际采用的 {caution_line} 提醒线", aqi, band, src, False))
        penalties += 18
    else:
        checks.append(_check("aqi_intensity", f"{intensity_label}强度活动时 AQI {aqi}（{band}），低于实际采用的 {caution_line} 提醒线", aqi, band, "EPA AQI 指引", True))

    # --- Pollen: nullable, never guessed ---
    readings = [h["pollen"] for h in hours if h.get("pollen")]
    if readings:
        worst = max(readings, key=lambda p: p["index"])
        band, sev = pollen_band(worst["index"])
        sensitive = bool(profile.get("pollenAllergies")) or profile.get("asthma")
        line = thresholds["pollenCaution"] if sensitive else min(4, thresholds["pollenCaution"] + 1)
        src = "个人花粉过敏设置" if sensitive else "花粉指数分级"
        if sev >= line:
            allergen_names = {"grass": "禾本科", "ragweed": "豚草", "birch": "桦树", "alder": "桤木", "mugwort": "艾蒿", "olive": "橄榄树", "tree": "树木", "weed": "杂草"}
            allergens = "、".join(allergen_names.get(x, x) for x in worst.get("topAllergens", [])) or "花粉"
            checks.append(_check("pollen_band", f"花粉指数 {worst['index']}（{band}；主要为{allergens}），达到或超过你的提醒等级", worst["index"], band, src, False))
            penalties += 12 if sensitive else 6
        else:
            checks.append(_check("pollen_band", f"花粉指数 {worst['index']}（{band}），低于你的提醒等级", worst["index"], band, src, True))
    else:
        checks.append(_check("pollen_band", "该地点没有花粉数据，因此跳过检查，不作猜测", None, "暂无数据", "综合暴露评估", True))

    score = max(0, 100 - penalties)
    failed = [c for c in checks if not c["pass"]]
    alert = any("避免线" in c["detail"] for c in failed)
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
        item["checks"] = [_check("window", "这条建议没有指定时段", None, "—", "综合暴露评估", True)]
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
            item["title"] = f"这个时段并不适宜：{item.get('title', '')}".strip().rstrip("：")
            item["rationale"] = (
                "规划助手认为这个时段适宜，但环境暴露评估没有通过；请查看下方检查结果。" + item.get("rationale", "")
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
