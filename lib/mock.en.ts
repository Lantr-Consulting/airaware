// Milestone 1 mock data — one coherent week for a fixture user in Austin,
// TX, shaped exactly like the records the backend will return. Numbers are
// hand-checked against the band scales in lib/bands.ts so every screen
// renders honestly. "Today" is pinned so the UI is deterministic.

import { pollenReading } from "./bands";
import type {
  Activity,
  Advisor,
  Briefing,
  DailySummary,
  DayPlan,
  HourlyConditions,
  Location,
  Message,
  PlanRun,
  Thread,
} from "./types";

export const TODAY = "2026-07-31"; // a Friday
export const NOW_HHMM = "12:00"; // "now" is pinned like the date

export const HOME: Location = {
  name: "Austin, TX",
  lat: 30.27,
  lon: -97.74,
  tz: "America/Chicago",
  zip: "78701",
};

// ---------- Advisor ----------

export const ADVISOR: Advisor = {
  activated: true,
  paused: false,
  profile: {
    asthma: false,
    pollenAllergies: ["grass", "ragweed"],
    skinType: 2,
    heatTolerance: "typical",
    kidMode: false,
    notes:
      "Trains for a 10K in October. Prefers mornings but not before 6:30. Dog needs a real walk every evening.",
  },
  thresholds: {
    uvProtect: 3, // skin type II — protection starts at Moderate
    uvAvoid: 8,
    aqiCaution: 100, // grass/ragweed allergies — flag hard efforts early
    aqiAvoid: 150,
    heatCautionF: 95,
    heatAvoidF: 103,
    pollenCaution: 2,
  },
  homeLocation: HOME,
  units: "imperial",
};

// ---------- Activities ----------

export const ACTIVITIES: Activity[] = [
  {
    id: "a1",
    name: "Morning run",
    kind: "run",
    daysOfWeek: [1, 3, 5],
    startTime: "07:00",
    durationMin: 45,
    intensity: "high",
    flexibility: "flex_time",
    indoorAlternative: "Treadmill at the gym",
    enabled: true,
  },
  {
    id: "a2",
    name: "Bike commute",
    kind: "commute",
    daysOfWeek: [1, 2, 3, 4, 5],
    startTime: "08:30",
    durationMin: 25,
    intensity: "moderate",
    flexibility: "fixed",
    enabled: true,
  },
  {
    id: "a3",
    name: "Soccer practice",
    kind: "sport",
    daysOfWeek: [2, 4],
    startTime: "17:30",
    durationMin: 90,
    intensity: "high",
    flexibility: "fixed",
    indoorAlternative: "Indoor futsal court",
    enabled: true,
  },
  {
    id: "a4",
    name: "Trail hike",
    kind: "hike",
    daysOfWeek: [6],
    startTime: "09:00",
    durationMin: 180,
    intensity: "moderate",
    flexibility: "flex_day",
    enabled: true,
  },
  {
    id: "a5",
    name: "Evening dog walk",
    kind: "chores",
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    startTime: "20:00",
    durationMin: 30,
    intensity: "low",
    flexibility: "flex_time",
    enabled: true,
  },
  {
    id: "a6",
    name: "Community garden shift",
    kind: "volunteer",
    daysOfWeek: [0],
    startTime: "10:00",
    durationMin: 120,
    intensity: "moderate",
    flexibility: "flex_time",
    enabled: true,
  },
];

// ---------- Today's hourly conditions (Austin in late July) ----------

const h = (
  time: string,
  tempF: number,
  apparentF: number,
  humidity: number,
  uvIndex: number,
  cloudCover: number,
  precipProb: number,
  windMph: number,
  usAqi: number,
  pollenIdx: number | null
): HourlyConditions => ({
  time: `${TODAY}T${time}:00`,
  tempF,
  apparentF,
  humidity,
  uvIndex,
  cloudCover,
  precipProb,
  windMph,
  usAqi,
  pollen: pollenIdx === null ? null : pollenReading(pollenIdx, ["grass", "ragweed"]),
});

