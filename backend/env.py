"""Environmental data fetchers — Open-Meteo (no key) + regional pollen.

Every function returns records shaped exactly like lib/types.ts so the
frontend swaps mocks for these responses without reshaping the UI.

Pollen is a NULLABLE signal end-to-end:
  Europe  -> Open-Meteo CAMS pollen fields (official)
  US      -> Pollen.com pseudo-API by ZIP (unofficial; will break someday —
             that is part of the lesson)
  else    -> None, and the UI says "no coverage" instead of guessing.
"""

from __future__ import annotations

import requests

from bands import pollen_reading

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
AIR_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
GEO_URL = "https://geocoding-api.open-meteo.com/v1/search"
POLLENCOM_URL = "https://www.pollen.com/api/forecast/current/pollen/{zip}"

TIMEOUT = 12

HOURLY_VARS = (
    "temperature_2m,apparent_temperature,relative_humidity_2m,uv_index,"
    "cloud_cover,precipitation_probability,wind_speed_10m"
)
DAILY_VARS = (
    "uv_index_max,temperature_2m_max,temperature_2m_min,"
    "apparent_temperature_max,precipitation_probability_max"
)
# CAMS species (grains/m3). Only populated inside the CAMS Europe domain.
POLLEN_VARS = (
    "alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,"
    "olive_pollen,ragweed_pollen"
)

# Rough grains/m3 -> 0-12 index mapping per species (Low / Med / High
# thresholds follow published Met Office-style bands). An approximation,
# clearly labeled as one: the official 0-12 scale is Pollen.com's.
SPECIES_BANDS = {
    "grass_pollen": (5, 20, 200),
    "birch_pollen": (10, 80, 1500),
    "alder_pollen": (10, 80, 1500),
    "mugwort_pollen": (10, 30, 500),
    "ragweed_pollen": (5, 15, 100),
    "olive_pollen": (10, 80, 500),
}
SPECIES_LABEL = {
    "grass_pollen": "grass",
    "birch_pollen": "birch",
    "alder_pollen": "alder",
    "mugwort_pollen": "mugwort",
    "ragweed_pollen": "ragweed",
    "olive_pollen": "olive",
}


