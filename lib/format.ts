export function fmtTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function fmtWindow(w: { start: string; end: string }): string {
  return `${fmtTime(w.start)}–${fmtTime(w.end)}`;
}

export function fmtDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("zh-CN", { weekday: "short", month: "long", day: "numeric" });
}

export function fmtWeekday(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("zh-CN", { weekday: "long" });
}

export const DOW_SHORT = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export function fmtDays(days: number[]): string {
  if (days.length === 7) return "每天";
  if ([1, 2, 3, 4, 5].every((d) => days.includes(d)) && days.length === 5)
    return "工作日";
  return days.map((d) => DOW_SHORT[d]).join(" · ");
}

export function fahrenheitToCelsius(value: number): number {
  return Math.round((value - 32) * 5 / 9);
}

export function fmtTempF(value: number): string {
  return `${fahrenheitToCelsius(value)}°C`;
}