export const TODAY_HOURLY: HourlyConditions[] = [
  h("06:00", 78, 80, 74, 0, 18, 0, 6, 52, 4.1),
  h("07:00", 79, 82, 71, 1, 15, 0, 6, 54, 4.3),
  h("08:00", 82, 85, 66, 3, 12, 0, 7, 58, 4.6),
  h("09:00", 86, 90, 58, 5, 10, 0, 8, 63, 4.8),
  h("10:00", 90, 95, 51, 7, 8, 0, 9, 68, 4.9),
  h("11:00", 94, 99, 45, 9, 6, 0, 9, 74, 4.7),
  h("12:00", 97, 103, 40, 10, 5, 0, 10, 80, 4.4),
  h("13:00", 99, 105, 37, 10, 5, 0, 10, 86, 4.2),
  h("14:00", 100, 106, 35, 9, 6, 0, 11, 91, 4.0),
  h("15:00", 101, 106, 34, 8, 8, 0, 11, 95, 3.9),
  h("16:00", 100, 105, 35, 6, 10, 0, 11, 97, 3.8),
  h("17:00", 99, 104, 37, 4, 12, 0, 10, 96, 3.8),
  h("18:00", 97, 102, 40, 2, 14, 0, 9, 92, 3.9),
  h("19:00", 94, 99, 45, 1, 15, 0, 8, 85, 4.0),
  h("20:00", 91, 96, 50, 0, 16, 0, 7, 76, 4.1),
  h("21:00", 88, 92, 55, 0, 18, 0, 7, 68, 4.2),
];

// ---------- The week ahead (Planner) ----------

const d = (
  date: string,
  uvMax: number,
  apparentMaxF: number,
  aqiMax: number,
  pollenIdx: number | null,
  tempMaxF: number,
  tempMinF: number,
  precipProb: number
): DailySummary => ({
  date,
  uvMax,
  apparentMaxF,
  aqiMax,
  pollen: pollenIdx === null ? null : pollenReading(pollenIdx, ["grass", "ragweed"]),
  tempMaxF,
  tempMinF,
  precipProb,
});

export const WEEK: DailySummary[] = [
  d("2026-07-31", 10, 106, 97, 4.9, 101, 78, 0),
  d("2026-08-01", 11, 108, 102, 5.2, 103, 79, 0),
  d("2026-08-02", 10, 104, 88, 5.0, 100, 78, 5),
  d("2026-08-03", 9, 99, 72, 4.4, 96, 76, 20),
  d("2026-08-04", 7, 93, 55, 3.1, 91, 74, 55),
  d("2026-08-05", 8, 95, 48, 2.2, 93, 73, 15),
  d("2026-08-06", 9, 98, 61, 2.8, 95, 74, 5),
];

// ---------- Day plans ----------

