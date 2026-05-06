"use client";

import { formatDuration, HR_ZONE_COLORS, HR_ZONE_LABELS } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────

export interface AnalyticsData {
  fitnessHistory: Array<{ date: string; ctl: number; atl: number; tsb: number; tss: number }>;
  wellnessTrend: Array<{
    date: string;
    hrv_last_night: number | null;
    resting_hr: number | null;
    sleep_score: number | null;
    body_battery_morning: number | null;
    stress_avg: number | null;
  }>;
  paceCurves: Record<number, { pace_sec_per_km: number; date: string } | null>;
  yearlyProgress: {
    months: Array<{ month: string; km: number; runs: number }>;
    eddington: number;
    totalKm: number;
    totalRuns: number;
  };
  runDecoupling: Array<{ activity_id: string; date: string; name: string; decoupling_pct: number }>;
  zoneDistribution: Array<{ week: string; z1: number; z2: number; z3: number; z4: number; z5: number }>;
  monotonyStrain: Array<{ week: string; tss: number; monotony: number; strain: number }>;
  weekComparison: {
    thisWeek: { km: number; runs: number; duration_sec: number; avg_hr: number | null };
    lastWeek: { km: number; runs: number; duration_sec: number; avg_hr: number | null };
  };
}

// ── Helpers ────────────────────────────────────────────────────

function formatPaceSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function shortMonth(ym: string): string {
  const [, m] = ym.split("-");
  return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m, 10) - 1] ?? m;
}

function shortWeek(w: string): string {
  return w.replace(/^\d{4}-W/, "W");
}

// ── Mini SVG sparkline ─────────────────────────────────────────

function Sparkline({
  values, color = "var(--accent)", height = 28, showDot = true,
}: {
  values: (number | null)[];
  color?: string;
  height?: number;
  showDot?: boolean;
}) {
  const valid = values.filter((v): v is number => v != null);
  if (valid.length < 2) return null;
  const minV = Math.min(...valid);
  const maxV = Math.max(...valid);
  const range = maxV - minV || 1;
  const W = 80;
  const H = height;
  const pts = values
    .map((v, i) => {
      if (v == null) return null;
      const x = (i / (values.length - 1)) * W;
      const y = H - ((v - minV) / range) * (H - 4) - 2;
      return `${x},${y}`;
    })
    .filter(Boolean)
    .join(" ");

  const lastValid = values.reduceRight<number | null>((acc, v) => acc ?? v, null);
  const lastIdx = values.reduceRight<number>((acc, v, i) => (acc === -1 && v != null ? i : acc), -1);
  const dotX = (lastIdx / (values.length - 1)) * W;
  const dotY = lastValid != null ? H - ((lastValid - minV) / range) * (H - 4) - 2 : H / 2;

  return (
    <svg width={W} height={H} style={{ overflow: "visible" }}>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeOpacity="0.7"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {showDot && lastValid != null && (
        <circle cx={dotX} cy={dotY} r="2.5" fill={color} />
      )}
    </svg>
  );
}

// ── 1. Fitness-Fatigue Chart ───────────────────────────────────

