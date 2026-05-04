"use client";

import { useEffect, useState } from "react";
import {
  formatDuration, formatDistance, activityLabel,
  readinessLabel, toneColor, hrTone, sleepTone, batteryTone, rhrTone,
  getRaceCountdown, MAF_HR,
} from "@/lib/utils";

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
}

interface DashboardData {
  activities: Activity[];
  todayHealth: Health | null;
  healthHistory: Health[];
  weeklyMileage: { week: string; run_km: number; run_count: number }[];
  readiness: number | null;
}

function StatusDot({ tone }: { tone: "good" | "warn" | "bad" | "neutral" }) {
  return <span className="dot flex-shrink-0" style={{ background: toneColor(tone) }} />;
}

function Bar({ value, max, tone = "neutral" }: { value: number; max: number; tone?: "good" | "warn" | "bad" | "neutral" }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="bar-track">
      <div className="bar-fill" style={{ width: `${pct}%`, background: toneColor(tone) }} />
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

// Compact card for mobile 2-col grid
function MetricCard({
  label, value, unit, sub, tone, barValue, barMax,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  tone?: "good" | "warn" | "bad" | "neutral";
  barValue?: number;
  barMax?: number;
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
      {sub && (
        <div className="mt-0.5 sm:mt-1 tabular truncate" style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{sub}</div>
      )}
      {barValue != null && barMax != null && (
        <div className="mt-2 sm:mt-3"><Bar value={barValue} max={barMax} tone={tone} /></div>
      )}
    </div>
  );
}

// Inline stat row — for steps / secondary metrics
function StatRow({ label, value, unit, sub, tone }: {
  label: string; value: string; unit?: string; sub?: string; tone?: "good" | "warn" | "bad" | "neutral";
}) {
  return (
    <div className="flex items-center justify-between py-3" style={{ borderBottom: "1px solid var(--border)" }}>
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

function ActivityRow({ a, last }: { a: Activity; last?: boolean }) {
  const isRun = (a.activity_type || "").toLowerCase().includes("run");
  const tone = isRun && a.avg_hr ? hrTone(a.avg_hr) : "neutral";
  const typeLabel = activityLabel(a.activity_type);
  const time = a.start_time_local ? a.start_time_local.slice(0, 5) : "";

  return (
    <div
      className={`py-3 ${!last ? "border-b" : ""}`}
      style={{ borderColor: "var(--border)" }}
    >
      {/* Mobile layout: flex rows */}
      <div className="flex items-start justify-between gap-2">
        {/* Left: name + meta */}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{a.name || typeLabel}</div>
          <div className="text-xs mt-0.5 tabular" style={{ color: "var(--text-tertiary)" }}>
            {typeLabel}
            {a.date ? ` · ${a.date.slice(5)}` : ""}
            {time ? ` · ${time}` : ""}
          </div>
        </div>

        {/* Right: metrics inline */}
        <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0 tabular">
          {a.distance_meters ? (
            <div className="text-right">
              <div className="text-sm font-medium">{formatDistance(a.distance_meters)}<span className="text-xs ml-0.5" style={{ color: "var(--text-tertiary)" }}>km</span></div>
              {a.duration_seconds ? (
                <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>{formatDuration(a.duration_seconds)}</div>
              ) : null}
            </div>
          ) : null}
          {isRun && a.avg_hr ? (
            <div className="flex items-center gap-1.5">
              <StatusDot tone={tone} />
              <span className="text-sm font-medium">{a.avg_hr}</span>
              <span className="text-xs hidden sm:inline" style={{ color: "var(--text-tertiary)" }}>bpm</span>
            </div>
          ) : (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>
          )}
        </div>
      </div>
    </div>
  );
}

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

function TrendTable({ data }: { data: Health[] }) {
  const recent = data.slice(0, 7).reverse();
  return (
    <div style={{ overflowX: "auto", marginLeft: "-1rem", marginRight: "-1rem", paddingLeft: "1rem", paddingRight: "1rem" }}>
      <table className="w-full text-sm tabular" style={{ minWidth: "320px" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            <th className="text-left py-2 pr-3 label font-normal whitespace-nowrap">Date</th>
            <th className="text-right py-2 pr-3 label font-normal whitespace-nowrap">Sleep</th>
            <th className="text-right py-2 pr-3 label font-normal whitespace-nowrap">HRV</th>
            <th className="text-right py-2 pr-3 label font-normal whitespace-nowrap">Battery</th>
            <th className="text-right py-2 label font-normal whitespace-nowrap">RHR</th>
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
              <td className="py-2 text-right">{d.resting_hr ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/data")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xs label">Loading</div>
      </div>
    );
  }

  const h = data?.todayHealth;
  const recentRuns = data?.activities.filter(a => (a.activity_type || "").toLowerCase().includes("run")) || [];
  const lastRun = recentRuns[0];
  const readiness = data?.readiness;
  const ready = readiness != null ? readinessLabel(readiness) : null;
  const sleepHours = h?.sleep_duration_seconds ? (h.sleep_duration_seconds / 3600).toFixed(1) : null;
  const weeklyData = data?.weeklyMileage || [];

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-4 sm:space-y-6">

        {/* Header */}
        <header className="flex items-end justify-between gap-3 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="min-w-0">
            <div className="label">Training Dashboard</div>
            <h1 className="text-lg sm:text-2xl font-semibold tracking-tight mt-1 truncate" style={{ letterSpacing: "-0.025em" }}>
              Hanif Widiyanto
            </h1>
            <div className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>Garmin Forerunner 165</div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="label">Today</div>
            <div className="text-xs sm:text-sm font-medium tabular mt-1">
              {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
            </div>
          </div>
        </header>

        {/* Race Hero */}
        <section className="panel-elevated p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-8">
            {/* Countdown */}
            <div>
              <div className="label">Race · Half Marathon Monas</div>
              <div className="mt-3 sm:mt-4">
                <Countdown />
              </div>
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
                <span className="label">Readiness</span>
                {ready && <StatusDot tone={ready.tone} />}
              </div>
              {readiness != null ? (
                <>
                  <div className="mt-3 flex items-baseline gap-2 tabular">
                    <span className="text-5xl font-semibold tracking-tight" style={{ letterSpacing: "-0.04em" }}>{readiness}</span>
                    <span className="text-sm" style={{ color: "var(--text-tertiary)" }}>/ 100</span>
                  </div>
                  <div className="text-sm font-medium mt-1" style={{ color: ready ? toneColor(ready.tone) : undefined }}>
                    {ready?.label}
                  </div>
                  <div className="mt-4">
                    <Bar value={readiness} max={100} tone={ready?.tone} />
                  </div>
                </>
              ) : (
                <div className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>No data yet</div>
              )}
            </div>
          </div>
        </section>

        {/* Health Metrics */}
        {h && (
          <section className="space-y-3">
            {/* 4 main metrics — 2 col on mobile, 4 on desktop */}
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
                sub={h.hrv_status ? h.hrv_status : undefined}
                tone={h.hrv_status?.toLowerCase().includes("balanced") ? "good" : "warn"}
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

            {/* Steps + calories — full-width compact */}
            {h.steps != null && (
              <div className="panel px-4 py-1">
                <StatRow
                  label="Steps"
                  value={h.steps.toLocaleString("en-US")}
                  sub={h.calories_active ? `${h.calories_active} active kcal` : undefined}
                />
                {h.hrv_weekly_avg ? (
                  <StatRow
                    label="HRV 7-day avg"
                    value={String(Math.round(h.hrv_weekly_avg))}
                    unit="ms"
                  />
                ) : null}
              </div>
            )}
          </section>
        )}

        {!h && (
          <div className="panel p-10 text-center">
            <div className="label">No health data</div>
            <div className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
              Awaiting next sync from Garmin
            </div>
          </div>
        )}

        {/* Latest Run */}
        {lastRun && (
          <section className="panel p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <span className="label">Latest Run</span>
              <span className="text-xs tabular flex-shrink-0" style={{ color: "var(--text-tertiary)" }}>
                {lastRun.date?.slice(5)}{lastRun.start_time_local ? ` · ${lastRun.start_time_local.slice(0, 5)}` : ""}
              </span>
            </div>

            <div className="text-sm font-medium mb-4 truncate" style={{ color: "var(--text-secondary)" }}>{lastRun.name || "Run"}</div>

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
          </section>
        )}

        {/* Weekly Volume */}
        {weeklyData.length > 0 && (
          <section className="panel p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <span className="label">Weekly Volume</span>
              <span className="text-xs tabular flex-shrink-0" style={{ color: "var(--text-tertiary)" }}>8 weeks · km</span>
            </div>
            <WeeklyVolume data={weeklyData} />
          </section>
        )}

        {/* Recovery Trend */}
        {(data?.healthHistory || []).length > 1 && (
          <section className="panel p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <span className="label">Recovery Trend</span>
              <span className="text-xs tabular flex-shrink-0" style={{ color: "var(--text-tertiary)" }}>Last 7 days</span>
            </div>
            <TrendTable data={data!.healthHistory} />
          </section>
        )}

        {/* Recent Activities */}
        {(data?.activities || []).length > 0 && (
          <section className="panel p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3 mb-3">
              <span className="label">Recent Activities</span>
              <span className="text-xs tabular flex-shrink-0" style={{ color: "var(--text-tertiary)" }}>
                {data!.activities.length} entries
              </span>
            </div>
            {/* Column headers — desktop only */}
            <div className="hidden sm:flex items-center gap-4 pb-2 mb-1" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex-1 label">Activity</div>
              <div className="w-24 text-right label">Distance</div>
              <div className="w-16 text-right label">Avg HR</div>
            </div>
            {/* Mobile: simple divider */}
            <div className="sm:hidden" style={{ borderBottom: "1px solid var(--border)" }} />

            {data!.activities.slice(0, 10).map((a, i, arr) => (
              <ActivityRow key={a.activity_id} a={a} last={i === arr.length - 1} />
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
  );
}