export const PLANS: DayPlan[] = [
  {
    id: "p1",
    date: TODAY,
    location: HOME,
    status: "active",
    dayScore: 58,
    summary:
      "A classic late-July scorcher: the morning is genuinely good, the afternoon is a Danger-band heat sandwich (feels like 106°F, 2–5 pm), and air quality drifts into the ozone yellow zone by mid-afternoon. Front-load anything outdoors.",
    supersededNote: "Re-planned 6:02 am — tonight's heat lingers longer than yesterday's forecast showed.",
    items: [
      {
        id: "i1",
        activityId: "a1",
        kind: "keep",
        title: "Morning run, 7:00 — conditions are on your side",
        rationale:
          "UV 1 (Low), feels like 82°F, AQI 54 (Moderate but well under your 100 cutoff). Best running hour of the day.",
        window: { start: "07:00", end: "07:45" },
        checks: [
          { rule: "uv_band", detail: "UV 1 — Low, no protection required", value: 1, band: "Low", thresholdSource: "who_uv", pass: true },
          { rule: "heat_index", detail: "Feels like 82°F — under your 95°F caution line", value: 82, band: "Comfortable", thresholdSource: "user_heat_caution", pass: true },
          { rule: "aqi_intensity", detail: "AQI 54 at high intensity — under your 100 line", value: 54, band: "Moderate", thresholdSource: "user_aqi_caution", pass: true },
        ],
        severity: "info",
        status: "auto",
        evidence: ["Hourly forecast, Open-Meteo (mock)", "Your thresholds v3"],
      },
      {
        id: "i2",
        activityId: "a2",
        kind: "gear",
        title: "Sunscreen + sleeves for the ride home",
        rationale:
          "Your 8:30 ride out is UV 3 — right at your protection line (skin type II). The ride home near 5:30 pm is the bigger deal: UV 4 with 25 minutes of full sun.",
        window: { start: "17:30", end: "17:55" },
        checks: [
          { rule: "uv_band", detail: "UV 3–4 across both rides — at or above your protect-at-3 rule", value: 4, band: "Moderate", thresholdSource: "skin_type_2", pass: false },
        ],
        severity: "caution",
        status: "auto",
        evidence: ["Hourly UV forecast (mock)"],
      },
      {
        id: "i3",
        kind: "warning",
        title: "Danger-band heat, 2–5 pm",
        rationale:
          "Feels-like peaks at 106°F — NWS Danger category. Anything strenuous outdoors in this window is a bad trade. Start hydrating before the evening and keep water with you.",
        window: { start: "14:00", end: "17:00" },
        checks: [
          { rule: "heat_index", detail: "Feels like 106°F — Danger band, above your 103°F avoid line", value: 106, band: "Danger", thresholdSource: "nws_heat", pass: false },
        ],
        severity: "alert",
        status: "auto",
        evidence: ["Hourly forecast (mock)", "NWS heat-index categories"],
      },
      {
        id: "i4",
        activityId: "a5",
        kind: "shift",
        title: "Push the dog walk to 8:45 pm",
        rationale:
          "At 8:00 it still feels like 96°F — over your caution line, and hot pavement for paws. By 8:45 it drops to 92°F with the sun fully down.",
        originalWindow: { start: "20:00", end: "20:30" },
        window: { start: "20:45", end: "21:15" },
        checks: [
          { rule: "heat_index", detail: "96°F at 8:00 pm — above your 95°F caution line", value: 96, band: "Extreme caution", thresholdSource: "user_heat_caution", pass: false },
          { rule: "heat_index", detail: "92°F by 8:45 pm — back under the line", value: 92, band: "Extreme caution", thresholdSource: "user_heat_caution", pass: true },
        ],
        severity: "caution",
        status: "proposed",
        evidence: ["Hourly forecast (mock)"],
      },
      {
        id: "i5",
        kind: "good_window",
        title: "Best outdoor window: 6:30–8:30 am",
        rationale:
          "Low UV, feels-like under 85°F, AQI in the 50s, pollen low-medium. If anything else needs to happen outside today, put it here.",
        window: { start: "06:30", end: "08:30" },
        checks: [
          { rule: "window_score", detail: "All four signals green-to-yellow for the full window", value: null, band: "Great", thresholdSource: "exposure_engine", pass: true },
        ],
        severity: "great",
        status: "auto",
        evidence: ["Window scan across all signals (mock)"],
      },
    ],
  },
  {
    id: "p2",
    date: "2026-08-01",
    location: HOME,
    status: "draft",
    dayScore: 44,
    summary:
      "Saturday looks worse than today: UV 11 (Extreme) at midday, feels-like 108°F, and AQI pushing 102. The 9 am hike start walks straight into it.",
    items: [
      {
        id: "i6",
        activityId: "a4",
        kind: "shift",
        title: "Start the hike at 7:00 instead of 9:00",
        rationale:
          "A 9:00 start puts your final hour at UV 9+ and feels-like 100°F. Starting at 7:00 finishes the 3 hours before the worst of it.",
        originalWindow: { start: "09:00", end: "12:00" },
        window: { start: "07:00", end: "10:00" },
        checks: [
          { rule: "uv_band", detail: "UV reaches 9 (Very high) by 11 am — above your avoid-at-8 line", value: 9, band: "Very high", thresholdSource: "user_uv_avoid", pass: false },
          { rule: "heat_index", detail: "Feels like 100°F by noon — above your 95°F caution line", value: 100, band: "Extreme caution", thresholdSource: "user_heat_caution", pass: false },
          { rule: "window_score", detail: "7–10 am window passes every check", value: null, band: "OK", thresholdSource: "exposure_engine", pass: true },
        ],
        severity: "caution",
        status: "proposed",
        evidence: ["Saturday hourly forecast (mock)"],
      },
      {
        id: "i7",
        activityId: "a4",
        kind: "relocate",
        title: "Or: trade the exposed ridge for the creek loop",
        rationale:
          "If 7:00 is too early, the Barton Creek greenbelt loop is ~70% shaded — it buys you roughly two extra tolerable hours vs. the ridge trail.",
        window: { start: "08:00", end: "11:00" },
        checks: [
          { rule: "uv_band", detail: "Shade cover cuts effective exposure below your protect line for most of the loop", value: 6, band: "High", thresholdSource: "skin_type_2", pass: true },
        ],
        severity: "info",
        status: "proposed",
        evidence: ["Trail shade estimate (mock)"],
      },
    ],
  },
  {
    id: "p0",
    date: "2026-07-30",
    location: HOME,
    status: "superseded",
    dayScore: 61,
    summary: "Thursday: hot afternoon, decent morning, soccer practice squeaked under the heat line after a 30-minute delay.",
    items: [
      {
        id: "i0a",
        activityId: "a3",
        kind: "shorten",
        title: "Cut practice to 60 minutes",
        rationale: "Feels-like was 104°F at 5:30 pm — above your avoid line. Declined; coach shifted the whole practice 30 minutes later instead.",
        originalWindow: { start: "17:30", end: "19:00" },
        window: { start: "17:30", end: "18:30" },
        checks: [
          { rule: "heat_index", detail: "104°F at kickoff — above your 103°F avoid line", value: 104, band: "Danger", thresholdSource: "user_heat_avoid", pass: false },
        ],
        severity: "alert",
        status: "declined",
        feedback: { reason: "Can't shorten team practice — flag it earlier so I can ask the coach to move it instead." },
        evidence: ["Thursday hourly forecast (mock)"],
      },
    ],
  },
];

