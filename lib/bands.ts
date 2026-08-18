// Official band scales, mapped onto the shared 0–4 severity used for
// coloring. These mirror the backend exposure engine from Milestone 4 on;
// the UI never invents a cutoff. Sources: WHO UV index, EPA US AQI
// breakpoints, NWS heat-index categories, Pollen.com index bands.

import type { BandSeverity, PollenReading } from "./types";
import { getLanguage } from "./language";

const band = (zh: string, en: string): string => getLanguage() === "en" ? en : zh;

export interface BandInfo {
  band: string;
  severity: BandSeverity;
}

// WHO UV index bands.
export function uvBand(uv: number): BandInfo {
  if (uv < 3) return { band: band("低", "Low"), severity: 0 };
  if (uv < 6) return { band: band("中等", "Moderate"), severity: 1 };
  if (uv < 8) return { band: band("高", "High"), severity: 2 };
  if (uv < 11) return { band: band("很高", "Very high"), severity: 3 };
  return { band: band("极高", "Extreme"), severity: 4 };
}

// EPA US AQI categories (0–4 collapses the two worst into severity 4).
export function aqiBand(aqi: number): BandInfo {
  if (aqi <= 50) return { band: band("优", "Good"), severity: 0 };
  if (aqi <= 100) return { band: band("良", "Moderate"), severity: 1 };
  if (aqi <= 150) return { band: band("对敏感人群不健康", "Unhealthy for sensitive groups"), severity: 2 };
  if (aqi <= 200) return { band: band("不健康", "Unhealthy"), severity: 3 };
  if (aqi <= 300) return { band: band("非常不健康", "Very unhealthy"), severity: 4 };
  return { band: band("危险", "Hazardous"), severity: 4 };
}

// NWS heat-index categories, on feels-like °F.
export function heatBand(apparentF: number): BandInfo {
  if (apparentF < 80) return { band: band("舒适", "Comfortable"), severity: 0 };
  if (apparentF < 90) return { band: band("注意", "Caution"), severity: 1 };
  if (apparentF < 103) return { band: band("需要格外注意", "Extreme caution"), severity: 2 };
  if (apparentF < 125) return { band: band("危险", "Danger"), severity: 3 };
  return { band: band("极度危险", "Extreme danger"), severity: 4 };
}

// Pollen.com 0–12 index bands.
export function pollenBand(index: number): BandInfo {
  if (index < 2.5) return { band: band("低", "Low"), severity: 0 };
  if (index < 4.9) return { band: band("较低", "Low-medium"), severity: 1 };
  if (index < 7.3) return { band: band("中等", "Medium"), severity: 2 };
  if (index < 9.7) return { band: band("较高", "Medium-high"), severity: 3 };
  return { band: band("高", "High"), severity: 4 };
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

// Same thresholds as dayScoreTone, as a raw CSS variable. Tints the
// halo ring and any other light that follows the score.
export function dayScoreVar(score: number): string {
  if (score >= 75) return "var(--band-0)";
  if (score >= 55) return "var(--band-1)";
  if (score >= 35) return "var(--band-2)";
  return "var(--band-3)";
}
