"""Official band scales — the Python mirror of lib/bands.ts.

Severity is the shared 0-4 scale every signal maps onto. Milestone 4's
exposure engine builds on these; nothing else in the backend may invent a
cutoff. Sources: WHO UV index, EPA US AQI, NWS heat-index categories,
Pollen.com index bands.
"""


def uv_band(uv: float) -> tuple[str, int]:
    if uv < 3:
        return "Low", 0
    if uv < 6:
        return "Moderate", 1
    if uv < 8:
        return "High", 2
    if uv < 11:
        return "Very high", 3
    return "Extreme", 4


def aqi_band(aqi: float) -> tuple[str, int]:
    if aqi <= 50:
        return "Good", 0
    if aqi <= 100:
        return "Moderate", 1
    if aqi <= 150:
        return "Unhealthy for sensitive groups", 2
    if aqi <= 200:
        return "Unhealthy", 3
    if aqi <= 300:
        return "Very unhealthy", 4
    return "Hazardous", 4


def heat_band(apparent_f: float) -> tuple[str, int]:
    if apparent_f < 80:
        return "Comfortable", 0
    if apparent_f < 90:
        return "Caution", 1
    if apparent_f < 103:
        return "Extreme caution", 2
    if apparent_f < 125:
        return "Danger", 3
    return "Extreme danger", 4


def pollen_band(index: float) -> tuple[str, int]:
    if index < 2.5:
        return "Low", 0
    if index < 4.9:
        return "Low–medium", 1
    if index < 7.3:
        return "Medium", 2
    if index < 9.7:
        return "Medium–high", 3
    return "High", 4


def pollen_reading(index: float, top_allergens: list[str]) -> dict:
    band, severity = pollen_band(index)
    return {
        "index": round(index, 1),
        "band": band,
        "severity": severity,
        "topAllergens": top_allergens,
    }