export function FitnessFatigueChart({ data }: { data: AnalyticsData["fitnessHistory"] }) {
  if (!data.length) return null;

  const W = 600, H = 140, PAD = { top: 12, right: 8, bottom: 28, left: 36 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const ctlVals = data.map(d => d.ctl);
  const atlVals = data.map(d => d.atl);
  const tsbVals = data.map(d => d.tsb);
  const allVals = [...ctlVals, ...atlVals, ...tsbVals];
  const yMin = Math.min(...allVals, -5);
  const yMax = Math.max(...allVals, 5);
  const yRange = yMax - yMin || 1;

  const xScale = (i: number) => PAD.left + (i / (data.length - 1)) * innerW;
  const yScale = (v: number) => PAD.top + ((yMax - v) / yRange) * innerH;
  const y0 = yScale(0);

  const toPolyline = (vals: number[]) =>
    vals.map((v, i) => `${xScale(i)},${yScale(v)}`).join(" ");

  // TSB area path (fill above/below 0)
  const tsbAreaPositive = data
    .map((d, i) => ({ x: xScale(i), y: yScale(d.tsb), v: d.tsb }));
  const posPath = tsbAreaPositive
    .map((p, i) => (i === 0 ? `M${p.x},${Math.min(p.y, y0)}` : `L${p.x},${Math.min(p.y, y0)}`))
    .join(" ") + ` L${xScale(data.length - 1)},${y0} L${xScale(0)},${y0} Z`;
  const negPath = tsbAreaPositive
    .map((p, i) => (i === 0 ? `M${p.x},${Math.max(p.y, y0)}` : `L${p.x},${Math.max(p.y, y0)}`))
    .join(" ") + ` L${xScale(data.length - 1)},${y0} L${xScale(0)},${y0} Z`;

  // Y axis ticks
  const yTicks = [];
  const tickStep = Math.ceil(yRange / 4);
  for (let v = Math.ceil(yMin / tickStep) * tickStep; v <= yMax; v += tickStep) {
    yTicks.push(v);
  }

  // X axis labels (every ~2 weeks)
  const xLabels: Array<{ i: number; label: string }> = [];
  data.forEach((d, i) => {
    if (i % 14 === 0 || i === data.length - 1) {
      const parts = d.date.split("-");
      xLabels.push({ i, label: `${parts[1]}/${parts[2]}` });
    }
  });

  const last = data[data.length - 1];
  const tsbColor = last.tsb >= 0 ? "var(--green)" : "var(--red)";

  return (
    <div>
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mb-3">
        {[
          { color: "#6366f1", label: "CTL (Fitness)", val: `${last.ctl.toFixed(1)}` },
          { color: "#f97316", label: "ATL (Fatigue)", val: `${last.atl.toFixed(1)}` },
          { color: last.tsb >= 0 ? "#22c55e" : "#ef4444", label: "TSB (Form)", val: `${last.tsb >= 0 ? "+" : ""}${last.tsb.toFixed(1)}` },
        ].map(({ color, label, val }) => (
          <div key={label} className="flex items-center gap-1.5" style={{ fontSize: 11 }}>
            <span className="inline-block rounded-full flex-shrink-0" style={{ width: 8, height: 8, background: color }} />
            <span style={{ color: "var(--text-secondary)" }}>{label}</span>
            <span className="font-semibold tabular" style={{ color }}>{val}</span>
          </div>
        ))}
      </div>

      <div style={{ width: "100%", overflowX: "auto" }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: "100%", minWidth: 320, height: "auto", display: "block" }}
        >
          {/* Grid lines */}
          {yTicks.map(v => (
            <g key={v}>
              <line
                x1={PAD.left} y1={yScale(v)}
                x2={W - PAD.right} y2={yScale(v)}
                stroke="rgba(255,255,255,0.05)" strokeWidth="1"
              />
              <text
                x={PAD.left - 4} y={yScale(v) + 3.5}
                textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.3)"
              >{v}</text>
            </g>
          ))}

          {/* Zero line */}
          <line
            x1={PAD.left} y1={y0}
            x2={W - PAD.right} y2={y0}
            stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="3,3"
          />

          {/* TSB fill areas */}
          <path d={posPath} fill="rgba(34,197,94,0.12)" />
          <path d={negPath} fill="rgba(239,68,68,0.12)" />

          {/* ATL line */}
          <polyline
            points={toPolyline(atlVals)}
            fill="none" stroke="#f97316" strokeWidth="1.5"
            strokeOpacity="0.85" strokeLinejoin="round"
          />

          {/* CTL line */}
          <polyline
            points={toPolyline(ctlVals)}
            fill="none" stroke="#6366f1" strokeWidth="2"
            strokeOpacity="0.9" strokeLinejoin="round"
          />

          {/* TSB line */}
          <polyline
            points={toPolyline(tsbVals)}
            fill="none" stroke={tsbColor} strokeWidth="1.5"
            strokeOpacity="0.8" strokeLinejoin="round"
          />

          {/* End dots */}
          <circle cx={xScale(data.length - 1)} cy={yScale(last.ctl)} r="3" fill="#6366f1" />
          <circle cx={xScale(data.length - 1)} cy={yScale(last.atl)} r="3" fill="#f97316" />
          <circle cx={xScale(data.length - 1)} cy={yScale(last.tsb)} r="3" fill={tsbColor} />

          {/* X axis labels */}
          {xLabels.map(({ i, label }) => (
            <text
              key={i}
              x={xScale(i)} y={H - 4}
              textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.3)"
            >{label}</text>
          ))}
        </svg>
      </div>

      {/* Form interpretation */}
      <div className="mt-3 text-xs" style={{ color: "var(--text-tertiary)" }}>
        {last.tsb > 10
          ? "Fresh & ready — optimal window for quality sessions or racing"
          : last.tsb >= -10
          ? "Balanced — training load manageable, consistency is key"
          : last.tsb >= -25
          ? "Accumulating fatigue — prioritize recovery between sessions"
          : "High fatigue — schedule rest before next quality effort"}
      </div>
    </div>
  );
}