def geocode(query: str, count: int = 5) -> list[dict]:
    r = requests.get(
        GEO_URL,
        params={"name": query, "count": count, "language": "en", "format": "json"},
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    out = []
    for hit in r.json().get("results", []) or []:
        label = hit["name"]
        region = hit.get("admin1")
        country = hit.get("country")
        suffix = region if country in ("United States", None) else country
        out.append(
            {
                "name": f"{label}, {suffix}" if suffix else label,
                "lat": hit["latitude"],
                "lon": hit["longitude"],
                "tz": hit.get("timezone", "UTC"),
            }
        )
    return out


def _species_index(species: str, grains: float) -> float:
    """Map one species concentration onto the 0-12 index, piecewise."""
    low, med, high = SPECIES_BANDS[species]
    if grains <= 0:
        return 0.0
    if grains < low:
        return 2.0 * grains / low  # 0 .. 2 (Low)
    if grains < med:
        return 2.5 + 2.3 * (grains - low) / (med - low)  # Low-medium
    if grains < high:
        return 5.0 + 4.5 * (grains - med) / (high - med)  # Medium .. Med-high
    return min(12.0, 9.7 + 2.3 * (grains - high) / high)  # High


def _cams_pollen(aq_hourly: dict, idx: int) -> dict | None:
    """Pollen reading from CAMS fields at hour idx; None outside Europe."""
    best_index = None
    allergens: list[tuple[float, str]] = []
    for species in SPECIES_BANDS:
        vals = aq_hourly.get(species)
        if not vals or idx >= len(vals) or vals[idx] is None:
            continue
        s_idx = _species_index(species, float(vals[idx]))
        allergens.append((s_idx, SPECIES_LABEL[species]))
        if best_index is None or s_idx > best_index:
            best_index = s_idx
    if best_index is None:
        return None
    top = [name for score, name in sorted(allergens, reverse=True)[:3] if score > 0.5]
    return pollen_reading(best_index, top)


def _pollencom(zip_code: str) -> dict | None:
    """US pollen by ZIP from Pollen.com — unofficial, may break, returns None
    on any failure (tool errors are data, not crashes)."""
    try:
        r = requests.get(
            POLLENCOM_URL.format(zip=zip_code),
            headers={
                "Referer": "https://www.pollen.com",
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
                ),
            },
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        data = r.json()
        periods = data.get("Location", {}).get("periods", [])
        today = next((p for p in periods if p.get("Type") == "Today"), None)
        if today is None or today.get("Index") is None:
            return None
        triggers = [t.get("Name", "").lower() for t in today.get("Triggers", [])]
        return pollen_reading(float(today["Index"]), [t for t in triggers if t][:3])
    except Exception:
        return None


def fetch_conditions(lat: float, lon: float, zip_code: str | None = None) -> dict:
    """Current + hourly (today) + daily (7 days), shaped like lib/types.ts."""
    fc = requests.get(
        FORECAST_URL,
        params={
            "latitude": lat,
            "longitude": lon,
            "hourly": HOURLY_VARS,
            "daily": DAILY_VARS,
            "forecast_days": 7,
            "current_weather": True,
            "timezone": "auto",
            "temperature_unit": "fahrenheit",
            "wind_speed_unit": "mph",
        },
        timeout=TIMEOUT,
    ).json()
    aq = requests.get(
        AIR_URL,
        params={
            "latitude": lat,
            "longitude": lon,
            "hourly": f"us_aqi,{POLLEN_VARS}",
            "forecast_days": 5,  # CAMS horizon; days 6-7 reuse the last max
            "timezone": "auto",
        },
        timeout=TIMEOUT,
    ).json()

    hours = fc["hourly"]
    days = fc["daily"]
    aq_hourly = aq.get("hourly", {})
    aqi_series = aq_hourly.get("us_aqi", []) or []

    def aqi_at(i: int) -> int:
        if i < len(aqi_series) and aqi_series[i] is not None:
            return round(aqi_series[i])
        # Off the AQ horizon: hold the last known value rather than invent.
        known = [v for v in aqi_series if v is not None]
        return round(known[-1]) if known else 0

    # US pollen is one index per day; CAMS is hourly. Compute once for now.
    us_pollen = _pollencom(zip_code) if zip_code else None

    def pollen_at(i: int) -> dict | None:
        cams = _cams_pollen(aq_hourly, i) if i < len(aqi_series) else None
        return cams if cams is not None else us_pollen

    hourly = []
    for i, t in enumerate(hours["time"][:24]):  # today, local time
        hourly.append(
            {
                "time": t,
                "tempF": round(hours["temperature_2m"][i]),
                "apparentF": round(hours["apparent_temperature"][i]),
                "humidity": round(hours["relative_humidity_2m"][i]),
                "uvIndex": round(hours["uv_index"][i] or 0),
                "cloudCover": round(hours["cloud_cover"][i]),
                "precipProb": round(hours["precipitation_probability"][i] or 0),
                "windMph": round(hours["wind_speed_10m"][i]),
                "usAqi": aqi_at(i),
                "pollen": pollen_at(i),
            }
        )

    daily = []
    for d, date in enumerate(days["time"]):
        day_hours = range(d * 24, min((d + 1) * 24, len(aqi_series)))
        day_aqi = [aqi_series[i] for i in day_hours if aqi_series[i] is not None]
        if not day_aqi:
            day_aqi = [aqi_at(len(aqi_series))]
        day_pollen = _cams_pollen(aq_hourly, d * 24 + 12) if d * 24 + 12 < len(aqi_series) else None
        daily.append(
            {
                "date": date,
                "uvMax": round(days["uv_index_max"][d] or 0),
                "apparentMaxF": round(days["apparent_temperature_max"][d]),
                "aqiMax": round(max(day_aqi)),
                "pollen": day_pollen if day_pollen is not None else us_pollen,
                "tempMaxF": round(days["temperature_2m_max"][d]),
                "tempMinF": round(days["temperature_2m_min"][d]),
                "precipProb": round(days["precipitation_probability_max"][d] or 0),
            }
        )

    # "Current" = the most recent forecast hour at or before now (local).
    now_iso = (fc.get("current_weather") or {}).get("time")
    now_idx = 0
    if now_iso:
        for i, t in enumerate(hours["time"]):
            if t <= now_iso:
                now_idx = i
    current = {
        "uvIndex": round(hours["uv_index"][now_idx] or 0),
        "usAqi": aqi_at(now_idx),
        "apparentF": round(hours["apparent_temperature"][now_idx]),
        "pollen": pollen_at(now_idx),
    }

    return {
        "tz": fc.get("timezone", "UTC"),
        "current": current,
        "nowIndex": min(now_idx, len(hourly) - 1),
        "hourly": hourly,
        "daily": daily,
    }
