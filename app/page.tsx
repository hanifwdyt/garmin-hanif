"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  formatDuration, formatDistance, activityLabel,
  readinessLabel, toneColor, hrTone, sleepTone, batteryTone, rhrTone,
  getRaceCountdown, MAF_HR, formatRaceTime, formatPaceFromSeconds,
  trainingStatusTone, trainingStatusLabel, loadRatioTone, spo2Tone,
  HR_ZONE_COLORS, HR_ZONE_LABELS, HM_TARGET_SECONDS,
  formatJakartaDate, formatRelativeDate, formatRelativeTime,
  vo2MaxLabel, loadRatioLabel, emptyReasonLabel,
} from "@/lib/utils";

const ActivityShareModal = dynamic(() => import("./components/ActivityShareModal"), { ssr: false });

interface Activity {
  id: number;
  activity_id: string;
  activity_type: string;
  date: string;
  start_time_local: string;
  duration_seconds: number;
  distance_meters: number;
  avg_hr: number;
  max_hr: number;
  avg_pace_min_per_km: string;
  avg_cadence_spm: number;
  calories: number;
  elevation_gain_m: number;
  name: string;
  // activity_details (joined)
  hr_zone_1_seconds: number | null;
  hr_zone_2_seconds: number | null;
  hr_zone_3_seconds: number | null;
  hr_zone_4_seconds: number | null;
  hr_zone_5_seconds: number | null;
  weather_temp_c: number | null;
  weather_apparent_temp_c: number | null;
  weather_humidity_pct: number | null;
  weather_wind_kph: number | null;
  weather_conditions: string | null;
  splits_json: string | null;
}

interface Health {
  date: string;
  sleep_score: number;
  sleep_duration_seconds: number;
  sleep_start: string;
  sleep_end: string;
  hrv_weekly_avg: number;
  hrv_last_night: number;
  hrv_status: string;
  body_battery_morning: number;
  body_battery_evening: number;
  resting_hr: number;
  stress_avg: number;
  steps: number;
  calories_active: number;
  // new fields
  spo2_avg: number | null;
  respiration_avg: number | null;
  training_readiness_score: number | null;
  training_readiness_level: string | null;
  intensity_minutes_moderate: number | null;
  intensity_minutes_vigorous: number | null;
  intensity_minutes_weekly_moderate: number | null;
  intensity_minutes_weekly_vigorous: number | null;
  weight_kg: number | null;
  body_fat_pct: number | null;
  hydration_ml: number | null;
  hydration_goal_ml: number | null;
  floors_climbed: number | null;
}

interface FitnessMetrics {
  date: string;
  vo2_max_running: number | null;
  fitness_age: number | null;
  training_status: string | null;
  acute_load: number | null;
  chronic_load: number | null;
  load_ratio: number | null;
  hill_score: number | null;
  endurance_score: number | null;
  lactate_threshold_hr: number | null;
  lactate_threshold_pace_min_per_km: number | null;
}

interface RacePredictions {
  date: string;
  race_5k_seconds: number | null;
  race_10k_seconds: number | null;
  race_half_marathon_seconds: number | null;
  race_marathon_seconds: number | null;
}

interface DashboardData {
  activities: Activity[];
  todayHealth: Health | null;
  healthHistory: Health[];
  weeklyMileage: { week: string; run_km: number; run_count: number }[];
  readiness: number | null;
  readinessSource: "garmin" | "computed";
  fitnessMetrics: FitnessMetrics | null;
  vo2History: { date: string; vo2_max_running: number }[];
  racePredictions: RacePredictions | null;
}

// ──────────────────────────────────────────────────────────
// Primitives
// ──────────────────────────────────────────────────────────

function StatusDot({ tone }: { tone: "good" | "warn" | "bad" | "neutral" }) {
  return <span className="dot flex-shrink-0" style={{ background: toneColor(tone) }} />;
}

function Bar({ value, max, tone = "neutral", thin }: {
  value: number; max: number; tone?: "good" | "warn" | "bad" | "neutral"; thin?: boolean;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={thin ? "bar-track" : "bar-track"} style={thin ? { height: "4px" } : {}}>
      <div className="bar-fill" style={{ width: `${pct}%`, background: toneColor(tone) }} />
    </div>
  );
}

