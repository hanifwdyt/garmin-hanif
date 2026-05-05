export const MAF_HR = 153;
export const RACE_DATE = new Date("2026-06-13T05:00:00+07:00");
export const HM_TARGET_SECONDS = 2 * 3600 + 45 * 60; // sub 2:45

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

export function formatRaceTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatDistance(meters: number): string {
  return `${(meters / 1000).toFixed(2)}`;
}

export function formatPaceFromSeconds(totalSec: number, distM: number): string {
  if (!totalSec || !distM) return "—";
  const paceSec = totalSec / (distM / 1000);
  const m = Math.floor(paceSec / 60);
  const s = Math.floor(paceSec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
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

export function readinessLevelLabel(level: string): { label: string; tone: "good" | "warn" | "bad" } {
  const l = (level || "").toUpperCase();
  if (l.includes("MAXIMUM") || l.includes("HIGH")) return { label: l.charAt(0) + l.slice(1).toLowerCase(), tone: "good" };
  if (l.includes("MODERATE")) return { label: "Moderate", tone: "warn" };
  if (l.includes("LOW") || l.includes("POOR")) return { label: l.charAt(0) + l.slice(1).toLowerCase(), tone: "bad" };
  return { label: l || "—", tone: "warn" };
}

export function trainingStatusTone(status: string | null | undefined): "good" | "warn" | "bad" | "neutral" {
  if (!status) return "neutral";
  const s = status.toUpperCase();
  if (s.includes("PRODUCTIVE") || s.includes("PEAKING")) return "good";
  if (s.includes("MAINTAINING") || s.includes("RECOVERY")) return "warn";
  if (s.includes("OVERREACHING") || s.includes("UNPRODUCTIVE") || s.includes("DETRAINING") || s.includes("STRAINED")) return "bad";
  return "neutral";
}

export function trainingStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase().replace(/_/g, " ");
}

export function loadRatioTone(ratio: number | null | undefined): "good" | "warn" | "bad" | "neutral" {
  if (ratio == null) return "neutral";
  if (ratio >= 0.8 && ratio <= 1.3) return "good";
  if (ratio >= 0.5 && ratio < 0.8) return "warn";
  if (ratio > 1.3 && ratio <= 1.5) return "warn";
  return "bad";
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

export function spo2Tone(v: number): "good" | "warn" | "bad" {
  if (v >= 95) return "good";
  if (v >= 90) return "warn";
  return "bad";
}

export const HR_ZONE_COLORS = ["#94a3b8", "#22c55e", "#3b82f6", "#f59e0b", "#ef4444"];
export const HR_ZONE_LABELS = ["Z1 Recovery", "Z2 Aerobic", "Z3 Tempo", "Z4 Threshold", "Z5 VO2 Max"];

// ── Date / time helpers ────────────────────────────────────────────────────

const JAKARTA_TZ = "Asia/Jakarta";

export function todayJakarta(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: JAKARTA_TZ });
}

export function formatJakartaDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", { timeZone: JAKARTA_TZ, day: "2-digit", month: "short", year: "numeric" });
}

/** Returns "Today" / "Yesterday" / "2 days ago" / "Mon 5 May" / full date for older */
export function formatRelativeDate(dateStr: string): string {
  if (!dateStr) return "—";
  const today = todayJakarta();
  if (dateStr === today) return "Today";
  const target = new Date(dateStr + "T00:00:00+07:00");
  const todayDate = new Date(today + "T00:00:00+07:00");
  const diffDays = Math.round((todayDate.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays <= 6) return `${diffDays} days ago`;
  if (diffDays < 0) return target.toLocaleDateString("en-GB", { timeZone: JAKARTA_TZ, weekday: "short", day: "numeric", month: "short" });
  return target.toLocaleDateString("en-GB", { timeZone: JAKARTA_TZ, weekday: "short", day: "numeric", month: "short" });
}

/** Returns "just now" / "5 min ago" / "2 hours ago" / "Yesterday 14:30" */
export function formatRelativeTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = Date.now() - date.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 30) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const days = Math.floor(hr / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

// ── Qualitative benchmark labels ────────────────────────────────────────────

/** VO2 Max benchmark for adult male (30-39). Returns label + tone. */
export function vo2MaxLabel(value: number, age = 32, sex: "M" | "F" = "M"): { label: string; tone: "good" | "warn" | "bad" } {
  if (sex === "M") {
    if (age < 30) {
      if (value >= 55) return { label: "Superior", tone: "good" };
      if (value >= 49) return { label: "Excellent", tone: "good" };
      if (value >= 43) return { label: "Good", tone: "good" };
      if (value >= 38) return { label: "Average", tone: "warn" };
      return { label: "Below avg", tone: "bad" };
    }
    if (age < 40) {
      if (value >= 53) return { label: "Superior", tone: "good" };
      if (value >= 47) return { label: "Excellent", tone: "good" };
      if (value >= 41) return { label: "Good", tone: "good" };
      if (value >= 35) return { label: "Average", tone: "warn" };
      return { label: "Below avg", tone: "bad" };
    }
    if (value >= 50) return { label: "Superior", tone: "good" };
    if (value >= 44) return { label: "Excellent", tone: "good" };
    if (value >= 38) return { label: "Good", tone: "good" };
    if (value >= 32) return { label: "Average", tone: "warn" };
    return { label: "Below avg", tone: "bad" };
  }
  // Female bands (rough)
  if (value >= 47) return { label: "Superior", tone: "good" };
  if (value >= 41) return { label: "Excellent", tone: "good" };
  if (value >= 35) return { label: "Good", tone: "good" };
  if (value >= 30) return { label: "Average", tone: "warn" };
  return { label: "Below avg", tone: "bad" };
}

/** Acute:Chronic load ratio band */
export function loadRatioLabel(ratio: number): string {
  if (ratio < 0.5) return "Detraining";
  if (ratio < 0.8) return "Undertraining";
  if (ratio <= 1.3) return "Sweet spot";
  if (ratio <= 1.5) return "Functional overreach";
  return "Overreaching";
}

/** Empty state reason mapping */
export type EmptyReason = "awaiting_sync" | "not_recorded" | "day_in_progress" | "needs_setup" | "insufficient_data";
export function emptyReasonLabel(reason: EmptyReason): string {
  const map: Record<EmptyReason, string> = {
    awaiting_sync: "Awaiting sync",
    not_recorded: "Not recorded",
    day_in_progress: "Day in progress",
    needs_setup: "Set up in Garmin Connect",
    insufficient_data: "Need more data",
  };
  return map[reason];
}
