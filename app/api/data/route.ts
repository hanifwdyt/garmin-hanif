import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { computeReadinessScore } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();

  // Activities joined with details (for runs)
  const activities = db.prepare(`
    SELECT a.*, d.hr_zone_1_seconds, d.hr_zone_2_seconds, d.hr_zone_3_seconds,
           d.hr_zone_4_seconds, d.hr_zone_5_seconds,
           d.weather_temp_c, d.weather_apparent_temp_c, d.weather_humidity_pct,
           d.weather_wind_kph, d.weather_conditions, d.splits_json
    FROM activities a
    LEFT JOIN activity_details d ON d.activity_id = a.activity_id
    ORDER BY a.date DESC, a.start_time_local DESC LIMIT 20
  `).all();

  const todayHealth = db.prepare(`
    SELECT * FROM health ORDER BY date DESC LIMIT 1
  `).get() as Record<string, unknown> | undefined;

  const healthHistory = db.prepare(`
    SELECT date, sleep_score, hrv_last_night, hrv_weekly_avg, body_battery_morning,
           resting_hr, steps, stress_avg, sleep_duration_seconds,
           training_readiness_score, training_readiness_level,
           spo2_avg, respiration_avg
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

  // Latest fitness metrics
  const fitnessMetrics = db.prepare(`
    SELECT * FROM fitness_metrics ORDER BY date DESC LIMIT 1
  `).get() as Record<string, unknown> | undefined;

  // VO2 Max history (last 30 days)
  const vo2History = db.prepare(`
    SELECT date, vo2_max_running FROM fitness_metrics
    WHERE vo2_max_running IS NOT NULL
    ORDER BY date DESC LIMIT 30
  `).all() as Array<{ date: string; vo2_max_running: number }>;

  // Latest race predictions
  const racePredictions = db.prepare(`
    SELECT * FROM race_predictions ORDER BY date DESC LIMIT 1
  `).get() as Record<string, unknown> | undefined;

  // Garmin's official readiness preferred; fallback to computed
  let readiness: number | null = null;
  let readinessSource: "garmin" | "computed" = "computed";
  if (todayHealth) {
    const garminScore = todayHealth.training_readiness_score;
    if (typeof garminScore === "number") {
      readiness = garminScore;
      readinessSource = "garmin";
    } else {
      readiness = computeReadinessScore(todayHealth as Parameters<typeof computeReadinessScore>[0]);
    }
  }

  return NextResponse.json({
    activities,
    todayHealth: todayHealth || null,
    healthHistory: healthHistory.reverse(),
    weeklyMileage,
    fitnessMetrics: fitnessMetrics || null,
    vo2History: vo2History.reverse(),
    racePredictions: racePredictions || null,
    readiness,
    readinessSource,
  });
}
