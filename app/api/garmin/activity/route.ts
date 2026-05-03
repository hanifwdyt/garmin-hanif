import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const SECRET = process.env.MINION_SECRET || "punakawan-x-secret-2026";

function checkAuth(req: NextRequest): boolean {
  const provided = req.headers.get("x-minion-secret") || "";
  return provided === SECRET;
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body?.activity_id) return NextResponse.json({ error: "activity_id required" }, { status: 400 });

  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO activities (
      activity_id, activity_type, date, start_time_local,
      duration_seconds, distance_meters, avg_hr, max_hr,
      avg_pace_min_per_km, avg_cadence_spm, calories,
      elevation_gain_m, training_effect_aerobic, training_effect_anaerobic, name
    ) VALUES (
      @activity_id, @activity_type, @date, @start_time_local,
      @duration_seconds, @distance_meters, @avg_hr, @max_hr,
      @avg_pace_min_per_km, @avg_cadence_spm, @calories,
      @elevation_gain_m, @training_effect_aerobic, @training_effect_anaerobic, @name
    )
    ON CONFLICT(activity_id) DO UPDATE SET
      activity_type = excluded.activity_type,
      name = excluded.name,
      avg_hr = excluded.avg_hr,
      max_hr = excluded.max_hr,
      avg_pace_min_per_km = excluded.avg_pace_min_per_km
  `);

  stmt.run({
    activity_id: body.activity_id,
    activity_type: body.activity_type ?? null,
    date: body.date ?? null,
    start_time_local: body.start_time_local ?? null,
    duration_seconds: body.duration_seconds ?? null,
    distance_meters: body.distance_meters ?? null,
    avg_hr: body.avg_hr ?? null,
    max_hr: body.max_hr ?? null,
    avg_pace_min_per_km: body.avg_pace_min_per_km ?? null,
    avg_cadence_spm: body.avg_cadence_spm ?? null,
    calories: body.calories ?? null,
    elevation_gain_m: body.elevation_gain_m ?? null,
    training_effect_aerobic: body.training_effect_aerobic ?? null,
    training_effect_anaerobic: body.training_effect_anaerobic ?? null,
    name: body.name ?? null,
  });

  return NextResponse.json({ ok: true, activity_id: body.activity_id });
}