// ── 2. Wellness Trend Sparklines ──────────────────────────────

export function WellnessTrendSparklines({ data }: { data: AnalyticsData["wellnessTrend"] }) {
  if (!data.length) return null;

  const metrics: Array<{
    label: string;
    unit: string;
    color: string;
    key: keyof typeof data[0];
    higherIsBetter: boolean;
  }> = [
    { label: "HRV", unit: "ms", color: "#818cf8", key: "hrv_last_night", higherIsBetter: true },
    { label: "RHR", unit: "bpm", color: "#fb7185", key: "resting_hr", higherIsBetter: false },
    { label: "Sleep", unit: "/100", color: "#34d399", key: "sleep_score", higherIsBetter: true },
    { label: "Battery", unit: "/100", color: "#fbbf24", key: "body_battery_morning", higherIsBetter: true },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
      {metrics.map(({ label, unit, color, key, higherIsBetter }) => {
        const vals = data.map(d => d[key] as number | null);
        const valid = vals.filter((v): v is number => v != null);
        const latest = valid[valid.length - 1];
        const prev7 = valid.slice(-8, -1);
        const avg7 = prev7.length ? prev7.reduce((s, v) => s + v, 0) / prev7.length : null;
        const trend = latest != null && avg7 != null
          ? ((latest - avg7) / avg7) * 100
          : null;
        const trendUp = trend != null && trend > 2;
        const trendDown = trend != null && trend < -2;
        const trendColor = trendUp
          ? (higherIsBetter ? "var(--green)" : "var(--red)")
          : trendDown
          ? (higherIsBetter ? "var(--red)" : "var(--green)")
          : "var(--text-tertiary)";

        return (
          <div
            key={label}
            className="p-3 rounded-xl"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="label" style={{ fontSize: 10 }}>{label}</span>
              {trend != null && (
                <span style={{ fontSize: 10, color: trendColor }}>
                  {trendUp ? "↑" : trendDown ? "↓" : "→"} {Math.abs(trend).toFixed(1)}%
                </span>
              )}
            </div>
            <div className="flex items-end justify-between gap-2">
              <div>
                <div className="text-xl font-semibold tabular tracking-tight" style={{ color, letterSpacing: "-0.02em" }}>
                  {latest != null ? (Number.isInteger(latest) ? latest : latest.toFixed(0)) : "—"}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{unit}</div>
              </div>
              <Sparkline values={vals} color={color} height={28} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 3. Pace Curves Chart ──────────────────────────────────────

const PACE_KM = [1, 2, 3, 5, 10, 21];
const PACE_LABELS: Record<number, string> = {
  1: "1 km", 2: "2 km", 3: "3 km", 5: "5 km", 10: "10 km", 21: "Half",
};

export function PaceCurvesChart({ data }: { data: AnalyticsData["paceCurves"] }) {
  const entries = PACE_KM.map(k => ({ km: k, best: data[k] }));
  const hasSome = entries.some(e => e.best);
  if (!hasSome) return (
    <div className="text-sm text-center py-6" style={{ color: "var(--text-muted)" }}>
      No split data available yet — sync more runs with GPS
    </div>
  );

  // Wider pace = slower = bigger number = longer bar (inverted for display)
  // Best pace (fastest) = shortest bar doesn't make sense visually.
  // Instead: bar represents HOW FAST relative to slowest. Faster = longer bar.
  const validPaces = entries.filter(e => e.best).map(e => e.best!.pace_sec_per_km);
  const maxPace = Math.max(...validPaces);
  const minPace = Math.min(...validPaces);
  const paceRange = maxPace - minPace || 1;

  return (
    <div className="space-y-3">
      {entries.map(({ km, best }) => (
        <div key={km} className="flex items-center gap-3">
          <div className="w-10 flex-shrink-0 text-right label" style={{ fontSize: 10 }}>
            {PACE_LABELS[km]}
          </div>
          <div className="flex-1 relative h-8">
            <div className="absolute inset-0 rounded" style={{ background: "rgba(255,255,255,0.03)" }} />
            {best && (
              <div
                className="absolute left-0 top-0 bottom-0 rounded flex items-center"
                style={{
                  width: `${Math.max(8, ((maxPace - best.pace_sec_per_km) / paceRange) * 60 + 40)}%`,
                  background: "linear-gradient(90deg, rgba(99,102,241,0.15) 0%, rgba(99,102,241,0.45) 100%)",
                  borderRight: "2px solid rgba(99,102,241,0.6)",
                }}
              />
            )}
          </div>
          <div className="w-20 flex-shrink-0 tabular text-right">
            {best ? (
              <>
                <div className="text-sm font-semibold">{formatPaceSec(best.pace_sec_per_km)}/km</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{best.date.slice(5)}</div>
              </>
            ) : (
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>—</span>
            )}
          </div>
        </div>
      ))}
      <div className="text-xs pt-1" style={{ color: "var(--text-tertiary)" }}>
        Best continuous pace per distance · all time
      </div>
    </div>
  );
}

// ── 4. Yearly Progress ────────────────────────────────────────

export function YearlyProgressChart({ data }: { data: AnalyticsData["yearlyProgress"] }) {
  const { months, eddington, totalKm, totalRuns } = data;
  if (!months.length && !totalKm) return null;

  const maxKm = Math.max(...months.map(m => m.km), 20);
  const currentMonth = new Date().toISOString().slice(0, 7);

  // Fill missing months
  const year = new Date().getFullYear();
  const allMonths: Array<{ month: string; km: number; runs: number }> = [];
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, "0")}`;
    allMonths.push(months.find(x => x.month === key) ?? { month: key, km: 0, runs: 0 });
  }

  return (
    <div>
      {/* Summary row */}
      <div className="flex items-center gap-6 mb-4">
        <div>
          <div className="label" style={{ fontSize: 10 }}>Total {year}</div>
          <div className="text-2xl font-semibold tabular mt-1" style={{ letterSpacing: "-0.02em" }}>
            {totalKm.toFixed(0)} <span className="text-sm font-normal" style={{ color: "var(--text-tertiary)" }}>km</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{totalRuns} runs</div>
        </div>
        <div
          className="px-4 py-3 rounded-xl flex flex-col items-center"
          style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)" }}
        >
          <div className="label" style={{ fontSize: 10 }}>Eddington</div>
          <div
            className="text-3xl font-semibold tabular mt-1"
            style={{ letterSpacing: "-0.03em", color: "#a5b4fc" }}
          >
            {eddington || "—"}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>E number</div>
        </div>
        {eddington > 0 && (
          <div className="text-xs flex-1" style={{ color: "var(--text-tertiary)" }}>
            You've run {eddington}+ km on {eddington}+ days.
            Next: {eddington + 1}+ km on {eddington + 1}+ days.
          </div>
        )}
      </div>

      {/* Monthly bars */}
      <div className="flex items-end gap-1 sm:gap-1.5" style={{ height: 72 }}>
        {allMonths.map(({ month, km, runs }) => {
          const pct = maxKm > 0 ? (km / maxKm) * 100 : 0;
          const isCurrent = month === currentMonth;
          const isPast = month < currentMonth;
          return (
            <div key={month} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="w-full rounded-t relative" style={{ height: 60 }}>
                <div className="absolute inset-0 rounded" style={{ background: "rgba(255,255,255,0.03)" }} />
                {km > 0 && (
                  <div
                    className="absolute bottom-0 left-0 right-0 rounded-t transition-all"
                    style={{
                      height: `${Math.max(pct, 4)}%`,
                      background: isCurrent
                        ? "linear-gradient(180deg, rgba(99,102,241,0.6) 0%, rgba(99,102,241,0.3) 100%)"
                        : isPast
                        ? "rgba(255,255,255,0.1)"
                        : "rgba(255,255,255,0.05)",
                      borderTop: isCurrent ? "1px solid rgba(99,102,241,0.8)" : "none",
                    }}
                    title={`${shortMonth(month)}: ${km} km, ${runs} runs`}
                  />
                )}
              </div>
              <div style={{ fontSize: 9, color: isCurrent ? "var(--accent)" : "var(--text-muted)" }}>
                {shortMonth(month)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 5. Decoupling List ────────────────────────────────────────

function decouplingTone(pct: number): string {
  if (pct <= 5) return "var(--green)";
  if (pct <= 10) return "var(--yellow)";
  return "var(--red)";
}

function decouplingLabel(pct: number): string {
  if (pct <= 5) return "Aerobic";
  if (pct <= 10) return "Moderate drift";
  return "High drift";
}

export function DecouplingList({ data }: { data: AnalyticsData["runDecoupling"] }) {
  const recent = data.slice(0, 10);
  if (!recent.length) return (
    <div className="text-sm text-center py-6" style={{ color: "var(--text-muted)" }}>
      Decoupling needs runs with HR data per split
    </div>
  );

  const absMax = Math.max(...recent.map(d => Math.abs(d.decoupling_pct)), 15);

  return (
    <div>
      <div className="text-xs mb-3" style={{ color: "var(--text-tertiary)" }}>
        Aerobic decoupling = pace:HR ratio drift between first half and second half.
        Under 5% = efficient aerobic base.
      </div>
      <div className="space-y-2">
        {recent.map(d => {
          const color = decouplingTone(Math.abs(d.decoupling_pct));
          const barPct = (Math.abs(d.decoupling_pct) / absMax) * 100;
          return (
            <div key={d.activity_id} className="flex items-center gap-3">
              <div className="w-12 flex-shrink-0 text-xs tabular" style={{ color: "var(--text-muted)" }}>
                {d.date.slice(5)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{d.name}</div>
                <div className="mt-1 relative h-4">
                  <div className="absolute inset-0 rounded" style={{ background: "rgba(255,255,255,0.03)" }} />
                  <div
                    className="absolute left-0 top-0 bottom-0 rounded"
                    style={{
                      width: `${Math.max(barPct, 4)}%`,
                      background: `${color}25`,
                      borderRight: `2px solid ${color}`,
                    }}
                  />
                </div>
              </div>
              <div className="w-20 flex-shrink-0 text-right">
                <div className="text-sm font-semibold tabular" style={{ color }}>
                  {d.decoupling_pct >= 0 ? "+" : ""}{d.decoupling_pct.toFixed(1)}%
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  {decouplingLabel(Math.abs(d.decoupling_pct))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 6. Zone Distribution Heatmap ─────────────────────────────

export function ZoneHeatmap({ data }: { data: AnalyticsData["zoneDistribution"] }) {
  if (!data.length) return (
    <div className="text-sm text-center py-6" style={{ color: "var(--text-muted)" }}>
      No HR zone data recorded yet
    </div>
  );

  return (
    <div>
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {HR_ZONE_LABELS.map((label, i) => (
          <div key={i} className="flex items-center gap-1.5" style={{ fontSize: 11 }}>
            <span className="inline-block rounded-sm flex-shrink-0" style={{ width: 10, height: 10, background: HR_ZONE_COLORS[i] }} />
            <span style={{ color: "var(--text-secondary)" }}>{label}</span>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {data.map(w => {
          const total = w.z1 + w.z2 + w.z3 + w.z4 + w.z5;
          if (!total) return null;
          const zones = [w.z1, w.z2, w.z3, w.z4, w.z5];
          return (
            <div key={w.week} className="flex items-center gap-3">
              <div className="w-12 flex-shrink-0 label text-right" style={{ fontSize: 10 }}>
                {shortWeek(w.week)}
              </div>
              <div className="flex-1 flex rounded overflow-hidden" style={{ height: 20 }}>
                {zones.map((z, i) => {
                  const pct = (z / total) * 100;
                  if (!pct) return null;
                  return (
                    <div
                      key={i}
                      style={{ width: `${pct}%`, background: HR_ZONE_COLORS[i] }}
                      title={`${HR_ZONE_LABELS[i]}: ${formatDuration(z)} (${pct.toFixed(0)}%)`}
                    />
                  );
                })}
              </div>
              <div className="w-14 flex-shrink-0 text-right tabular text-xs" style={{ color: "var(--text-tertiary)" }}>
                {formatDuration(total)}
              </div>
            </div>
          );
        }).filter(Boolean)}
      </div>

      {/* Zone 1+2 percentage insight */}
      {(() => {
        const last = data[data.length - 1];
        if (!last) return null;
        const total = last.z1 + last.z2 + last.z3 + last.z4 + last.z5;
        const easy = last.z1 + last.z2;
        const easyPct = total ? Math.round((easy / total) * 100) : 0;
        return (
          <div className="mt-3 text-xs" style={{ color: "var(--text-tertiary)" }}>
            Last week: <span style={{ color: easyPct >= 80 ? "var(--green)" : easyPct >= 65 ? "var(--yellow)" : "var(--red)" }}>
              {easyPct}% easy
            </span>
            {easyPct >= 80
              ? " — 80/20 polarized distribution, optimal for endurance development"
              : easyPct >= 65
              ? " — approaching ideal. Aim for 80%+ in zones 1–2"
              : " — too much intensity. More easy miles needed for aerobic base"}
          </div>
        );
      })()}
    </div>
  );
}

// ── 7. Monotony & Strain ─────────────────────────────────────

export function MonotonyStrainChart({ data }: { data: AnalyticsData["monotonyStrain"] }) {
  if (!data.length) return null;
  const recent = data.slice(-8);

  const maxStrain = Math.max(...recent.map(d => d.strain), 100);
  const maxTSS = Math.max(...recent.map(d => d.tss), 50);

  return (
    <div>
      <div className="text-xs mb-3" style={{ color: "var(--text-tertiary)" }}>
        Monotony = avg daily load / stddev — higher means less variation (risky).
        Strain = weekly TSS × monotony. Monotony &gt;2 = overtraining risk.
      </div>
      <div className="space-y-3">
        {recent.map(w => {
          const isHighMonotony = w.monotony > 2;
          const strainPct = (w.strain / maxStrain) * 100;
          const tssPct = (w.tss / maxTSS) * 100;
          return (
            <div key={w.week}>
              <div className="flex items-center justify-between mb-1">
                <span className="label" style={{ fontSize: 10 }}>{shortWeek(w.week)}</span>
                <div className="flex items-center gap-3 text-xs tabular">
                  <span style={{ color: "var(--text-tertiary)" }}>TSS {w.tss.toFixed(0)}</span>
                  <span style={{ color: isHighMonotony ? "var(--red)" : "var(--text-secondary)" }}>
                    M {w.monotony.toFixed(2)}
                  </span>
                  <span style={{ color: "var(--text-secondary)" }}>Strain {w.strain.toFixed(0)}</span>
                </div>
              </div>
              <div className="relative h-4">
                <div className="absolute inset-0 rounded" style={{ background: "rgba(255,255,255,0.03)" }} />
                <div
                  className="absolute left-0 top-0 bottom-0 rounded"
                  style={{
                    width: `${Math.max(strainPct, 2)}%`,
                    background: isHighMonotony
                      ? "linear-gradient(90deg, rgba(239,68,68,0.15) 0%, rgba(239,68,68,0.4) 100%)"
                      : "linear-gradient(90deg, rgba(99,102,241,0.12) 0%, rgba(99,102,241,0.35) 100%)",
                    borderRight: `2px solid ${isHighMonotony ? "var(--red)" : "var(--accent)"}`,
                  }}
                />
                <div
                  className="absolute left-0 top-1 bottom-1 rounded"
                  style={{
                    width: `${Math.max(tssPct, 2)}%`,
                    background: "rgba(255,255,255,0.07)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 8. Week Comparison ────────────────────────────────────────

export function WeekComparison({ data }: { data: AnalyticsData["weekComparison"] }) {
  const { thisWeek, lastWeek } = data;

  const Delta = ({ curr, prev, unit = "" }: { curr: number; prev: number; unit?: string }) => {
    if (!prev && !curr) return <span style={{ color: "var(--text-muted)" }}>—</span>;
    const diff = curr - prev;
    const pct = prev > 0 ? (diff / prev) * 100 : 0;
    const color = diff > 0 ? "var(--green)" : diff < 0 ? "var(--red)" : "var(--text-muted)";
    return (
      <span style={{ fontSize: 11, color }}>
        {diff >= 0 ? "+" : ""}{unit === "km" ? diff.toFixed(1) : Math.round(diff)}{unit}
        {prev > 0 && <span style={{ color: "var(--text-muted)" }}> ({pct >= 0 ? "+" : ""}{pct.toFixed(0)}%)</span>}
      </span>
    );
  };

  const rows = [
    {
      label: "Distance",
      curr: thisWeek.km,
      prev: lastWeek.km,
      fmt: (v: number) => `${v.toFixed(1)} km`,
      unit: "km",
    },
    {
      label: "Runs",
      curr: thisWeek.runs,
      prev: lastWeek.runs,
      fmt: (v: number) => `${v}×`,
      unit: "",
    },
    {
      label: "Time",
      curr: thisWeek.duration_sec,
      prev: lastWeek.duration_sec,
      fmt: (v: number) => v ? formatDuration(v) : "—",
      unit: "s",
    },
    {
      label: "Avg HR",
      curr: thisWeek.avg_hr ?? 0,
      prev: lastWeek.avg_hr ?? 0,
      fmt: (v: number) => v ? `${v} bpm` : "—",
      unit: "bpm",
    },
  ];

  return (
    <div>
      {/* Column headers */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        <div className="label" style={{ fontSize: 10 }}>Metric</div>
        <div className="label text-center" style={{ fontSize: 10 }}>This week</div>
        <div className="label text-center" style={{ fontSize: 10 }}>Last week</div>
        <div className="label text-center" style={{ fontSize: 10 }}>Δ</div>
      </div>
      <div className="space-y-0">
        {rows.map(({ label, curr, prev, fmt, unit }, i) => (
          <div
            key={label}
            className="grid grid-cols-4 gap-2 py-2.5"
            style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}
          >
            <div className="text-sm" style={{ color: "var(--text-secondary)" }}>{label}</div>
            <div className="text-sm font-semibold tabular text-center">{fmt(curr)}</div>
            <div className="text-sm tabular text-center" style={{ color: "var(--text-tertiary)" }}>{fmt(prev)}</div>
            <div className="text-center tabular">
              <Delta curr={unit === "s" ? Math.round(curr / 60) : curr} prev={unit === "s" ? Math.round(prev / 60) : prev} unit={unit === "km" ? "km" : unit === "bpm" ? "bpm" : ""} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Analytics Dashboard ───────────────────────────────────

interface Props {
  data: AnalyticsData | null;
  loading: boolean;
}

export default function AnalyticsDashboard({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="panel p-4 sm:p-6">
            <div
              className="animate-pulse rounded"
              style={{ height: 120, background: "rgba(255,255,255,0.04)" }}
            />
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const hasWellness = data.wellnessTrend.length > 1;
  const hasFitness = data.fitnessHistory.some(d => d.ctl > 0 || d.atl > 0);
  const hasDecoupling = data.runDecoupling.length > 0;
  const hasZones = data.zoneDistribution.some(w => w.z1 + w.z2 + w.z3 + w.z4 + w.z5 > 0);
  const hasMonotony = data.monotonyStrain.length > 0;
  const hasYearly = data.yearlyProgress.totalRuns > 0;

  return (
    <div className="space-y-4 sm:space-y-6">

      {/* Section divider */}
      <div className="flex items-center gap-3 px-1">
        <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
        <span className="label" style={{ fontSize: 10, color: "var(--text-muted)" }}>ANALYTICS</span>
        <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
      </div>

      {/* ── Fitness-Fatigue (CTL/ATL/TSB) ── */}
      <section className="panel p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <span className="label">Fitness-Fatigue · 90 days</span>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
              hrTSS-based · LTHR 170 bpm est.
            </div>
          </div>
          {hasFitness && (() => {
            const last = data.fitnessHistory[data.fitnessHistory.length - 1];
            return (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg" style={{
                background: last.tsb >= 0 ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                border: `1px solid ${last.tsb >= 0 ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
              }}>
                <span className="text-xs font-medium tabular" style={{ color: last.tsb >= 0 ? "var(--green)" : "var(--red)" }}>
                  TSB {last.tsb >= 0 ? "+" : ""}{last.tsb.toFixed(1)}
                </span>
              </div>
            );
          })()}
        </div>
        {hasFitness
          ? <FitnessFatigueChart data={data.fitnessHistory} />
          : <div className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
              Not enough activity data with heart rate — sync more runs
            </div>
        }
      </section>

      {/* ── Week Comparison ── */}
      <section className="panel p-4 sm:p-6">
        <div className="label mb-4">This Week vs Last Week</div>
        <WeekComparison data={data.weekComparison} />
      </section>

      {/* ── Wellness Trend ── */}
      {hasWellness && (
        <section className="panel p-4 sm:p-6">
          <div className="label mb-4">Wellness Trend · 30 days</div>
          <WellnessTrendSparklines data={data.wellnessTrend} />
        </section>
      )}

      {/* ── Pace Curves ── */}
      <section className="panel p-4 sm:p-6">
        <div className="label mb-4">Best Pace Curves</div>
        <PaceCurvesChart data={data.paceCurves} />
      </section>

      {/* ── Yearly Progress + Eddington ── */}
      {hasYearly && (
        <section className="panel p-4 sm:p-6">
          <div className="label mb-4">Yearly Progress · {new Date().getFullYear()}</div>
          <YearlyProgressChart data={data.yearlyProgress} />
        </section>
      )}

      {/* ── Zone Distribution ── */}
      {hasZones && (
        <section className="panel p-4 sm:p-6">
          <div className="label mb-4">HR Zone Distribution · 8 weeks</div>
          <ZoneHeatmap data={data.zoneDistribution} />
        </section>
      )}

      {/* ── Aerobic Decoupling ── */}
      {hasDecoupling && (
        <section className="panel p-4 sm:p-6">
          <div className="label mb-4">Aerobic Decoupling · Recent Runs</div>
          <DecouplingList data={data.runDecoupling} />
        </section>
      )}

      {/* ── Training Monotony & Strain ── */}
      {hasMonotony && (
        <section className="panel p-4 sm:p-6">
          <div className="label mb-4">Training Monotony & Strain · 12 weeks</div>
          <MonotonyStrainChart data={data.monotonyStrain} />
        </section>
      )}
    </div>
  );
}