export const TODAY_PLAN = PLANS[0];

// ---------- Plan runs ----------

export const PLAN_RUNS: PlanRun[] = [
  {
    id: "r1",
    status: "done",
    startedAt: `${TODAY}T06:02:00`,
    dates: [TODAY, "2026-08-01"],
    report:
      "Re-planned today and tomorrow. Kept the 7 am run, proposed pushing the dog walk to 8:45 pm, and flagged Saturday's hike — two options proposed.",
  },
];

// ---------- Advisor chat ----------

export const THREADS: Thread[] = [
  { id: "t1", title: "Lunch run?", updatedAt: `${TODAY}T12:41:00` },
  { id: "t2", title: "Cloudy-day sunscreen", updatedAt: "2026-07-29T18:22:00" },
  { id: "t3", title: "Saturday hike options", updatedAt: `${TODAY}T06:05:00` },
];

export const MESSAGES: Message[] = [
  {
    id: "m1",
    threadId: "t1",
    role: "user",
    content: "Any chance I can squeeze a run in at lunch instead of tomorrow morning?",
    createdAt: `${TODAY}T12:38:00`,
  },
  {
    id: "m2",
    threadId: "t1",
    role: "assistant",
    content:
      "I'd skip it. Right now it's **UV 10 (Very high)** and feels like **103°F** — that's over your 95°F caution line **and** at your UV avoid line, at high intensity. The engine scores the lunch window 12/100 for a run.\n\nTwo windows that do pass every check:\n\n- **Tonight 8:45–9:30 pm** — feels like 92°F, UV 0, AQI back down to ~70\n- **Tomorrow 6:30–7:15 am** — the best slot in the next 36 hours\n\nWant me to pencil in tonight?",
    createdAt: `${TODAY}T12:41:00`,
  },
  {
    id: "m3",
    threadId: "t2",
    role: "user",
    content: "It's overcast today — do I really need sunscreen for the ride in?",
    createdAt: "2026-07-29T18:20:00",
  },
  {
    id: "m4",
    threadId: "t2",
    role: "assistant",
    content:
      "Yes. This morning had **70% cloud cover and a UV reading of 4 (Moderate)**; up to ~80% of UV can pass through typical cloud. Your skin type II profile recommends protection from UV 3, so today’s reading crossed that line.",
    createdAt: "2026-07-29T18:22:00",
  },
];

// ---------- Briefings ----------

