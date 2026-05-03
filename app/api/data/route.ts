import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { computeReadinessScore } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();

  const activities = db.prepare(`
    SELECT * FROM activities ORDER BY date DESC, start_time_local DESC LIMIT 20
  `).all();

  const todayHealth = db.prepare(`
    SELECT * FROM health ORDER BY date DESC LIMIT 1
  `).get() as Record<string, unknown> | undefined;

  const healthHistory = db.prepare(`
    SELECT date, sleep_score, hrv_last_night, hrv_weekly_avg, body_battery_morning,
           resting_hr, steps, stress_avg, sleep_duration_seconds
    FROM health ORDER BY date DESC LIMIT 14
  `).all() as Record<string, unknown>[];

  // Weekly mileage (last 8 weeks)
  const weeklyMileage = db.prepare(`
    SELECT
      strftime('%Y-W%W', date) as week,
      ROUND(SUM(CASE WHEN activity_type LIKE '%run%' OR activity_type LIKE '%Run%'
                     THEN distance_meters / 1000.0 ELSE 0 END), 1) as run_km,
      COUNT(CASE WHEN activity_type LIKE '%run%' OR activity_type LIKE '%Run%' THEN 1 END) as run_count
    FROM activities
    WHERE date >= date('now', '-56 days')
    GROUP BY week
    ORDER BY week ASC
  `).all();

  const readiness = todayHealth ? computeReadinessScore(todayHealth as Parameters<typeof computeReadinessScore>[0]) : null;

  return NextResponse.json({
    activities,
    todayHealth: todayHealth || null,
    healthHistory: healthHistory.reverse(),
    weeklyMileage,
    readiness,
  });
}
