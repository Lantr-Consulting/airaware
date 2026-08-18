export function fmtTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function fmtWindow(w: { start: string; end: string }): string {
  return `${fmtTime(w.start)}–${fmtTime(w.end)}`;
}

// Dates are formatted by hand, never via toLocaleDateString: Node and the
// browser ship different ICU data (e.g. "7月31日周五" vs "7月31日 周五"),
// and that one-space difference is a hydration mismatch.
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW_LONG_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DOW_LONG_ZH = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

export function fmtDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return getLanguage() === "en"
    ? `${DOW_SHORT_EN[d.getDay()]}, ${MONTHS_EN[d.getMonth()]} ${d.getDate()}`
    : `${d.getMonth() + 1}月${d.getDate()}日 ${DOW_SHORT[d.getDay()]}`;
}

export function fmtWeekday(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return getLanguage() === "en" ? DOW_LONG_EN[d.getDay()] : DOW_LONG_ZH[d.getDay()];
}

export const DOW_SHORT = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const DOW_SHORT_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function fmtDays(days: number[]): string {
  const en = getLanguage() === "en";
  if (days.length === 7) return en ? "Every day" : "每天";
  if ([1, 2, 3, 4, 5].every((d) => days.includes(d)) && days.length === 5)
    return en ? "Weekdays" : "工作日";
  return days.map((d) => (en ? DOW_SHORT_EN : DOW_SHORT)[d]).join(" · ");
}

export function fahrenheitToCelsius(value: number): number {
  return Math.round((value - 32) * 5 / 9);
}

export function fmtTempF(value: number): string {
  return getLanguage() === "en" ? `${Math.round(value)}°F` : `${fahrenheitToCelsius(value)}°C`;
}
import { getLanguage } from "./language";
