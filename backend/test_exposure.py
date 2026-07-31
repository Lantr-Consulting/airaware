"""Unit tests for the exposure engine.

The point of this file (and the lesson): thresholds are testable against
PUBLISHED tables. If a number here drifts, the build fails — no prompt
patch can silently change what "dangerous" means.

Run: .venv/bin/pytest -q
"""

from bands import aqi_band, heat_band, pollen_band, uv_band
from exposure import annotate_item, day_score, evaluate_window, heat_index_f

THRESHOLDS = {
    "uvProtect": 3,
    "uvAvoid": 8,
    "aqiCaution": 100,
    "aqiAvoid": 150,
    "heatCautionF": 95,
    "heatAvoidF": 103,
    "pollenCaution": 2,
}
PROFILE = {"skinType": 2, "pollenAllergies": ["grass"], "asthma": False}


def hour(t="12:00", uv=1, apparent=75, aqi=40, pollen=None):
    return {
        "time": f"2026-07-31T{t}",
        "uvIndex": uv,
        "apparentF": apparent,
        "usAqi": aqi,
        "pollen": pollen,
    }


# ---------- NWS heat index: Rothfusz vs the official table ----------

def test_heat_index_matches_nws_table():
    # (T°F, RH%) -> table value from wpc.ncep.noaa.gov
    for temp, rh, expected in [(90, 70, 105), (95, 55, 110), (100, 40, 109), (85, 60, 90)]:
        assert abs(heat_index_f(temp, rh) - expected) <= 1.5, (temp, rh)


def test_heat_index_uses_simple_formula_when_mild():
    assert heat_index_f(70, 50) < 80


# ---------- Band edges: WHO / EPA / NWS / Pollen.com ----------

def test_band_edges():
    assert uv_band(2)[0] == "Low" and uv_band(3)[0] == "Moderate"
    assert uv_band(8)[0] == "Very high" and uv_band(11)[0] == "Extreme"
    assert aqi_band(50)[0] == "Good" and aqi_band(51)[0] == "Moderate"
    assert aqi_band(101)[0] == "Unhealthy for sensitive groups"
    assert heat_band(79)[1] == 0 and heat_band(80)[1] == 1
    assert heat_band(103)[0] == "Danger"
    assert pollen_band(2.4)[0] == "Low" and pollen_band(9.7)[0] == "High"


# ---------- Intensity scaling: a hard run is not a picnic ----------

def test_same_aqi_fails_hard_run_but_passes_stroll():
    hours = [hour(aqi=80)]
    hard = evaluate_window(hours, "high", THRESHOLDS, PROFILE)  # line: 100*0.75=75
    easy = evaluate_window(hours, "low", THRESHOLDS, PROFILE)  # line: 100
    hard_aqi = next(c for c in hard["checks"] if c["rule"] == "aqi_intensity")
    easy_aqi = next(c for c in easy["checks"] if c["rule"] == "aqi_intensity")
    assert not hard_aqi["pass"] and easy_aqi["pass"]


# ---------- User-owned lines fire with the user's numbers ----------

def test_heat_avoid_line_is_an_alert():
    verdict = evaluate_window([hour(apparent=106)], "low", THRESHOLDS, PROFILE)
    heat = next(c for c in verdict["checks"] if c["rule"] == "heat_index")
    assert not heat["pass"] and heat["thresholdSource"] == "user_heat_avoid"
    assert verdict["severity"] == "alert"


# ---------- Pollen is nullable: skipped, never guessed ----------

def test_no_pollen_coverage_is_skipped_not_guessed():
    verdict = evaluate_window([hour(pollen=None)], "low", THRESHOLDS, PROFILE)
    p = next(c for c in verdict["checks"] if c["rule"] == "pollen_band")
    assert p["pass"] and "no coverage" in p["detail"].lower()


# ---------- The veto: model proposes, code disposes ----------

def test_good_window_at_uv_10_is_vetoed():
    item = {
        "kind": "good_window",
        "title": "Perfect noon run",
        "rationale": "Lovely and sunny!",
        "window": {"start": "12:00", "end": "13:00"},
        "severity": "great",
    }
    hourly = [hour(t="12:00", uv=10, apparent=104, aqi=60)]
    out = annotate_item(item, hourly, {"intensity": "high"}, THRESHOLDS, PROFILE)
    assert out["kind"] == "warning"  # stripped of its label
    assert out["severity"] == "alert"
    assert any(not c["pass"] for c in out["checks"])


def test_clean_morning_window_earns_great():
    item = {
        "kind": "good_window",
        "title": "Morning window",
        "rationale": "",
        "window": {"start": "07:00", "end": "08:00"},
        "severity": "info",
    }
    hourly = [hour(t="07:00", uv=1, apparent=76, aqi=35)]
    out = annotate_item(item, hourly, None, THRESHOLDS, PROFILE)
    assert out["kind"] == "good_window" and out["severity"] == "great"


# ---------- Day score is deterministic and bounded ----------

def test_day_score_bounds_and_ordering():
    good_day = [hour(t=f"{h:02d}:00", uv=2, apparent=75, aqi=30) for h in range(6, 21)]
    bad_day = [hour(t=f"{h:02d}:00", uv=10, apparent=107, aqi=160) for h in range(6, 21)]
    schedule = [
        {"activity": {"intensity": "high"}, "start": "07:00", "end": "07:45"},
        {"activity": {"intensity": "low"}, "start": "20:00", "end": "20:30"},
    ]
    g = day_score(good_day, schedule, THRESHOLDS, PROFILE)
    b = day_score(bad_day, schedule, THRESHOLDS, PROFILE)
    assert 0 <= b < g <= 100
