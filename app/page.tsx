"use client";

import { useEffect, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import {
  formatDuration, formatDistance, activityEmoji,
  readinessLabel, hrZoneColor, getRaceCountdown, MAF_HR,
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

function ReadinessRing({ score }: { score: number }) {
  const { label, color, ring } = readinessLabel(score);
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-32 h-32">
        <svg className="w-32 h-32 -rotate-90" viewBox="0 0 128 128">
          <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
          <circle
            cx="64" cy="64" r={r} fill="none"
            stroke={ring} strokeWidth="10"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 1s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold ${color}`}>{score}</span>
          <span className="text-xs text-white/40">/ 100</span>
        </div>
      </div>
      <span className={`text-sm font-semibold tracking-widest ${color}`}>{label}</span>
    </div>
  );
}

function MetricCard({
  icon, label, value, sub, accent,
}: {
  icon: string; label: string; value: string; sub?: string; accent?: string;
}) {
  return (
    <div className="card p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-white/40 text-xs font-medium uppercase tracking-wider">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div className={`text-2xl font-bold ${accent || "text-white"}`}>{value}</div>
      {sub && <div className="text-xs text-white/40">{sub}</div>}
    </div>
  );
}

function ActivityRow({ a }: { a: Activity }) {
  const emoji = activityEmoji(a.activity_type);
  const isRun = (a.activity_type || "").toLowerCase().includes("run");
  const hrColor = a.avg_hr ? hrZoneColor(a.avg_hr) : "text-white/60";
  const hrIcon = a.avg_hr
    ? a.avg_hr <= MAF_HR ? "✅" : a.avg_hr <= MAF_HR + 8 ? "⚠️" : "❌"
    : "";

  return (
    <div className="flex items-center gap-3 py-3 border-b border-white/5 last:border-0">
      <div className="text-2xl w-8 text-center">{emoji}</div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{a.name || a.activity_type}</div>
        <div className="text-xs text-white/40">{a.date} · {a.start_time_local}</div>
      </div>
      <div className="text-right shrink-0">
        {a.distance_meters && (
          <div className="text-sm font-semibold">{formatDistance(a.distance_meters)}</div>
        )}
        {a.duration_seconds && (
          <div className="text-xs text-white/40">{formatDuration(a.duration_seconds)}</div>
        )}
      </div>
      {isRun && a.avg_hr && (
        <div className={`text-sm font-medium w-12 text-right ${hrColor}`}>
          {hrIcon} {a.avg_hr}
        </div>
      )}
    </div>
  );
}

function Countdown() {
  const [countdown, setCountdown] = useState(getRaceCountdown());
  useEffect(() => {
    const t = setInterval(() => setCountdown(getRaceCountdown()), 60000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex gap-4 items-baseline">
      <div className="text-center">
        <div className="text-4xl font-black text-white leading-none">{countdown.days}</div>
        <div className="text-xs text-white/40 mt-1">HARI</div>
      </div>
      <div className="text-2xl text-white/20 font-thin">:</div>
      <div className="text-center">
        <div className="text-4xl font-black text-white leading-none">{countdown.hours}</div>
        <div className="text-xs text-white/40 mt-1">JAM</div>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a2e] border border-white/10 rounded-lg px-3 py-2 text-xs">
      <div className="text-white/60 mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="text-white font-medium">{p.value} {p.name === "run_km" ? "km" : ""}</div>
      ))}
    </div>
  );
};

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
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const h = data?.todayHealth;
  const recentRuns = data?.activities.filter(a => (a.activity_type || "").toLowerCase().includes("run")) || [];
  const lastRun = recentRuns[0];
  const readiness = data?.readiness;

  const sleepHours = h?.sleep_duration_seconds ? (h.sleep_duration_seconds / 3600).toFixed(1) : null;
  const sleepColor = h?.sleep_score
    ? h.sleep_score >= 80 ? "text-emerald-400" : h.sleep_score >= 65 ? "text-yellow-400" : "text-red-400"
    : "text-white";
  const bbColor = h?.body_battery_morning
    ? h.body_battery_morning >= 75 ? "text-emerald-400" : h.body_battery_morning >= 45 ? "text-yellow-400" : "text-red-400"
    : "text-white";

  const chartData = (data?.healthHistory || []).map(d => ({
    date: d.date?.slice(5),
    hrv: d.hrv_last_night,
    sleep: d.sleep_score,
    battery: d.body_battery_morning,
    steps: d.steps ? Math.round(d.steps / 1000) : null,
  }));

  const weeklyData = data?.weeklyMileage || [];

  return (
    <div className="min-h-screen px-4 py-6 max-w-2xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl font-bold">Training Dashboard</h1>
          <p className="text-xs text-white/40">Hanif · Garmin Forerunner 165</p>
        </div>
        <div className="text-xs text-white/30 text-right">
          {new Date().toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })}
        </div>
      </div>

      {/* Hero: Race Countdown + Readiness */}
      <div className="card-highlight p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-white/40 uppercase tracking-wider mb-2">🏁 Half Marathon Monas</div>
            <Countdown />
            <div className="mt-2 text-xs text-white/30">13 Juni 2026 · Target sub 2:45</div>
          </div>
          <div className="flex flex-col items-center">
            {readiness != null ? (
              <ReadinessRing score={readiness} />
            ) : (
              <div className="text-white/20 text-sm text-center">
                <div className="text-4xl mb-1">📡</div>
                <div>Belum ada data</div>
              </div>
            )}
            <div className="text-xs text-white/30 mt-1">Readiness hari ini</div>
          </div>
        </div>
      </div>

      {/* Health Grid */}
      {h && (
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            icon="😴" label="Sleep"
            value={h.sleep_score ? String(h.sleep_score) : "—"}
            sub={sleepHours ? `${sleepHours}h · ${h.sleep_start || ""}–${h.sleep_end || ""}` : undefined}
            accent={sleepColor}
          />
          <MetricCard
            icon="💚" label="HRV"
            value={h.hrv_last_night ? String(Math.round(h.hrv_last_night)) : "—"}
            sub={h.hrv_weekly_avg ? `Avg 7hr: ${Math.round(h.hrv_weekly_avg)} · ${h.hrv_status || ""}` : h.hrv_status || undefined}
            accent={h.hrv_status?.toLowerCase().includes("balanced") ? "text-emerald-400" : "text-yellow-400"}
          />
          <MetricCard
            icon="🔋" label="Body Battery"
            value={h.body_battery_morning ? `${h.body_battery_morning}` : "—"}
            sub={h.body_battery_evening ? `Sore: ${h.body_battery_evening}` : undefined}
            accent={bbColor}
          />
          <MetricCard
            icon="❤️" label="Resting HR"
            value={h.resting_hr ? `${h.resting_hr} bpm` : "—"}
            sub={h.stress_avg ? `Stress: ${h.stress_avg}` : undefined}
            accent={h.resting_hr && h.resting_hr <= 60 ? "text-emerald-400" : "text-white"}
          />
          {h.steps && (
            <MetricCard
              icon="👟" label="Steps"
              value={h.steps.toLocaleString("id-ID")}
              sub={h.calories_active ? `${h.calories_active} kcal aktif` : undefined}
            />
          )}
        </div>
      )}

      {!h && (
        <div className="card p-6 text-center text-white/30">
          <div className="text-3xl mb-2">📡</div>
          <div className="text-sm">Belum ada data kesehatan</div>
          <div className="text-xs mt-1">Tunggu sync berikutnya</div>
        </div>
      )}

      {/* Last Run */}
      {lastRun && (
        <div className="card p-4">
          <div className="text-xs text-white/40 uppercase tracking-wider mb-3">🏃 Lari Terakhir</div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-semibold">{lastRun.name || "Run"}</div>
              <div className="text-xs text-white/40 mt-0.5">{lastRun.date} · {lastRun.start_time_local}</div>
              <div className="flex gap-4 mt-3">
                {lastRun.distance_meters && (
                  <div>
                    <div className="text-lg font-bold">{formatDistance(lastRun.distance_meters)}</div>
                    <div className="text-xs text-white/40">Jarak</div>
                  </div>
                )}
                {lastRun.duration_seconds && (
                  <div>
                    <div className="text-lg font-bold">{formatDuration(lastRun.duration_seconds)}</div>
                    <div className="text-xs text-white/40">Durasi</div>
                  </div>
                )}
                {lastRun.avg_pace_min_per_km && (
                  <div>
                    <div className="text-lg font-bold">{lastRun.avg_pace_min_per_km}</div>
                    <div className="text-xs text-white/40">Pace/km</div>
                  </div>
                )}
              </div>
            </div>
            {lastRun.avg_hr && (
              <div className="text-right shrink-0">
                <div className={`text-2xl font-bold ${hrZoneColor(lastRun.avg_hr)}`}>{lastRun.avg_hr}</div>
                <div className="text-xs text-white/40">bpm avg</div>
                <div className="text-xs mt-1 text-white/30">MAF: {MAF_HR}</div>
              </div>
            )}
          </div>
          {lastRun.avg_hr && (
            <div className={`mt-3 text-xs px-3 py-2 rounded-lg ${
              lastRun.avg_hr <= MAF_HR
                ? "bg-emerald-500/10 text-emerald-300"
                : lastRun.avg_hr <= MAF_HR + 8
                ? "bg-yellow-500/10 text-yellow-300"
                : "bg-red-500/10 text-red-300"
            }`}>
              {lastRun.avg_hr <= MAF_HR
                ? "✅ MAF zone terjaga. Aerobic base building on track."
                : lastRun.avg_hr <= MAF_HR + 8
                ? `⚠️ HR ${lastRun.avg_hr - MAF_HR} bpm di atas MAF. Mulai lebih pelan di km awal.`
                : `❌ HR rata-rata ${lastRun.avg_hr - MAF_HR} bpm di atas MAF. Pastikan recovery cukup.`
              }
            </div>
          )}
        </div>
      )}

      {/* Weekly Mileage Chart */}
      {weeklyData.length > 0 && (
        <div className="card p-4">
          <div className="text-xs text-white/40 uppercase tracking-wider mb-3">📊 Volume Lari Mingguan (km)</div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={weeklyData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }} />
              <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="run_km" fill="#34d399" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* HRV + Sleep Trend */}
      {chartData.length > 1 && (
        <div className="card p-4">
          <div className="text-xs text-white/40 uppercase tracking-wider mb-3">📈 Trend 14 Hari — HRV & Sleep</div>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gHrv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gSleep" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }} />
              <YAxis tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="hrv" stroke="#a78bfa" fill="url(#gHrv)" strokeWidth={2} dot={false} name="HRV" />
              <Area type="monotone" dataKey="sleep" stroke="#38bdf8" fill="url(#gSleep)" strokeWidth={2} dot={false} name="Sleep" />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-1 text-xs text-white/40">
              <div className="w-3 h-0.5 bg-violet-400 rounded" /> HRV
            </div>
            <div className="flex items-center gap-1 text-xs text-white/40">
              <div className="w-3 h-0.5 bg-sky-400 rounded" /> Sleep Score
            </div>
          </div>
        </div>
      )}

      {/* Recent Activities Feed */}
      {(data?.activities || []).length > 0 && (
        <div className="card p-4">
          <div className="text-xs text-white/40 uppercase tracking-wider mb-2">⚡ Aktivitas Terbaru</div>
          {data!.activities.slice(0, 8).map((a) => (
            <ActivityRow key={a.activity_id} a={a} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {(data?.activities || []).length === 0 && !h && (
        <div className="card p-10 text-center">
          <div className="text-5xl mb-4">🏃</div>
          <div className="text-white/60 font-medium">Belum ada data Garmin</div>
          <div className="text-white/30 text-sm mt-2">Data akan muncul setelah sync pertama berjalan</div>
        </div>
      )}

      <div className="text-center text-xs text-white/20 py-4">
        Garmin Forerunner 165 · Auto-sync tiap 2 jam
      </div>
    </div>
  );
}
