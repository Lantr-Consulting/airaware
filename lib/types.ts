// AirAware core records. In Milestone 1 these are filled with mock data
// (lib/mock.ts); later milestones swap the mocks for real API responses
// without reshaping the UI. Mirrored by backend/schema.sql from Milestone 5.

// ---------- Signals & bands ----------

export type Signal = "uv" | "aqi" | "heat" | "pollen";

// Normalized severity used for band coloring across all signals.
// 0 = best (green) … 4 = worst. Each signal maps its official scale onto it.
export type BandSeverity = 0 | 1 | 2 | 3 | 4;

export interface BandReading {
  signal: Signal;
  value: number | null; // null = no coverage (pollen outside providers)
  band: string; // official band name, e.g. "Very high", "Unhealthy"
  severity: BandSeverity;
}

export interface PollenReading {
  index: number; // 0–12 scale (Pollen.com) or CAMS-derived equivalent
  band: string;
  severity: BandSeverity;
  topAllergens: string[];
}

export interface HourlyConditions {
  time: string; // ISO, local to the plan's location
  tempF: number;
  apparentF: number; // feels-like; heat index when hot
  humidity: number; // %
  uvIndex: number;
  cloudCover: number; // %
  precipProb: number; // %
  windMph: number;
  usAqi: number;
  pollen: PollenReading | null;
}

export interface DailySummary {
  date: string; // YYYY-MM-DD
  uvMax: number;
  apparentMaxF: number;
  aqiMax: number;
  pollen: PollenReading | null;
  tempMaxF: number;
  tempMinF: number;
  precipProb: number;
}

export interface Location {
  name: string;
  lat: number;
  lon: number;
  tz: string;
  zip?: string; // enables the US pollen provider
}

// ---------- Advisor (one per user) ----------

export type HeatTolerance = "low" | "typical" | "high";

export interface AdvisorProfile {
  asthma: boolean;
  pollenAllergies: string[]; // e.g. ["grass", "ragweed"]
  skinType: 1 | 2 | 3 | 4 | 5 | 6; // Fitzpatrick
  heatTolerance: HeatTolerance;
  kidMode: boolean; // planning for a child tightens every cutoff
  notes: string;
}

// The user-blessed cutoffs the exposure engine enforces. Interpreted from
// plain English, shown as a table, and never changed without an Activate.
export interface Thresholds {
  uvProtect: number; // UV index at which sunscreen/cover is required
  uvAvoid: number; // UV index at which midday exposure should move
  aqiCaution: number; // US AQI where high-intensity effort gets flagged
  aqiAvoid: number; // US AQI where outdoor plans should move indoors
  heatCautionF: number; // heat index °F for caution
  heatAvoidF: number; // heat index °F to reschedule
  pollenCaution: BandSeverity; // pollen severity that triggers advice
}

export interface Advisor {
  activated: boolean;
  paused: boolean;
  profile: AdvisorProfile;
  thresholds: Thresholds;
  homeLocation: Location;
  units: "imperial" | "metric";
}

// ---------- Activities ----------

export type ActivityKind =
  | "run"
  | "commute"
  | "sport"
  | "hike"
  | "chores"
  | "volunteer";

export type Flexibility = "fixed" | "flex_time" | "flex_day";
export type Intensity = "low" | "moderate" | "high";

export interface Activity {
  id: string;
  name: string;
  kind: ActivityKind;
  daysOfWeek: number[]; // 0 = Sunday … 6 = Saturday
  startTime: string; // "HH:MM" local
  durationMin: number;
  intensity: Intensity;
  location?: Location; // defaults to home
  flexibility: Flexibility;
  indoorAlternative?: string;
  enabled: boolean;
}

// ---------- Day plans & plan items ----------

export type PlanStatus = "draft" | "active" | "superseded";

export type PlanItemKind =
  | "keep"
  | "shift"
  | "shorten"
  | "relocate"
  | "indoor"
  | "gear"
  | "good_window"
  | "warning";

export type PlanItemSeverity = "info" | "caution" | "alert" | "great";

// proposed → the user accepts or declines (with a reason the planner
// learns from). Informational items are "auto". No approval theater.
export type PlanItemStatus = "proposed" | "accepted" | "declined" | "auto";

export interface TimeWindow {
  start: string; // "HH:MM"
  end: string;
}

// One line of the exposure engine's verdict, persisted on the item.
// thresholdSource says *whose* limit fired: a published band or a
// user-blessed sensitivity ("skin_type_2", "asthma").
export interface RuleCheck {
  rule: string; // e.g. "uv_band", "heat_index", "aqi_intensity"
  detail: string; // human sentence with the actual numbers
  value: number | null;
  band: string;
  thresholdSource: string;
  pass: boolean;
}

export interface PlanItem {
  id: string;
  activityId?: string;
  kind: PlanItemKind;
  title: string;
  rationale: string;
  window?: TimeWindow; // the recommended window
  originalWindow?: TimeWindow; // what it moved from (shift/shorten)
  checks: RuleCheck[];
  severity: PlanItemSeverity;
  status: PlanItemStatus;
  feedback?: { reason: string };
  evidence: string[];
}

export interface DayPlan {
  id: string;
  date: string; // YYYY-MM-DD
  location: Location;
  status: PlanStatus;
  dayScore: number; // 0–100
  summary: string;
  supersededNote?: string; // "re-planned 2:10 pm. AQI worsened"
  items: PlanItem[];
}

export type PlanRunStatus = "running" | "done" | "error";

export interface PlanRun {
  id: string;
  status: PlanRunStatus;
  startedAt: string; // ISO
  dates: string[]; // days planned
  report?: string;
  briefingId?: string;
}

// ---------- Advisor chat ----------

export interface Thread {
  id: string;
  title: string;
  updatedAt: string; // ISO
}

export interface Message {
  id: string;
  threadId: string;
  role: "user" | "assistant";
  content: string; // markdown
  createdAt: string; // ISO
}

// ---------- Briefings ----------

export type BriefingCadence = "manual" | "daily" | "weekly" | "on_change";

export interface Briefing {
  id: string;
  title: string;
  prompt: string;
  cadence: BriefingCadence;
  hourLocal?: number; // for daily/weekly
  trigger?: { signal: Signal; severity: BandSeverity }; // for on_change
  enabled: boolean;
  lastRunAt?: string; // ISO
  latestReport?: string; // markdown
  pastRuns: { date: string; summary: string }[];
}
