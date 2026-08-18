// Typed client for the AirAware backend. Every call degrades gracefully:
// callers catch and fall back to sample data, so the app works signed-out
// of the network entirely (the Milestone 1 experience is the fallback).

import { supabase } from "./supabase";
import { getLanguage } from "./language";
import type {
  Activity,
  AdvisorProfile,
  Briefing,
  DailySummary,
  DayPlan,
  HourlyConditions,
  Location,
  PlanItem,
  PollenReading,
  Thresholds,
} from "./types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function isSignedOut(e: unknown): boolean {
  return e instanceof ApiError && e.status === 401;
}

async function authHeaders(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Accept-Language": getLanguage() === "en" ? "en" : "zh-CN",
      ...(await authHeaders()),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : detail;
    } catch {}
    throw new ApiError(res.status, detail);
  }
  return res.json();
}

export interface LiveConditions {
  location: Location;
  current: {
    uvIndex: number;
    usAqi: number;
    apparentF: number;
    pollen: PollenReading | null;
  };
  nowIndex: number;
  hourly: HourlyConditions[];
  daily: DailySummary[];
}

// City search goes straight to Open-Meteo from the browser (keyless and
// CORS-open), so result names always follow the UI language regardless of
// backend deploy state. Shapes match the backend proxy exactly.
export async function searchCities(q: string, count = 5): Promise<Location[]> {
  const language = getLanguage() === "en" ? "en" : "zh";
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=${count}&language=${language}&format=json`
  );
  if (!res.ok) throw new ApiError(res.status, res.statusText);
  const data: {
    results?: {
      name: string;
      admin1?: string;
      country?: string;
      country_code?: string;
      latitude: number;
      longitude: number;
      timezone?: string;
      postcodes?: string[];
    }[];
  } = await res.json();
  return (data.results ?? []).map((hit) => {
    const suffix = hit.country_code === "US" || !hit.country ? hit.admin1 : hit.country;
    return {
      name: suffix ? `${hit.name}, ${suffix}` : hit.name,
      lat: hit.latitude,
      lon: hit.longitude,
      tz: hit.timezone ?? "UTC",
      zip: hit.country_code === "US" && hit.postcodes?.length ? hit.postcodes[0] : undefined,
    };
  });
}

export function getConditions(loc: {
  lat: number;
  lon: number;
  zip?: string;
  name?: string;
}): Promise<LiveConditions> {
  const params = new URLSearchParams({ lat: String(loc.lat), lon: String(loc.lon) });
  if (loc.zip) params.set("zip", loc.zip);
  if (loc.name) params.set("name", loc.name);
  return req<LiveConditions>(`/conditions?${params}`);
}

export function interpretProfile(
  text: string
): Promise<{ profile: AdvisorProfile; thresholds: Thresholds }> {
  return req("/interpret-profile", { method: "POST", body: JSON.stringify({ text }) });
}

export interface Me {
  email: string;
  profile: AdvisorProfile;
  thresholds: Thresholds;
  homeLocation: Location;
  units: "imperial" | "metric";
  activated: boolean;
  paused: boolean;
}

export function getMe(): Promise<Me> {
  return req<Me>("/me");
}

export function patchSettings(fields: {
  profile?: AdvisorProfile;
  thresholds?: Thresholds;
  homeLocation?: Location;
  units?: string;
  paused?: boolean;
  activated?: boolean;
}): Promise<Omit<Me, "email">> {
  return req("/me/settings", { method: "PATCH", body: JSON.stringify(fields) });
}

export function listActivities(): Promise<Activity[]> {
  return req<{ activities: Activity[] }>("/activities").then((r) => r.activities);
}

export function createActivity(a: Omit<Activity, "id">): Promise<Activity> {
  return req("/activities", { method: "POST", body: JSON.stringify(a) });
}

export function updateActivity(id: string, patch: Partial<Activity>): Promise<Activity> {
  return req(`/activities/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export function deleteActivity(id: string): Promise<void> {
  return req(`/activities/${id}`, { method: "DELETE" });
}

export function getTodayPlan(): Promise<DayPlan> {
  return req<DayPlan>("/plan/today");
}

export interface PlanRunStatus {
  id: string;
  status: "running" | "done" | "error";
  report?: string;
  error?: string;
  steer: string[];
}

// Generation is async: this returns a run id immediately; poll getRun until
// done, then re-fetch the plan. Steering notes land in the NEXT run.
export function generatePlan(): Promise<{ runId: string; status: string }> {
  return req("/plan/generate", { method: "POST", body: JSON.stringify({}) });
}

export function getRun(runId: string): Promise<PlanRunStatus> {
  return req(`/plan-runs/${runId}`);
}

export function steerRun(runId: string, note: string): Promise<PlanRunStatus> {
  return req(`/plan-runs/${runId}/steer`, { method: "POST", body: JSON.stringify({ note }) });
}

export function getThreads(): Promise<{ id: string; title: string; updatedAt: string }[]> {
  return req<{ threads: { id: string; title: string; updatedAt: string }[] }>("/threads").then(
    (r) => r.threads
  );
}

export function getThreadMessages(
  threadId: string
): Promise<{ id: string; threadId: string; role: "user" | "assistant"; content: string; createdAt: string }[]> {
  return req<{ messages: { id: string; threadId: string; role: "user" | "assistant"; content: string; createdAt: string }[] }>(
    `/threads/${threadId}/messages`
  ).then((r) => r.messages);
}

// Accept re-checks on the server against the LATEST forecast; a 409 means
// conditions moved and the window now crosses an avoid line. The error
// carries the freshly annotated item.
export async function acceptItem(
  id: string,
  window?: { start: string; end: string }
): Promise<{ item: PlanItem; blocked: string | null }> {
  const res = await fetch(`${API}/plan-items/${id}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ window }),
  });
  const body = await res.json();
  if (res.status === 409 && body.detail?.item) {
    return { item: body.detail.item as PlanItem, blocked: body.detail.message as string };
  }
  if (!res.ok) throw new ApiError(res.status, body.detail ?? res.statusText);
  return { item: body as PlanItem, blocked: null };
}

export function declineItem(id: string, reason: string): Promise<PlanItem> {
  return req<PlanItem>(`/plan-items/${id}/decline`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function getBriefings(): Promise<Briefing[]> {
  return req<{ briefings: Briefing[] }>("/briefings").then((r) => r.briefings);
}

export function createBriefing(fields: {
  title: string;
  prompt: string;
  cadence: string;
  hourLocal?: number;
  trigger?: { signal: string; severity: number } | null;
}): Promise<Briefing> {
  return req("/briefings", { method: "POST", body: JSON.stringify(fields) });
}

export function updateBriefing(id: string, patch: Partial<Briefing>): Promise<Briefing> {
  return req(`/briefings/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export function deleteBriefing(id: string): Promise<void> {
  return req(`/briefings/${id}`, { method: "DELETE" });
}

export function runBriefing(id: string): Promise<{ report: string; createdAt: string }> {
  return req(`/briefings/${id}/run`, { method: "POST", body: "{}" });
}

export function chat(args: {
  message: string;
  history?: { role: "user" | "assistant"; content: string }[];
  location?: { name: string; lat: number; lon: number; zip?: string };
  profile?: AdvisorProfile;
  thresholds?: Thresholds;
  threadId?: string | null;
}): Promise<{ reply: string; threadId: string | null }> {
  return req("/chat", { method: "POST", body: JSON.stringify(args) });
}