function Skeleton({ className = "", width, height = 16 }: { className?: string; width?: number | string; height?: number | string }) {
  return (
    <div
      className={`animate-pulse rounded ${className}`}
      style={{
        width: width ?? "100%",
        height: typeof height === "number" ? `${height}px` : height,
        background: "rgba(255,255,255,0.05)",
      }}
    />
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex justify-between gap-3 mb-3">
            <div className="space-y-2 flex-1">
              <Skeleton width={120} height={10} />
              <Skeleton width={180} height={26} />
              <Skeleton width={140} height={10} />
            </div>
            <div className="space-y-2">
              <Skeleton width={50} height={10} />
              <Skeleton width={100} height={14} />
            </div>
          </div>
        </div>
        {/* Hero */}
        <div className="panel-elevated p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-8">
            <div className="space-y-3">
              <Skeleton width={150} height={10} />
              <Skeleton width="100%" height={48} />
              <Skeleton width="80%" height={14} />
            </div>
            <div className="space-y-3">
              <Skeleton width={120} height={10} />
              <Skeleton width="100%" height={56} />
              <Skeleton width="100%" height={6} />
            </div>
          </div>
        </div>
        {/* 4-card metric grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {[0,1,2,3].map(i => (
            <div key={i} className="panel p-3 sm:p-5 space-y-3">
              <Skeleton width={50} height={10} />
              <Skeleton width={70} height={28} />
              <Skeleton width="100%" height={6} />
            </div>
          ))}
        </div>
        {/* Activity list */}
        <div className="panel p-4 sm:p-6 space-y-3">
          <Skeleton width={100} height={10} />
          {[0,1,2].map(i => (
            <div key={i} className="flex justify-between gap-3 py-3" style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
              <div className="space-y-2 flex-1"><Skeleton width="60%" height={14} /><Skeleton width="40%" height={10} /></div>
              <Skeleton width={60} height={14} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Countdown() {
  const [c, setC] = useState(getRaceCountdown());
  useEffect(() => {
    const t = setInterval(() => setC(getRaceCountdown()), 60000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex items-baseline gap-3 sm:gap-6 tabular">
      <div>
        <div className="text-4xl sm:text-5xl font-semibold tracking-tight" style={{ letterSpacing: "-0.04em" }}>{c.days}</div>
        <div className="label mt-1">Days</div>
      </div>
      <div className="text-xl sm:text-3xl font-light" style={{ color: "var(--text-muted)" }}>·</div>
      <div>
        <div className="text-2xl sm:text-3xl font-semibold tracking-tight" style={{ letterSpacing: "-0.03em", color: "var(--text-secondary)" }}>{String(c.hours).padStart(2, "0")}</div>
        <div className="label mt-1">Hrs</div>
      </div>
      <div>
        <div className="text-2xl sm:text-3xl font-semibold tracking-tight" style={{ letterSpacing: "-0.03em", color: "var(--text-secondary)" }}>{String(c.minutes).padStart(2, "0")}</div>
        <div className="label mt-1">Min</div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, unit, sub, tone, barValue, barMax }: {
  label: string; value: string; unit?: string; sub?: string;
  tone?: "good" | "warn" | "bad" | "neutral";
  barValue?: number; barMax?: number;
}) {
  return (
    <div className="panel p-3 sm:p-5">
      <div className="flex items-center justify-between gap-1">
        <span className="label" style={{ fontSize: "10px" }}>{label}</span>
        {tone && <StatusDot tone={tone} />}
      </div>
      <div className="mt-2 sm:mt-3 flex items-baseline gap-1 tabular">
        <span className="text-2xl sm:text-3xl font-semibold tracking-tight" style={{ letterSpacing: "-0.03em" }}>{value}</span>
        {unit && <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{unit}</span>}
      </div>
      {sub && <div className="mt-0.5 sm:mt-1 tabular truncate" style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{sub}</div>}
      {barValue != null && barMax != null && (
        <div className="mt-2 sm:mt-3"><Bar value={barValue} max={barMax} tone={tone} /></div>
      )}
    </div>
  );
}

function StatRow({ label, value, unit, sub, tone, last }: {
  label: string; value: string; unit?: string; sub?: string;
  tone?: "good" | "warn" | "bad" | "neutral"; last?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3" style={{ borderBottom: last ? "none" : "1px solid var(--border)" }}>
      <div className="flex items-center gap-2 min-w-0">
        {tone && <StatusDot tone={tone} />}
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{label}</span>
      </div>
      <div className="text-right tabular flex-shrink-0 ml-3">
        <span className="text-sm font-semibold">{value}</span>
        {unit && <span className="text-xs ml-1" style={{ color: "var(--text-tertiary)" }}>{unit}</span>}
        {sub && <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{sub}</div>}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// HR Zones bar
// ──────────────────────────────────────────────────────────

function HRZoneBar({ run }: { run: Activity }) {
  const zones = [
    run.hr_zone_1_seconds, run.hr_zone_2_seconds, run.hr_zone_3_seconds,
    run.hr_zone_4_seconds, run.hr_zone_5_seconds,
  ];
  const hasData = zones.some(z => z != null && z > 0);
  if (!hasData) return null;

  const total = zones.reduce((s: number, z) => s + (z || 0), 0);
  if (!total) return null;

  return (
    <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
      <div className="label mb-3" style={{ fontSize: "10px" }}>HR Zones</div>
      {/* Stacked bar */}
      <div className="flex rounded overflow-hidden" style={{ height: "10px" }}>
        {zones.map((z, i) => {
          const pct = ((z || 0) / total) * 100;
          if (!pct) return null;
          return (
            <div key={i} style={{ width: `${pct}%`, background: HR_ZONE_COLORS[i] }} title={`${HR_ZONE_LABELS[i]}: ${formatDuration(z || 0)}`} />
          );
        })}
      </div>
      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {zones.map((z, i) => {
          if (!z) return null;
          const pct = Math.round((z / total) * 100);
          return (
            <div key={i} className="flex items-center gap-1.5 tabular" style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
              <span className="inline-block rounded-full flex-shrink-0" style={{ width: "7px", height: "7px", background: HR_ZONE_COLORS[i] }} />
              <span style={{ color: "var(--text-secondary)" }}>{HR_ZONE_LABELS[i]}</span>
              <span>{pct}%</span>
              <span style={{ color: "var(--text-muted)" }}>({formatDuration(z)})</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Splits table
// ──────────────────────────────────────────────────────────

interface Split {
  splitNumber?: number;
  startLatitude?: number;
  startLongitude?: number;
  distance?: number;
  duration?: number;
  movingDuration?: number;
  averageSpeed?: number;
  maxSpeed?: number;
  averageHR?: number;
  maxHR?: number;
  elevationGain?: number;
  elevationLoss?: number;
}

function SplitsTable({ splitsJson }: { splitsJson: string }) {
  let splits: Split[] = [];
  try { splits = JSON.parse(splitsJson); } catch { return null; }
  if (!splits?.length) return null;

  return (
    <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
      <div className="label mb-3" style={{ fontSize: "10px" }}>Km Splits</div>
      <div style={{ overflowX: "auto", marginLeft: "-1rem", marginRight: "-1rem", paddingLeft: "1rem", paddingRight: "1rem" }}>
        <table className="w-full text-xs tabular" style={{ minWidth: "280px" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th className="text-left py-1.5 pr-3 label font-normal">km</th>
              <th className="text-right py-1.5 pr-3 label font-normal">Pace</th>
              <th className="text-right py-1.5 pr-3 label font-normal">Avg HR</th>
              <th className="text-right py-1.5 label font-normal">Elev</th>
            </tr>
          </thead>
          <tbody>
            {splits.slice(0, 15).map((s, i) => {
              const dist = s.distance || 0;
              const dur = s.duration || s.movingDuration || 0;
              const paceStr = dist && dur ? formatPaceFromSeconds(dur, dist) : "—";
              const tone = s.averageHR ? hrTone(s.averageHR) : "neutral";
              return (
                <tr key={i} style={{ borderBottom: i < splits.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <td className="py-1.5 pr-3" style={{ color: "var(--text-secondary)" }}>{i + 1}</td>
                  <td className="py-1.5 pr-3 text-right font-medium">{paceStr}</td>
                  <td className="py-1.5 pr-3 text-right" style={{ color: s.averageHR ? toneColor(tone) : "var(--text-muted)" }}>
                    {s.averageHR ? Math.round(s.averageHR) : "—"}
                  </td>
                  <td className="py-1.5 text-right" style={{ color: "var(--text-tertiary)" }}>
                    {s.elevationGain != null ? `+${Math.round(s.elevationGain)}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Activity row
// ──────────────────────────────────────────────────────────

function ActivityRow({ a, last, onShare }: { a: Activity; last?: boolean; onShare?: (a: Activity) => void }) {
  const isRun = (a.activity_type || "").toLowerCase().includes("run");
  const tone = isRun && a.avg_hr ? hrTone(a.avg_hr) : "neutral";
  const typeLabel = activityLabel(a.activity_type);
  const time = a.start_time_local ? a.start_time_local.slice(0, 5) : "";
  return (
    <div className={`group py-3 ${!last ? "border-b" : ""}`} style={{ borderColor: "var(--border)" }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{a.name || typeLabel}</div>
          <div className="text-xs mt-0.5 tabular" style={{ color: "var(--text-tertiary)" }}>
            {typeLabel}{a.date ? ` · ${a.date.slice(5)}` : ""}{time ? ` · ${time}` : ""}
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 tabular">
          {a.distance_meters ? (
            <div className="text-right">
              <div className="text-sm font-medium">{formatDistance(a.distance_meters)}<span className="text-xs ml-0.5" style={{ color: "var(--text-tertiary)" }}>km</span></div>
              {a.duration_seconds ? <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>{formatDuration(a.duration_seconds)}</div> : null}
            </div>
          ) : null}
          {isRun && a.avg_hr ? (
            <div className="flex items-center gap-1.5">
              <StatusDot tone={tone} />
              <span className="text-sm font-medium">{a.avg_hr}</span>
              <span className="text-xs hidden sm:inline" style={{ color: "var(--text-tertiary)" }}>bpm</span>
            </div>
          ) : <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>}
          {onShare && (
            <button
              onClick={() => onShare(a)}
              className="text-[11px] px-2 py-1 rounded transition-all"
              style={{
                background: "rgba(99,102,241,0.1)",
                border: "1px solid rgba(99,102,241,0.18)",
                color: "#a5b4fc",
              }}
              title="Download as image"
              aria-label="Download activity as image"
            >
              ↓
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Weekly Volume
// ──────────────────────────────────────────────────────────

function WeeklyVolume({ data }: { data: { week: string; run_km: number; run_count: number }[] }) {
  const max = Math.max(...data.map(d => d.run_km), 30);
  return (
    <div className="space-y-2">
      {data.map((d) => {
        const pct = (d.run_km / max) * 100;
        return (
          <div key={d.week} className="flex items-center gap-2 sm:gap-3">
            <div className="w-14 sm:w-16 text-xs tabular truncate flex-shrink-0" style={{ color: "var(--text-tertiary)" }}>
              {d.week.replace(/^\d{4}-/, "")}
            </div>
            <div className="flex-1 relative">
              <div className="h-6 sm:h-7 rounded" style={{ background: "rgba(255,255,255,0.03)" }}>
                <div
                  className="h-6 sm:h-7 rounded transition-all"
                  style={{
                    width: `${Math.max(pct, 3)}%`,
                    background: "linear-gradient(90deg, rgba(99,102,241,0.15) 0%, rgba(99,102,241,0.4) 100%)",
                    borderRight: d.run_km > 0 ? "2px solid var(--accent)" : "none",
                  }}
                />
              </div>
            </div>
            <div className="w-14 sm:w-16 text-right tabular flex-shrink-0">
              <div className="text-sm font-medium">{d.run_km.toFixed(1)}</div>
              <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>{d.run_count}× run</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Recovery Trend table
// ──────────────────────────────────────────────────────────

function TrendTable({ data }: { data: Health[] }) {
  const recent = data.slice(0, 7).reverse();
  return (
    <div style={{ overflowX: "auto", marginLeft: "-1rem", marginRight: "-1rem", paddingLeft: "1rem", paddingRight: "1rem" }}>
      <table className="w-full text-sm tabular" style={{ minWidth: "340px" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            <th className="text-left py-2 pr-3 label font-normal whitespace-nowrap">Date</th>
            <th className="text-right py-2 pr-3 label font-normal whitespace-nowrap">Sleep</th>
            <th className="text-right py-2 pr-3 label font-normal whitespace-nowrap">HRV</th>
            <th className="text-right py-2 pr-3 label font-normal whitespace-nowrap">Battery</th>
            <th className="text-right py-2 pr-3 label font-normal whitespace-nowrap">RHR</th>
            <th className="text-right py-2 label font-normal whitespace-nowrap">SpO₂</th>
          </tr>
        </thead>
        <tbody>
          {recent.map((d, i) => (
            <tr key={d.date} style={{ borderBottom: i < recent.length - 1 ? "1px solid var(--border)" : "none" }}>
              <td className="py-2 pr-3 text-xs whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{d.date?.slice(5)}</td>
              <td className="py-2 pr-3 text-right">
                <span style={{ color: d.sleep_score ? toneColor(sleepTone(d.sleep_score)) : "var(--text-muted)" }}>
                  {d.sleep_score ?? "—"}
                </span>
              </td>
              <td className="py-2 pr-3 text-right">{d.hrv_last_night ? Math.round(d.hrv_last_night) : "—"}</td>
              <td className="py-2 pr-3 text-right">
                <span style={{ color: d.body_battery_morning ? toneColor(batteryTone(d.body_battery_morning)) : "var(--text-muted)" }}>
                  {d.body_battery_morning ?? "—"}
                </span>
              </td>
              <td className="py-2 pr-3 text-right">{d.resting_hr ?? "—"}</td>
              <td className="py-2 text-right">
                <span style={{ color: d.spo2_avg ? toneColor(spo2Tone(d.spo2_avg)) : "var(--text-muted)" }}>
                  {d.spo2_avg ? `${Math.round(d.spo2_avg)}%` : "—"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// VO2 Max sparkline (SVG)
// ──────────────────────────────────────────────────────────

function VO2Sparkline({ data }: { data: { date: string; vo2_max_running: number }[] }) {
  if (data.length < 2) return null;
  const vals = data.map(d => d.vo2_max_running);
  const minV = Math.min(...vals) - 1;
  const maxV = Math.max(...vals) + 1;
  const W = 120, H = 32;
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * W;
    const y = H - ((v - minV) / (maxV - minV)) * H;
    return `${x},${y}`;
  }).join(" ");
  const lastY = H - ((vals[vals.length - 1] - minV) / (maxV - minV)) * H;
  return (
    <svg width={W} height={H} style={{ overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeOpacity="0.6" />
      <circle cx={W} cy={lastY} r="3" fill="var(--accent)" />
    </svg>
  );
}

// ── Font system ──────────────────────────────────────────────
type FontKey = 'inter' | 'bebas' | 'barlow' | 'oswald' | 'rajdhani';
const FONT_OPTIONS: { key: FontKey; label: string; family: string; description: string }[] = [
  { key: 'inter',    label: 'Inter',    family: 'Inter, sans-serif',            description: 'Default' },
  { key: 'bebas',    label: 'Bebas',    family: '"Bebas Neue", sans-serif',      description: 'Sport Display' },
  { key: 'barlow',   label: 'Barlow',   family: '"Barlow Condensed", sans-serif', description: 'Athletic Condensed' },
  { key: 'oswald',   label: 'Oswald',   family: 'Oswald, sans-serif',            description: 'Bold Condensed' },
  { key: 'rajdhani', label: 'Rajdhani', family: 'Rajdhani, sans-serif',          description: 'Technical' },
];

// ──────────────────────────────────────────────────────────
// Main dashboard
// ──────────────────────────────────────────────────────────

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const [showFontMenu, setShowFontMenu] = useState(false);
  const [sharingActivity, setSharingActivity] = useState<Activity | null>(null);
  const [fontKey, setFontKey] = useState<FontKey>('inter');
  const activeFontOption = FONT_OPTIONS.find(f => f.key === fontKey)!;
  const fontMenuRef = useRef<HTMLDivElement | null>(null);

  const loadData = useCallback(async (silent = false) => {
    try {
      if (!silent) setRefreshing(true);
      const r = await fetch("/api/data", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
      const d = await r.json();
      setData(d);
      setLastFetchedAt(new Date());
      setError(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const t = setInterval(() => loadData(true), 90_000);
    return () => clearInterval(t);
  }, [loadData]);

  // Close font menu on outside click
  useEffect(() => {
    if (!showFontMenu) return;
    const handler = (e: MouseEvent) => {
      if (fontMenuRef.current && !fontMenuRef.current.contains(e.target as Node)) setShowFontMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showFontMenu]);

  if (loading) return <DashboardSkeleton />;

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="panel p-6 max-w-sm text-center">
          <div className="label mb-2" style={{ color: "var(--red)" }}>Failed to load</div>
          <div className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>{error}</div>
          <button
            onClick={() => { setLoading(true); loadData(); }}
            className="text-sm px-4 py-2 rounded-lg"
            style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc" }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const h = data?.todayHealth;
  const recentRuns = data?.activities.filter(a => (a.activity_type || "").toLowerCase().includes("run")) || [];
  const lastRun = recentRuns[0] as Activity | undefined;
  const readiness = data?.readiness;
  const ready = readiness != null ? readinessLabel(readiness) : null;
  const sleepHours = h?.sleep_duration_seconds ? (h.sleep_duration_seconds / 3600).toFixed(1) : null;
  const weeklyData = data?.weeklyMileage || [];
  const fm = data?.fitnessMetrics;
  const rp = data?.racePredictions;
  const readinessSource = data?.readinessSource;

  // Intensity minutes (weekly moderate + vigorous)
  const weeklyMod = h?.intensity_minutes_weekly_moderate ?? 0;
  const weeklyVig = h?.intensity_minutes_weekly_vigorous ?? 0;
  const weeklyIntensityTotal = weeklyMod + weeklyVig * 2; // vigorous counts double
  const intensityGoal = 150; // WHO guideline

  return (
    <>
    <div className="min-h-screen" style={{ fontFamily: activeFontOption.family }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-4 sm:space-y-6">

        {/* Header */}
        <header className="pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-end justify-between gap-3 mb-3">
            <div className="min-w-0">
              <div className="label">Training Dashboard</div>
              <h1 className="text-lg sm:text-2xl font-semibold tracking-tight mt-1 truncate" style={{ letterSpacing: "-0.025em" }}>
                Hanif Widiyanto
              </h1>
              <div className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>Garmin Forerunner 165</div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="label">Today · WIB</div>
              <div className="text-xs sm:text-sm font-medium tabular mt-1">
                {formatJakartaDate(new Date())}
              </div>
              <button
                onClick={() => loadData()}
                disabled={refreshing}
                className="text-[10px] tabular mt-1 inline-flex items-center gap-1 transition-opacity"
                style={{ color: "var(--text-tertiary)", opacity: refreshing ? 0.5 : 1 }}
                title="Refresh now"
              >
                <span>Updated {lastFetchedAt ? formatRelativeTime(lastFetchedAt) : "—"}</span>
                <span style={{ display: "inline-block", transform: refreshing ? "rotate(180deg)" : "none", transition: "transform 0.4s" }}>↻</span>
              </button>
            </div>
          </div>
          {/* Font selector — dropdown */}
          <div className="flex items-center gap-2 relative" ref={fontMenuRef}>
            <span className="label" style={{ fontSize: 10 }}>Font</span>
            <button
              onClick={() => setShowFontMenu(v => !v)}
              className="py-1 px-2.5 rounded-lg text-xs transition-all inline-flex items-center gap-1.5"
              style={{
                fontFamily: activeFontOption.family,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'var(--text-secondary)',
              }}
              aria-haspopup="listbox"
              aria-expanded={showFontMenu}
            >
              <span>{activeFontOption.label}</span>
              <span style={{ color: "var(--text-muted)", fontSize: 9 }}>▾</span>
            </button>
            {showFontMenu && (
              <div
                role="listbox"
                className="absolute z-10 top-full left-12 mt-1 rounded-lg overflow-hidden"
                style={{
                  background: "rgba(20,20,24,0.96)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  backdropFilter: "blur(12px)",
                  minWidth: 180,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                }}
              >
                {FONT_OPTIONS.map(f => (
                  <button
                    key={f.key}
                    onClick={() => { setFontKey(f.key); setShowFontMenu(false); }}
                    className="w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between gap-3"
                    style={{
                      fontFamily: f.family,
                      background: fontKey === f.key ? 'rgba(244,241,236,0.06)' : 'transparent',
                      color: fontKey === f.key ? '#f0ede4' : 'var(--text-secondary)',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}
                    role="option"
                    aria-selected={fontKey === f.key}
                  >
                    <span style={{ fontWeight: fontKey === f.key ? 600 : 400 }}>{f.label}</span>
                    <span style={{ color: "var(--text-muted)", fontSize: 10, fontFamily: "Inter, sans-serif" }}>{f.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        {/* ── Race Hero ── */}
        <section className="panel-elevated p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-8">
            {/* Countdown */}
            <div>
              <div className="label">Race · Half Marathon Monas</div>
              <div className="mt-3 sm:mt-4"><Countdown /></div>
              <div className="mt-4 pt-4 flex items-center justify-between" style={{ borderTop: "1px solid var(--border)" }}>
                <div>
                  <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>Race day</div>
                  <div className="text-sm font-medium tabular mt-0.5">13 June 2026</div>
                </div>
                <div className="text-right">
                  <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>Target</div>
                  <div className="text-sm font-medium tabular mt-0.5">sub 2:45</div>
                </div>
              </div>
            </div>

            {/* Readiness */}
            <div className="border-t sm:border-t-0 pt-4 sm:pt-0" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between">
                <span className="label">
                  {readinessSource === "garmin" ? "Readiness · Garmin" : "Readiness · Computed"}
                </span>
                {ready && <StatusDot tone={ready.tone} />}
              </div>
              {readiness != null ? (
                <>
                  <div className="mt-3 flex items-baseline gap-2 tabular">
                    <span className="text-5xl font-semibold tracking-tight" style={{ letterSpacing: "-0.04em" }}>{readiness}</span>
                    <span className="text-sm" style={{ color: "var(--text-tertiary)" }}>/ 100</span>
                  </div>
                  {h?.training_readiness_level && (
                    <div className="text-sm font-medium mt-0.5" style={{ color: "var(--text-secondary)" }}>
                      {h.training_readiness_level.charAt(0) + h.training_readiness_level.slice(1).toLowerCase().replace(/_/g, " ")}
                    </div>
                  )}
                  <div className="mt-3"><Bar value={readiness} max={100} tone={ready?.tone} /></div>
                </>
              ) : (
                <div className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>No data yet</div>
              )}
            </div>
          </div>
        </section>

        {/* ── Race Predictions ── */}
        {rp && (
          <section className="panel p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <span className="label">Garmin Race Predictions</span>
              <span className="text-xs tabular flex-shrink-0" style={{ color: "var(--text-tertiary)" }}>{rp.date}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* 5K */}
              <div className="p-3 rounded" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
                <div className="label" style={{ fontSize: "10px" }}>5K</div>
                <div className="mt-1.5 text-lg sm:text-xl font-semibold tracking-tight tabular" style={{ letterSpacing: "-0.02em" }}>
                  {rp.race_5k_seconds ? formatRaceTime(rp.race_5k_seconds) : "—"}
                </div>
              </div>
              {/* 10K */}
              <div className="p-3 rounded" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
                <div className="label" style={{ fontSize: "10px" }}>10K</div>
                <div className="mt-1.5 text-lg sm:text-xl font-semibold tracking-tight tabular" style={{ letterSpacing: "-0.02em" }}>
                  {rp.race_10k_seconds ? formatRaceTime(rp.race_10k_seconds) : "—"}
                </div>
              </div>
              {/* Half Marathon — highlighted */}
              {(() => {
                const hmSec = rp.race_half_marathon_seconds;
                const onTarget = hmSec != null && hmSec <= HM_TARGET_SECONDS;
                const hmTone = hmSec == null ? "neutral" : onTarget ? "good" : "bad";
                return (
                  <div className="p-3 rounded col-span-1 sm:col-span-1" style={{
                    background: onTarget ? "rgba(34,197,94,0.07)" : hmSec ? "rgba(239,68,68,0.07)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${hmSec ? toneColor(hmTone) + "55" : "var(--border)"}`,
                  }}>
                    <div className="flex items-center justify-between">
                      <span className="label" style={{ fontSize: "10px" }}>Half Marathon</span>
                      {hmSec && <StatusDot tone={hmTone} />}
                    </div>
                    <div className="mt-1.5 text-lg sm:text-xl font-semibold tracking-tight tabular" style={{ letterSpacing: "-0.02em", color: hmSec ? toneColor(hmTone) : undefined }}>
                      {hmSec ? formatRaceTime(hmSec) : "—"}
                    </div>
                    <div className="mt-0.5 text-xs" style={{ color: "var(--text-tertiary)" }}>
                      {hmSec ? (onTarget ? `▲ ${formatRaceTime(HM_TARGET_SECONDS - hmSec)} under target` : `▼ ${formatRaceTime(hmSec - HM_TARGET_SECONDS)} over target`) : "target: 2:45"}
                    </div>
                  </div>
                );
              })()}
              {/* Marathon */}
              <div className="p-3 rounded" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
                <div className="label" style={{ fontSize: "10px" }}>Marathon</div>
                <div className="mt-1.5 text-lg sm:text-xl font-semibold tracking-tight tabular" style={{ letterSpacing: "-0.02em" }}>
                  {rp.race_marathon_seconds ? formatRaceTime(rp.race_marathon_seconds) : "—"}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Performance / Fitness Metrics ── */}
        {fm && (
          <section className="panel p-4 sm:p-6">
            <div className="label mb-4">Performance Metrics</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              {/* VO2 Max */}
              {(() => {
                const vo2 = fm.vo2_max_running;
                const vo2Q = vo2 != null ? vo2MaxLabel(vo2) : null;
                return (
                  <div className="p-3 rounded" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="label" style={{ fontSize: "10px" }}>VO₂ Max</span>
                      {data?.vo2History && data.vo2History.length > 1 && (
                        <VO2Sparkline data={data.vo2History} />
                      )}
                    </div>
                    <div className="flex items-baseline gap-1 tabular">
                      <span className="text-2xl sm:text-3xl font-semibold tracking-tight" style={{ letterSpacing: "-0.03em" }}>
                        {vo2 ? Math.round(vo2 * 10) / 10 : "—"}
                      </span>
                      {vo2 && <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>ml/kg/min</span>}
                    </div>
                    {vo2Q && (
                      <div className="mt-1 flex items-center gap-1.5 text-xs">
                        <StatusDot tone={vo2Q.tone} />
                        <span style={{ color: toneColor(vo2Q.tone) }}>{vo2Q.label}</span>
                        {fm.fitness_age && (
                          <span style={{ color: "var(--text-muted)" }}>· age {fm.fitness_age}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Training Status */}
              {fm.training_status && (
                <div className="p-3 rounded" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between">
                    <span className="label" style={{ fontSize: "10px" }}>Training Status</span>
                    <StatusDot tone={trainingStatusTone(fm.training_status)} />
                  </div>
                  <div className="mt-2 text-base font-semibold" style={{ color: toneColor(trainingStatusTone(fm.training_status)) }}>
                    {trainingStatusLabel(fm.training_status)}
                  </div>
                  {fm.load_ratio != null && (
                    <div className="mt-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
                      Load ratio {fm.load_ratio.toFixed(2)}
                    </div>
                  )}
                </div>
              )}

              {/* Acute / Chronic Load */}
              {(fm.acute_load != null || fm.chronic_load != null) && (
                <div className="p-3 rounded" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between">
                    <span className="label" style={{ fontSize: "10px" }}>Load Ratio</span>
                    {fm.load_ratio != null && <StatusDot tone={loadRatioTone(fm.load_ratio)} />}
                  </div>
                  <div className="mt-2 flex items-baseline gap-1 tabular">
                    <span className="text-2xl font-semibold tracking-tight" style={{ letterSpacing: "-0.03em" }}>
                      {fm.load_ratio ? fm.load_ratio.toFixed(2) : "—"}
                    </span>
                  </div>
                  {fm.load_ratio != null && (
                    <div className="mt-0.5 text-xs" style={{ color: toneColor(loadRatioTone(fm.load_ratio)) }}>
                      {loadRatioLabel(fm.load_ratio)}
                    </div>
                  )}
                  <div className="mt-1 flex items-center gap-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
                    <span>A {fm.acute_load ?? "—"}</span>
                    <span>C {fm.chronic_load ?? "—"}</span>
                  </div>
                  {fm.load_ratio != null && (
                    <div className="mt-2"><Bar value={fm.load_ratio} max={2} tone={loadRatioTone(fm.load_ratio)} thin /></div>
                  )}
                </div>
              )}

              {/* Hill Score */}
              {fm.hill_score != null && (
                <div className="p-3 rounded" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
                  <div className="label" style={{ fontSize: "10px" }}>Hill Score</div>
                  <div className="mt-2 flex items-baseline gap-1 tabular">
                    <span className="text-2xl font-semibold tracking-tight" style={{ letterSpacing: "-0.03em" }}>{Math.round(fm.hill_score)}</span>
                    <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>/100</span>
                  </div>
                  <div className="mt-2"><Bar value={fm.hill_score} max={100} tone="neutral" thin /></div>
                </div>
              )}

              {/* Endurance Score */}
              {fm.endurance_score != null && (
                <div className="p-3 rounded" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
                  <div className="label" style={{ fontSize: "10px" }}>Endurance Score</div>
                  <div className="mt-2 flex items-baseline gap-1 tabular">
                    <span className="text-2xl font-semibold tracking-tight" style={{ letterSpacing: "-0.03em" }}>{Math.round(fm.endurance_score)}</span>
                    <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>/100</span>
                  </div>
                  <div className="mt-2"><Bar value={fm.endurance_score} max={100} tone="neutral" thin /></div>
                </div>
              )}

              {/* Lactate Threshold */}
              {fm.lactate_threshold_hr != null && (
                <div className="p-3 rounded" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
                  <div className="label" style={{ fontSize: "10px" }}>Lactate Threshold</div>
                  <div className="mt-2 flex items-baseline gap-1 tabular">
                    <span className="text-2xl font-semibold tracking-tight" style={{ letterSpacing: "-0.03em" }}>{fm.lactate_threshold_hr}</span>
                    <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>bpm</span>
                  </div>
                  {fm.lactate_threshold_pace_min_per_km != null && (
                    <div className="mt-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
                      {formatRaceTime(fm.lactate_threshold_pace_min_per_km * 60)}/km pace
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Health Metrics ── */}
        {h && (
          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-3 px-1">
              <span className="label">Recovery · Today</span>
              <span className="text-xs tabular flex-shrink-0" style={{ color: "var(--text-tertiary)" }}>
                {formatRelativeDate(h.date)}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <MetricCard
                label="Sleep"
                value={h.sleep_score ? String(h.sleep_score) : "—"}
                unit="/100"
                sub={sleepHours ? `${sleepHours}h · ${h.sleep_start?.slice(0, 5) || ""}–${h.sleep_end?.slice(0, 5) || ""}` : undefined}
                tone={h.sleep_score ? sleepTone(h.sleep_score) : undefined}
                barValue={h.sleep_score || 0}
                barMax={100}
              />
              <MetricCard
                label="HRV"
                value={h.hrv_last_night ? String(Math.round(h.hrv_last_night)) : "—"}
                unit="ms"
                sub={h.hrv_status ? h.hrv_status : h.hrv_weekly_avg ? `7d avg ${Math.round(h.hrv_weekly_avg)}ms` : undefined}
                tone={
                  !h.hrv_last_night
                    ? undefined
                    : h.hrv_status?.toLowerCase().includes("balanced")
                    ? "good"
                    : h.hrv_status?.toLowerCase().includes("low") || h.hrv_status?.toLowerCase().includes("unbalanced")
                    ? "bad"
                    : h.hrv_weekly_avg && h.hrv_last_night >= h.hrv_weekly_avg * 0.95
                    ? "good"
                    : h.hrv_weekly_avg && h.hrv_last_night < h.hrv_weekly_avg * 0.85
                    ? "bad"
                    : "warn"
                }
              />
              <MetricCard
                label="Body Battery"
                value={h.body_battery_morning ? String(h.body_battery_morning) : "—"}
                unit="/100"
                sub={h.body_battery_evening != null ? `Eve ${h.body_battery_evening}` : undefined}
                tone={h.body_battery_morning ? batteryTone(h.body_battery_morning) : undefined}
                barValue={h.body_battery_morning || 0}
                barMax={100}
              />
              <MetricCard
                label="Resting HR"
                value={h.resting_hr ? String(h.resting_hr) : "—"}
                unit="bpm"
                sub={h.stress_avg ? `Stress ${h.stress_avg}` : undefined}
                tone={h.resting_hr ? rhrTone(h.resting_hr) : undefined}
              />
            </div>

            {/* Secondary health — SpO2, Respiration, etc */}
            <div className="panel px-4 py-1">
              {h.steps != null && (
                <StatRow label="Steps" value={h.steps.toLocaleString("en-US")} sub={h.calories_active ? `${h.calories_active} active kcal` : undefined} />
              )}
              {h.hrv_weekly_avg ? (
                <StatRow label="HRV 7-day avg" value={String(Math.round(h.hrv_weekly_avg))} unit="ms" />
              ) : null}
              {h.spo2_avg != null && (
                <StatRow label="SpO₂" value={`${Math.round(h.spo2_avg)}%`} tone={spo2Tone(h.spo2_avg)} />
              )}
              {h.respiration_avg != null && (
                <StatRow label="Respiration" value={String(Math.round(h.respiration_avg))} unit="brpm" />
              )}
              {h.floors_climbed != null && h.floors_climbed > 0 && (
                <StatRow label="Floors" value={String(h.floors_climbed)} />
              )}
              {h.weight_kg != null && (
                <StatRow
                  label="Weight"
                  value={h.weight_kg.toFixed(1)}
                  unit="kg"
                  sub={h.body_fat_pct ? `${h.body_fat_pct.toFixed(1)}% body fat` : undefined}
                />
              )}
              {h.hydration_ml != null && h.hydration_goal_ml != null && (
                <StatRow
                  label="Hydration"
                  value={`${Math.round(h.hydration_ml / 100) / 10}L`}
                  sub={`goal ${Math.round(h.hydration_goal_ml / 100) / 10}L`}
                  tone={h.hydration_ml >= h.hydration_goal_ml * 0.8 ? "good" : "warn"}
                  last
                />
              )}
            </div>

            {/* Intensity minutes */}
            {weeklyIntensityTotal > 0 && (
              <div className="panel p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className="label">Intensity Minutes · Weekly</span>
                  <span className="text-xs tabular flex-shrink-0" style={{ color: "var(--text-tertiary)" }}>goal 150</span>
                </div>
                <div className="flex items-baseline gap-2 tabular mb-3">
                  <span className="text-3xl font-semibold tracking-tight" style={{ letterSpacing: "-0.03em", color: toneColor(weeklyIntensityTotal >= intensityGoal ? "good" : weeklyIntensityTotal >= intensityGoal * 0.5 ? "warn" : "bad") }}>
                    {weeklyIntensityTotal}
                  </span>
                  <span className="text-sm" style={{ color: "var(--text-tertiary)" }}>/ {intensityGoal} min</span>
                </div>
                <Bar
                  value={weeklyIntensityTotal}
                  max={intensityGoal}
                  tone={weeklyIntensityTotal >= intensityGoal ? "good" : weeklyIntensityTotal >= intensityGoal * 0.5 ? "warn" : "bad"}
                />
                <div className="mt-2 flex items-center gap-4 text-xs" style={{ color: "var(--text-tertiary)" }}>
                  {weeklyMod > 0 && <span>Moderate {weeklyMod}min</span>}
                  {weeklyVig > 0 && <span>Vigorous {weeklyVig}min</span>}
                </div>
              </div>
            )}
          </section>
        )}

        {!h && (
          <div className="panel p-10 text-center">
            <div className="label">No health data · {emptyReasonLabel("awaiting_sync")}</div>
            <div className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
              Trigger a sync from Telegram or wait for the next scheduled sync.
            </div>
          </div>
        )}

        {/* ── Latest Run ── */}
        {lastRun && (
          <section className="panel p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <span className="label">Latest Run</span>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-xs tabular" style={{ color: "var(--text-tertiary)" }}>
                  {lastRun.date?.slice(5)}{lastRun.start_time_local ? ` · ${lastRun.start_time_local.slice(0, 5)}` : ""}
                </span>
                <button
                  onClick={() => setSharingActivity(lastRun)}
                  className="text-xs px-2.5 py-1 rounded-lg transition-all"
                  style={{
                    background: "rgba(99,102,241,0.12)",
                    border: "1px solid rgba(99,102,241,0.25)",
                    color: "#a5b4fc",
                  }}
                  title="Download as image"
                >
                  ↓ Share
                </button>
              </div>
            </div>

            <div className="text-sm font-medium mb-4 truncate" style={{ color: "var(--text-secondary)" }}>{lastRun.name || "Run"}</div>

            {/* Weather row */}
            {lastRun.weather_temp_c != null && (
              <div className="flex items-center gap-4 mb-4 text-xs" style={{ color: "var(--text-tertiary)" }}>
                <span>{lastRun.weather_temp_c.toFixed(0)}°C{lastRun.weather_apparent_temp_c != null ? ` feels ${lastRun.weather_apparent_temp_c.toFixed(0)}°C` : ""}</span>
                {lastRun.weather_humidity_pct != null && <span>Humidity {lastRun.weather_humidity_pct}%</span>}
                {lastRun.weather_wind_kph != null && <span>Wind {lastRun.weather_wind_kph.toFixed(0)} kph</span>}
                {lastRun.weather_conditions && <span style={{ color: "var(--text-secondary)" }}>{lastRun.weather_conditions}</span>}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div>
                <div className="label" style={{ fontSize: "10px" }}>Distance</div>
                <div className="mt-1.5 tabular">
                  <span className="text-2xl sm:text-3xl font-semibold tracking-tight" style={{ letterSpacing: "-0.03em" }}>
                    {lastRun.distance_meters ? formatDistance(lastRun.distance_meters) : "—"}
                  </span>
                  {lastRun.distance_meters && <span className="text-xs ml-1" style={{ color: "var(--text-tertiary)" }}>km</span>}
                </div>
              </div>
              <div>
                <div className="label" style={{ fontSize: "10px" }}>Duration</div>
                <div className="mt-1.5 text-2xl sm:text-3xl font-semibold tracking-tight tabular" style={{ letterSpacing: "-0.03em" }}>
                  {lastRun.duration_seconds ? formatDuration(lastRun.duration_seconds) : "—"}
                </div>
              </div>
              <div>
                <div className="label" style={{ fontSize: "10px" }}>Pace</div>
                <div className="mt-1.5 tabular">
                  <span className="text-2xl sm:text-3xl font-semibold tracking-tight" style={{ letterSpacing: "-0.03em" }}>
                    {lastRun.avg_pace_min_per_km || "—"}
                  </span>
                  {lastRun.avg_pace_min_per_km && <span className="text-xs ml-1" style={{ color: "var(--text-tertiary)" }}>/km</span>}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <span className="label" style={{ fontSize: "10px" }}>Avg HR</span>
                  {lastRun.avg_hr && <StatusDot tone={hrTone(lastRun.avg_hr)} />}
                </div>
                <div className="mt-1.5 tabular">
                  <span className="text-2xl sm:text-3xl font-semibold tracking-tight" style={{ letterSpacing: "-0.03em" }}>
                    {lastRun.avg_hr || "—"}
                  </span>
                  {lastRun.avg_hr && <span className="text-xs ml-1" style={{ color: "var(--text-tertiary)" }}>bpm</span>}
                </div>
              </div>
            </div>

            {/* Extra run stats row */}
            {(lastRun.avg_cadence_spm != null || lastRun.elevation_gain_m != null || lastRun.calories != null) && (
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
                {lastRun.avg_cadence_spm != null && <span>Cadence {lastRun.avg_cadence_spm} spm</span>}
                {lastRun.elevation_gain_m != null && <span>Elev +{lastRun.elevation_gain_m}m</span>}
                {lastRun.calories != null && <span>{lastRun.calories} kcal</span>}
                {lastRun.max_hr != null && <span>Max HR {lastRun.max_hr} bpm</span>}
              </div>
            )}

            {/* MAF assessment */}
            {lastRun.avg_hr && (
              <div className="mt-4 pt-4 flex items-start gap-2.5" style={{ borderTop: "1px solid var(--border)" }}>
                <StatusDot tone={hrTone(lastRun.avg_hr)} />
                <div className="text-xs sm:text-sm flex-1" style={{ color: "var(--text-secondary)" }}>
                  {lastRun.avg_hr <= MAF_HR
                    ? `MAF zone maintained. Aerobic base building on track. (${lastRun.avg_hr} ≤ ${MAF_HR} bpm)`
                    : lastRun.avg_hr <= MAF_HR + 8
                    ? `${lastRun.avg_hr - MAF_HR} bpm above MAF. Consider easier opening kilometers next session.`
                    : `${lastRun.avg_hr - MAF_HR} bpm above MAF. Verify recovery before next quality session.`}
                </div>
              </div>
            )}

            {/* HR Zones */}
            <HRZoneBar run={lastRun} />

            {/* Splits */}
            {lastRun.splits_json && <SplitsTable splitsJson={lastRun.splits_json} />}
          </section>
        )}

        {/* ── Weekly Volume ── */}
        {weeklyData.length > 0 && (
          <section className="panel p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <span className="label">Weekly Volume</span>
              <span className="text-xs tabular flex-shrink-0" style={{ color: "var(--text-tertiary)" }}>8 weeks · km</span>
            </div>
            <WeeklyVolume data={weeklyData} />
          </section>
        )}

        {/* ── Recovery Trend ── */}
        {(data?.healthHistory || []).length > 1 && (() => {
          const trendData = data!.healthHistory;
          const shown = Math.min(trendData.length, 7);
          return (
            <section className="panel p-4 sm:p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <span className="label">Recovery Trend</span>
                <span className="text-xs tabular flex-shrink-0" style={{ color: "var(--text-tertiary)" }}>
                  {shown} / 7 days
                </span>
              </div>
              <TrendTable data={trendData} />
            </section>
          );
        })()}

        {/* ── Recent Activities ── */}
        {(data?.activities || []).length > 0 && (
          <section className="panel p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3 mb-3">
              <span className="label">Recent Activities</span>
              <span className="text-xs tabular flex-shrink-0" style={{ color: "var(--text-tertiary)" }}>
                {data!.activities.length} entries
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-4 pb-2 mb-1" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex-1 label">Activity</div>
              <div className="w-24 text-right label">Distance</div>
              <div className="w-16 text-right label">Avg HR</div>
            </div>
            <div className="sm:hidden" style={{ borderBottom: "1px solid var(--border)" }} />
            {data!.activities.slice(0, 10).map((a, i, arr) => (
              <ActivityRow key={a.activity_id} a={a} last={i === arr.length - 1} onShare={setSharingActivity} />
            ))}
          </section>
        )}

        {(data?.activities || []).length === 0 && !h && (
          <div className="panel p-12 text-center">
            <div className="label">No data available</div>
            <div className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
              Data will appear after first Garmin sync completes
            </div>
          </div>
        )}

        <footer className="pt-4 flex items-center justify-between text-xs" style={{ color: "var(--text-tertiary)", borderTop: "1px solid var(--border)" }}>
          <span>On-demand sync via Telegram</span>
          <span>garmin.hanif.app</span>
        </footer>
      </div>
    </div>

    {sharingActivity && (
      <ActivityShareModal
        activity={sharingActivity}
        onClose={() => setSharingActivity(null)}
        canvasFont={activeFontOption.family}
      />
    )}
    </>
  );
}
