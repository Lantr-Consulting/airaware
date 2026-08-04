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
  if (uv < 3) return { band: "低", severity: 0 };
  if (uv < 6) return { band: "中等", severity: 1 };
  if (uv < 8) return { band: "高", severity: 2 };
  if (uv < 11) return { band: "很高", severity: 3 };
  return { band: "极高", severity: 4 };
}

// EPA US AQI categories (0–4 collapses the two worst into severity 4).
export function aqiBand(aqi: number): BandInfo {
  if (aqi <= 50) return { band: "优", severity: 0 };
  if (aqi <= 100) return { band: "良", severity: 1 };
  if (aqi <= 150) return { band: "对敏感人群不健康", severity: 2 };
  if (aqi <= 200) return { band: "不健康", severity: 3 };
  if (aqi <= 300) return { band: "非常不健康", severity: 4 };
  return { band: "危险", severity: 4 };
}

// NWS heat-index categories, on feels-like °F.
export function heatBand(apparentF: number): BandInfo {
  if (apparentF < 80) return { band: "舒适", severity: 0 };
  if (apparentF < 90) return { band: "注意", severity: 1 };
  if (apparentF < 103) return { band: "需要格外注意", severity: 2 };
  if (apparentF < 125) return { band: "危险", severity: 3 };
  return { band: "极度危险", severity: 4 };
}

// Pollen.com 0–12 index bands.
export function pollenBand(index: number): BandInfo {
  if (index < 2.5) return { band: "低", severity: 0 };
  if (index < 4.9) return { band: "较低", severity: 1 };
  if (index < 7.3) return { band: "中等", severity: 2 };
  if (index < 9.7) return { band: "较高", severity: 3 };
  return { band: "高", severity: 4 };
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