export const BRIEFINGS: Briefing[] = [
  {
    id: "b1",
    title: "Morning briefing",
    prompt:
      "Every morning, summarize today's plan: the day score, anything risky about my scheduled activities, what to wear or bring, and the single best outdoor window.",
    cadence: "daily",
    hourLocal: 7,
    enabled: true,
    lastRunAt: `${TODAY}T07:00:00`,
    latestReport:
      "**Friday, day score 58.** Run at 7 is a green light. Ride home needs sunscreen + sleeves (UV 4). Danger-band heat 2–5 pm — nothing strenuous outside. Dog walk: proposal pending to push it to 8:45 pm. Best window: 6:30–8:30 am.",
    pastRuns: [
      { date: "2026-07-30", summary: "Day score 61 — practice heat flag, declined shorten, morning all clear." },
      { date: "2026-07-29", summary: "Day score 66 — overcast but UV 4; sunscreen rule fired anyway." },
      { date: "2026-07-28", summary: "Day score 71 — best morning of the week, long run suggested and taken." },
    ],
  },
  {
    id: "b2",
    title: "Ozone watch",
    prompt:
      "If air quality crosses into Unhealthy for Sensitive Groups (AQI 101+), alert me and re-check my outdoor activities for the rest of that day.",
    cadence: "on_change",
    trigger: { signal: "aqi", severity: 2 },
    enabled: true,
    lastRunAt: "2026-07-26T15:20:00",
    latestReport:
      "AQI hit 104 (USG) at 3 pm Sunday. Garden shift had already ended — no changes needed. Evening dog walk cleared at AQI 88 by 8 pm.",
    pastRuns: [{ date: "2026-07-26", summary: "USG ozone afternoon — no schedule impact." }],
  },
  {
    id: "b3",
    title: "Weekend outlook",
    prompt:
      "Every Friday at 4 pm, look at Saturday and Sunday: rank the outdoor windows, flag anything my weekend activities collide with, and suggest the better day for the hike.",
    cadence: "weekly",
    hourLocal: 16,
    enabled: true,
    lastRunAt: "2026-07-24T16:00:00",
    latestReport:
      "Both days hot; Sunday marginally better (aqi peak 84 vs 96). Hike: Sunday 7 am start recommended over Saturday.",
    pastRuns: [{ date: "2026-07-24", summary: "Sunday preferred for the hike; Saturday afternoon written off." }],
  },
];

// ---------- Explore (public) ----------

export interface CityConditions {
  location: Location;
  current: { uvIndex: number; usAqi: number; apparentF: number; pollenIdx: number | null };
  daily: DailySummary[];
}

const cityWeek = (
  base: DailySummary[],
  uvShift: number,
  heatShift: number,
  aqiShift: number,
  pollenIdx: number | null
): DailySummary[] =>
  base.map((day) => ({
    ...day,
    uvMax: Math.max(1, day.uvMax + uvShift),
    apparentMaxF: day.apparentMaxF + heatShift,
    tempMaxF: day.tempMaxF + heatShift,
    tempMinF: day.tempMinF + heatShift,
    aqiMax: Math.max(15, day.aqiMax + aqiShift),
    pollen: pollenIdx === null ? null : pollenReading(pollenIdx, ["grass"]),
  }));

export const EXPLORE_CITIES: CityConditions[] = [
  {
    location: HOME,
    current: { uvIndex: 10, usAqi: 80, apparentF: 103, pollenIdx: 4.4 },
    daily: WEEK,
  },
  {
    location: { name: "Phoenix, AZ", lat: 33.45, lon: -112.07, tz: "America/Phoenix", zip: "85004" },
    current: { uvIndex: 11, usAqi: 92, apparentF: 111, pollenIdx: 2.1 },
    daily: cityWeek(WEEK, 1, 6, 5, 2.1),
  },
  {
    location: { name: "Chicago, IL", lat: 41.88, lon: -87.63, tz: "America/Chicago", zip: "60601" },
    current: { uvIndex: 7, usAqi: 58, apparentF: 88, pollenIdx: 6.8 },
    daily: cityWeek(WEEK, -3, -16, -30, 6.8),
  },
  {
    location: { name: "Berlin, Germany", lat: 52.52, lon: 13.4, tz: "Europe/Berlin" },
    current: { uvIndex: 5, usAqi: 42, apparentF: 79, pollenIdx: 5.4 },
    daily: cityWeek(WEEK, -5, -25, -45, 5.4),
  },
  {
    location: { name: "Lagos, Nigeria", lat: 6.52, lon: 3.38, tz: "Africa/Lagos" },
    current: { uvIndex: 8, usAqi: 71, apparentF: 95, pollenIdx: null },
    daily: cityWeek(WEEK, -1, -10, -20, null),
  },
];
