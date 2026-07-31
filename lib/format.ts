export function fmtTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour} ${ampm}` : `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function fmtWindow(w: { start: string; end: string }): string {
  return `${fmtTime(w.start)}–${fmtTime(w.end)}`;
}

export function fmtDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function fmtWeekday(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "long" });
}

export const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function fmtDays(days: number[]): string {
  if (days.length === 7) return "Every day";
  if ([1, 2, 3, 4, 5].every((d) => days.includes(d)) && days.length === 5)
    return "Weekdays";
  return days.map((d) => DOW_SHORT[d]).join(" · ");
}
