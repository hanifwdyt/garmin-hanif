export const MAF_HR = 153;
export const RACE_DATE = new Date("2026-06-13T05:00:00+07:00");

export function getRaceCountdown(): { days: number; hours: number; minutes: number } {
  const now = new Date();
  const diff = RACE_DATE.getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return { days, hours, minutes };
}

export function computeReadinessScore(h: {
  sleep_score?: number | null;
  hrv_last_night?: number | null;
  hrv_weekly_avg?: number | null;
  body_battery_morning?: number | null;
  resting_hr?: number | null;
}): number {
  let score = 65;
  if (h.sleep_score != null) {
    if (h.sleep_score >= 80) score += 15;
    else if (h.sleep_score >= 65) score += 5;
    else score -= 15;
  }
  if (h.hrv_last_night != null && h.hrv_weekly_avg != null && h.hrv_weekly_avg > 0) {
    const ratio = h.hrv_last_night / h.hrv_weekly_avg;
    if (ratio >= 1.0) score += 12;
    else if (ratio < 0.85) score -= 15;
  }
  if (h.body_battery_morning != null) {
    if (h.body_battery_morning >= 75) score += 10;
    else if (h.body_battery_morning < 50) score -= 10;
  }
  if (h.resting_hr != null) {
    if (h.resting_hr <= 62) score += 5;
    else if (h.resting_hr > 70) score -= 10;
  }
  return Math.max(0, Math.min(100, score));
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatDistance(meters: number): string {
  return `${(meters / 1000).toFixed(2)}`;
}

export function activityLabel(type: string): string {
  const t = (type || "").toLowerCase();
  if (t.includes("run")) return "Running";
  if (t.includes("swim")) return "Swimming";
  if (t.includes("strength") || t.includes("gym") || t.includes("weight")) return "Strength";
  if (t.includes("cycl") || t.includes("bike")) return "Cycling";
  if (t.includes("yoga")) return "Yoga";
  if (t.includes("walk")) return "Walking";
  return type || "Activity";
}

export function readinessLabel(score: number): { label: string; tone: "good" | "warn" | "bad" } {
  if (score >= 78) return { label: "Optimal", tone: "good" };
  if (score >= 52) return { label: "Moderate", tone: "warn" };
  return { label: "Low", tone: "bad" };
}

export function toneColor(tone: "good" | "warn" | "bad" | "neutral"): string {
  if (tone === "good") return "var(--green)";
  if (tone === "warn") return "var(--yellow)";
  if (tone === "bad") return "var(--red)";
  return "var(--text-secondary)";
}

export function hrTone(hr: number): "good" | "warn" | "bad" {
  if (hr <= MAF_HR) return "good";
  if (hr <= MAF_HR + 8) return "warn";
  return "bad";
}

export function sleepTone(score: number): "good" | "warn" | "bad" {
  if (score >= 80) return "good";
  if (score >= 65) return "warn";
  return "bad";
}

export function batteryTone(v: number): "good" | "warn" | "bad" {
  if (v >= 75) return "good";
  if (v >= 45) return "warn";
  return "bad";
}

export function rhrTone(v: number): "good" | "warn" | "bad" {
  if (v <= 60) return "good";
  if (v <= 68) return "warn";
  return "bad";
}
