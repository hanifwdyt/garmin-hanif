import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const LTHR = 170; // estimated lactate threshold HR

function hrTSS(durationSec: number, avgHr: number): number {
  const if_ = avgHr / LTHR;
  return (durationSec * if_ * if_ * 100) / 3600;
}

export async function GET() {
  const db = getDb();

  // ── 1. All activities for TSS computation (365 day seed) ────
  const allActs = db.prepare(`
    SELECT date, duration_seconds, avg_hr
    FROM activities
    WHERE date >= date('now', '-365 days')
      AND avg_hr IS NOT NULL AND avg_hr > 0
      AND duration_seconds IS NOT NULL AND duration_seconds > 60
    ORDER BY date ASC
  `).all() as Array<{ date: string; duration_seconds: number; avg_hr: number }>;

  const dailyTSS = new Map<string, number>();
  for (const a of allActs) {
    const tss = hrTSS(a.duration_seconds, a.avg_hr);
    dailyTSS.set(a.date, (dailyTSS.get(a.date) ?? 0) + tss);
  }

  // ── 2. CTL/ATL/TSB EWMA (output last 90 days) ───────────────
  let ctl = 0, atl = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const seedStart = new Date(today);
  seedStart.setDate(seedStart.getDate() - 365);

  const fitnessHistory: Array<{ date: string; ctl: number; atl: number; tsb: number; tss: number }> = [];
  const cur = new Date(seedStart);

  while (cur <= today) {
    const d = cur.toISOString().split("T")[0];
    const tss = dailyTSS.get(d) ?? 0;
    ctl = ctl + (tss - ctl) / 42;
    atl = atl + (tss - atl) / 7;
    const daysAgo = Math.round((today.getTime() - cur.getTime()) / 86400000);
    if (daysAgo <= 90) {
      fitnessHistory.push({
        date: d,
        ctl: Math.round(ctl * 10) / 10,
        atl: Math.round(atl * 10) / 10,
        tsb: Math.round((ctl - atl) * 10) / 10,
        tss: Math.round(tss * 10) / 10,
      });
    }
    cur.setDate(cur.getDate() + 1);
  }

  // ── 3. Wellness Trend (30 days) ──────────────────────────────
  const wellnessTrend = db.prepare(`
    SELECT date, hrv_last_night, resting_hr, sleep_score, body_battery_morning, stress_avg
    FROM health
    WHERE date >= date('now', '-30 days')
    ORDER BY date ASC
  `).all() as Array<{
    date: string;
    hrv_last_night: number | null;
    resting_hr: number | null;
    sleep_score: number | null;
    body_battery_morning: number | null;
    stress_avg: number | null;
  }>;

  // ── 4. Pace Curves from splits ───────────────────────────────
  const runsWithSplits = db.prepare(`
    SELECT a.activity_id, a.date, a.name, d.splits_json
    FROM activities a
    JOIN activity_details d ON d.activity_id = a.activity_id
    WHERE (a.activity_type LIKE '%run%' OR a.activity_type LIKE '%Run%')
      AND d.splits_json IS NOT NULL
      AND a.date >= date('now', '-365 days')
    ORDER BY a.date ASC
  `).all() as Array<{ activity_id: string; date: string; name: string; splits_json: string }>;

  type SplitItem = { distance?: number; duration?: number; movingDuration?: number; averageHR?: number };
  const CURVE_KM = [1, 2, 3, 5, 10, 21];
  const bestPaces: Record<number, { pace_sec_per_km: number; date: string } | null> = {};
  CURVE_KM.forEach(k => { bestPaces[k] = null; });

  for (const run of runsWithSplits) {
    let splits: SplitItem[] = [];
    try { splits = JSON.parse(run.splits_json); } catch { continue; }
    if (!splits?.length) continue;

    for (const targetKm of CURVE_KM) {
      for (let i = 0; i < splits.length; i++) {
        let totalDist = 0, totalTime = 0, j = i;
        while (j < splits.length && totalDist < targetKm * 1000) {
          totalDist += splits[j].distance ?? 0;
          totalTime += splits[j].duration ?? splits[j].movingDuration ?? 0;
          j++;
        }
        if (totalDist >= targetKm * 900 && totalTime > 0) {
          const pace = totalTime / (totalDist / 1000);
          if (!bestPaces[targetKm] || pace < bestPaces[targetKm]!.pace_sec_per_km) {
            bestPaces[targetKm] = { pace_sec_per_km: Math.round(pace), date: run.date };
          }
        }
      }
    }
  }

  // ── 5. Yearly Progress + Eddington ──────────────────────────
  const yearStart = `${today.getFullYear()}-01-01`;
  const yearlyRuns = db.prepare(`
    SELECT date, distance_meters, strftime('%Y-%m', date) as month
    FROM activities
    WHERE date >= ? AND (activity_type LIKE '%run%' OR activity_type LIKE '%Run%') AND distance_meters > 0
    ORDER BY date ASC
  `).all(yearStart) as Array<{ date: string; distance_meters: number; month: string }>;

  const monthMap = new Map<string, { km: number; runs: number }>();
  for (const r of yearlyRuns) {
    const e = monthMap.get(r.month) ?? { km: 0, runs: 0 };
    e.km += r.distance_meters / 1000;
    e.runs += 1;
    monthMap.set(r.month, e);
  }
  const months = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, km: Math.round(v.km * 10) / 10, runs: v.runs }));

  const allRunDays = db.prepare(`
    SELECT date, SUM(distance_meters) / 1000.0 as km
    FROM activities
    WHERE (activity_type LIKE '%run%' OR activity_type LIKE '%Run%') AND distance_meters > 0
    GROUP BY date ORDER BY km DESC
  `).all() as Array<{ date: string; km: number }>;

  let eddington = 0;
  for (let e = 1; e <= 200; e++) {
    if (allRunDays.filter(d => d.km >= e).length >= e) eddington = e;
    else break;
  }

  // ── 6. Run Decoupling ────────────────────────────────────────
  const decouplingRuns: Array<{ activity_id: string; date: string; name: string; decoupling_pct: number }> = [];

  for (const run of runsWithSplits.slice(-30)) {
    let splits: SplitItem[] = [];
    try { splits = JSON.parse(run.splits_json); } catch { continue; }
    if (splits.length < 4) continue;

    const half = Math.floor(splits.length / 2);
    const calcPaHR = (s: SplitItem[]) => {
      const dist = s.reduce((sum, x) => sum + (x.distance ?? 0), 0);
      const dur = s.reduce((sum, x) => sum + (x.duration ?? x.movingDuration ?? 0), 0);
      const withHR = s.filter(x => x.averageHR && x.averageHR > 0);
      const avgHR = withHR.length ? withHR.reduce((sum, x) => sum + x.averageHR!, 0) / withHR.length : 0;
      if (!dist || !dur || !avgHR) return null;
      return (dur / (dist / 1000)) / avgHR;
    };

    const ph1 = calcPaHR(splits.slice(0, half));
    const ph2 = calcPaHR(splits.slice(half));
    if (!ph1 || !ph2) continue;
    decouplingRuns.push({
      activity_id: run.activity_id,
      date: run.date,
      name: run.name || "Run",
      decoupling_pct: Math.round(((ph2 - ph1) / ph1) * 1000) / 10,
    });
  }

  // ── 7. Zone Distribution by Week ────────────────────────────
  const zoneByWeek = db.prepare(`
    SELECT strftime('%Y-W%W', a.date) as week,
      SUM(COALESCE(d.hr_zone_1_seconds, 0)) as z1,
      SUM(COALESCE(d.hr_zone_2_seconds, 0)) as z2,
      SUM(COALESCE(d.hr_zone_3_seconds, 0)) as z3,
      SUM(COALESCE(d.hr_zone_4_seconds, 0)) as z4,
      SUM(COALESCE(d.hr_zone_5_seconds, 0)) as z5
    FROM activities a
    JOIN activity_details d ON d.activity_id = a.activity_id
    WHERE a.date >= date('now', '-56 days')
    GROUP BY week ORDER BY week ASC
  `).all() as Array<{ week: string; z1: number; z2: number; z3: number; z4: number; z5: number }>;

  // ── 8. Training Monotony & Strain (12 weeks) ────────────────
  const weeklyTSSMap = new Map<string, number[]>();
  const twelveWksAgo = new Date(today);
  twelveWksAgo.setDate(twelveWksAgo.getDate() - 84);

  for (const [dateStr, tss] of dailyTSS.entries()) {
    if (new Date(dateStr + "T00:00:00") < twelveWksAgo) continue;
    // Use strftime equivalent: week number from year start / 7
    const d = new Date(dateStr + "T00:00:00");
    const soy = new Date(d.getFullYear(), 0, 1);
    const doy = Math.floor((d.getTime() - soy.getTime()) / 86400000);
    const wk = `${d.getFullYear()}-W${String(Math.floor(doy / 7)).padStart(2, "0")}`;
    if (!weeklyTSSMap.has(wk)) weeklyTSSMap.set(wk, []);
    weeklyTSSMap.get(wk)!.push(tss);
  }

  const monotonyStrain = Array.from(weeklyTSSMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, vals]) => {
      const total = vals.reduce((s, v) => s + v, 0);
      const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
      const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
      const stddev = Math.sqrt(variance);
      const monotony = stddev > 0 ? Math.round((mean / stddev) * 100) / 100 : 1;
      return {
        week,
        tss: Math.round(total * 10) / 10,
        monotony,
        strain: Math.round(total * monotony * 10) / 10,
      };
    });

  // ── 9. Week Comparison ───────────────────────────────────────
  const twStats = db.prepare(`
    SELECT COUNT(*) as runs, COALESCE(SUM(distance_meters)/1000.0, 0) as km,
           COALESCE(SUM(duration_seconds), 0) as duration_sec,
           AVG(CASE WHEN avg_hr > 0 THEN avg_hr END) as avg_hr
    FROM activities
    WHERE date >= date('now', '-7 days')
      AND (activity_type LIKE '%run%' OR activity_type LIKE '%Run%')
  `).get() as { runs: number; km: number; duration_sec: number; avg_hr: number | null };

  const lwStats = db.prepare(`
    SELECT COUNT(*) as runs, COALESCE(SUM(distance_meters)/1000.0, 0) as km,
           COALESCE(SUM(duration_seconds), 0) as duration_sec,
           AVG(CASE WHEN avg_hr > 0 THEN avg_hr END) as avg_hr
    FROM activities
    WHERE date >= date('now', '-14 days') AND date < date('now', '-7 days')
      AND (activity_type LIKE '%run%' OR activity_type LIKE '%Run%')
  `).get() as { runs: number; km: number; duration_sec: number; avg_hr: number | null };

  return NextResponse.json({
    fitnessHistory,
    wellnessTrend,
    paceCurves: bestPaces,
    yearlyProgress: {
      months,
      eddington,
      totalKm: Math.round(yearlyRuns.reduce((s, r) => s + r.distance_meters / 1000, 0) * 10) / 10,
      totalRuns: yearlyRuns.length,
    },
    runDecoupling: decouplingRuns.reverse(),
    zoneDistribution: zoneByWeek,
    monotonyStrain,
    weekComparison: {
      thisWeek: { km: Math.round((twStats?.km ?? 0) * 10) / 10, runs: twStats?.runs ?? 0, duration_sec: twStats?.duration_sec ?? 0, avg_hr: twStats?.avg_hr ? Math.round(twStats.avg_hr) : null },
      lastWeek: { km: Math.round((lwStats?.km ?? 0) * 10) / 10, runs: lwStats?.runs ?? 0, duration_sec: lwStats?.duration_sec ?? 0, avg_hr: lwStats?.avg_hr ? Math.round(lwStats.avg_hr) : null },
    },
  });
}
