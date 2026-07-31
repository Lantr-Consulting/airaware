import type { Activity } from "./types";

export function addMin(hhmm: string, minutes: number): string {
  const [hh, mm] = hhmm.split(":").map(Number);
  const total = hh * 60 + mm + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function dayOfWeek(dateIso: string): number {
  return new Date(`${dateIso}T12:00:00`).getDay();
}

export function activitiesOn(
  activities: Activity[],
  dateIso: string
): { activity: Activity; start: string; end: string }[] {
  const dow = dayOfWeek(dateIso);
  return activities
    .filter((a) => a.enabled && a.daysOfWeek.includes(dow))
    .map((a) => ({
      activity: a,
      start: a.startTime,
      end: addMin(a.startTime, a.durationMin),
    }))
    .sort((a, b) => a.start.localeCompare(b.start));
}
