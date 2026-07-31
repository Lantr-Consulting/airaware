// Typed client for the AirAware backend. Every call degrades gracefully:
// callers catch and fall back to sample data, so the app works signed-out
// of the network entirely (the Milestone 1 experience is the fallback).

import type {
  AdvisorProfile,
  DailySummary,
  HourlyConditions,
  Location,
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

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail ?? detail;
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

export function searchCities(q: string): Promise<Location[]> {
  return req<{ results: Location[] }>(
    `/conditions/search?q=${encodeURIComponent(q)}`
  ).then((r) => r.results);
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

export function chat(args: {
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
  location?: { name: string; lat: number; lon: number; zip?: string };
  profile?: AdvisorProfile;
  thresholds?: Thresholds;
}): Promise<string> {
  return req<{ reply: string }>("/chat", {
    method: "POST",
    body: JSON.stringify(args),
  }).then((r) => r.reply);
}
