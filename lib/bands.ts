// Official band scales, mapped onto the shared 0–4 severity used for
// coloring. These mirror the backend exposure engine from Milestone 4 on —
// the UI never invents a cutoff. Sources: WHO UV index, EPA US AQI
// breakpoints, NWS heat-index categories, Pollen.com index bands.

import type { BandSeverity, PollenReading } from "./types";

export interface BandInfo {
  band: string;
  severity: BandSeverity;
}

// WHO UV index bands.
export function uvBand(uv: number): BandInfo {
  if (uv < 3) return { band: "Low", severity: 0 };
  if (uv < 6) return { band: "Moderate", severity: 1 };
  if (uv < 8) return { band: "High", severity: 2 };
  if (uv < 11) return { band: "Very high", severity: 3 };
  return { band: "Extreme", severity: 4 };
}

// EPA US AQI categories (0–4 collapses the two worst into severity 4).
export function aqiBand(aqi: number): BandInfo {
  if (aqi <= 50) return { band: "Good", severity: 0 };
  if (aqi <= 100) return { band: "Moderate", severity: 1 };
  if (aqi <= 150) return { band: "Unhealthy for sensitive groups", severity: 2 };
  if (aqi <= 200) return { band: "Unhealthy", severity: 3 };
  if (aqi <= 300) return { band: "Very unhealthy", severity: 4 };
  return { band: "Hazardous", severity: 4 };
}

// NWS heat-index categories, on feels-like °F.
export function heatBand(apparentF: number): BandInfo {
  if (apparentF < 80) return { band: "Comfortable", severity: 0 };
  if (apparentF < 90) return { band: "Caution", severity: 1 };
  if (apparentF < 103) return { band: "Extreme caution", severity: 2 };
  if (apparentF < 125) return { band: "Danger", severity: 3 };
  return { band: "Extreme danger", severity: 4 };
}

// Pollen.com 0–12 index bands.
export function pollenBand(index: number): BandInfo {
  if (index < 2.5) return { band: "Low", severity: 0 };
  if (index < 4.9) return { band: "Low–medium", severity: 1 };
  if (index < 7.3) return { band: "Medium", severity: 2 };
  if (index < 9.7) return { band: "Medium–high", severity: 3 };
  return { band: "High", severity: 4 };
}

export function pollenReading(
  index: number,
  topAllergens: string[]
): PollenReading {
  const b = pollenBand(index);
  return { index, band: b.band, severity: b.severity, topAllergens };
}

// Severity → design tokens (defined in globals.css).
export const SEVERITY_BG = [
  "bg-band-0",
  "bg-band-1",
  "bg-band-2",
  "bg-band-3",
  "bg-band-4",
] as const;

export const SEVERITY_TEXT = [
  "text-band-0",
  "text-band-1",
  "text-band-2",
  "text-band-3",
  "text-band-4",
] as const;

export function dayScoreTone(score: number): string {
  if (score >= 75) return "text-band-0";
  if (score >= 55) return "text-band-1";
  if (score >= 35) return "text-band-2";
  return "text-band-3";
}
