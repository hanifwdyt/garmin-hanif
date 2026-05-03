import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const SECRET = process.env.MINION_SECRET || "";

function checkAuth(req: NextRequest): boolean {
  return (req.headers.get("x-minion-secret") || "") === SECRET;
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body?.date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const db = getDb();
  db.prepare(`
    INSERT INTO health (
      date, sleep_score, sleep_duration_seconds, sleep_start, sleep_end,
      hrv_weekly_avg, hrv_last_night, hrv_status,
      body_battery_morning, body_battery_evening,
      resting_hr, stress_avg, steps, calories_active, updated_at
    ) VALUES (
      @date, @sleep_score, @sleep_duration_seconds, @sleep_start, @sleep_end,
      @hrv_weekly_avg, @hrv_last_night, @hrv_status,
      @body_battery_morning, @body_battery_evening,
      @resting_hr, @stress_avg, @steps, @calories_active, datetime('now')
    )
    ON CONFLICT(date) DO UPDATE SET
      sleep_score = excluded.sleep_score,
      sleep_duration_seconds = excluded.sleep_duration_seconds,
      sleep_start = excluded.sleep_start,
      sleep_end = excluded.sleep_end,
      hrv_weekly_avg = excluded.hrv_weekly_avg,
      hrv_last_night = excluded.hrv_last_night,
      hrv_status = excluded.hrv_status,
      body_battery_morning = excluded.body_battery_morning,
      body_battery_evening = excluded.body_battery_evening,
      resting_hr = excluded.resting_hr,
      stress_avg = excluded.stress_avg,
      steps = excluded.steps,
      calories_active = excluded.calories_active,
      updated_at = datetime('now')
  `).run({
    date: body.date,
    sleep_score: body.sleep_score ?? null,
    sleep_duration_seconds: body.sleep_duration_seconds ?? null,
    sleep_start: body.sleep_start ?? null,
    sleep_end: body.sleep_end ?? null,
    hrv_weekly_avg: body.hrv_weekly_avg ?? null,
    hrv_last_night: body.hrv_last_night ?? null,
    hrv_status: body.hrv_status ?? null,
    body_battery_morning: body.body_battery_morning ?? null,
    body_battery_evening: body.body_battery_evening ?? null,
    resting_hr: body.resting_hr ?? null,
    stress_avg: body.stress_avg ?? null,
    steps: body.steps ?? null,
    calories_active: body.calories_active ?? null,
  });

  return NextResponse.json({ ok: true, date: body.date });
}
