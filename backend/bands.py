"""Official band scales — the Python mirror of lib/bands.ts.

Severity is the shared 0-4 scale every signal maps onto. Milestone 4's
exposure engine builds on these; nothing else in the backend may invent a
cutoff. Sources: WHO UV index, EPA US AQI, NWS heat-index categories,
Pollen.com index bands.
"""


def uv_band(uv: float) -> tuple[str, int]:
    if uv < 3:
        return "低", 0
    if uv < 6:
        return "中等", 1
    if uv < 8:
        return "高", 2
    if uv < 11:
        return "很高", 3
    return "极高", 4


def aqi_band(aqi: float) -> tuple[str, int]:
    if aqi <= 50:
        return "优", 0
    if aqi <= 100:
        return "良", 1
    if aqi <= 150:
        return "对敏感人群不健康", 2
    if aqi <= 200:
        return "不健康", 3
    if aqi <= 300:
        return "非常不健康", 4
    return "危险", 4


def heat_band(apparent_f: float) -> tuple[str, int]:
    if apparent_f < 80:
        return "舒适", 0
    if apparent_f < 90:
        return "注意", 1
    if apparent_f < 103:
        return "需要格外注意", 2
    if apparent_f < 125:
        return "危险", 3
    return "极度危险", 4


def pollen_band(index: float) -> tuple[str, int]:
    if index < 2.5:
        return "低", 0
    if index < 4.9:
        return "较低", 1
    if index < 7.3:
        return "中等", 2
    if index < 9.7:
        return "较高", 3
    return "高", 4


def pollen_reading(index: float, top_allergens: list[str]) -> dict:
    band, severity = pollen_band(index)
    return {
        "index": round(index, 1),
        "band": band,
        "severity": severity,
        "topAllergens": top_allergens,
    }
