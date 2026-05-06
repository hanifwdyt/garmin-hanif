import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const SECRET = process.env.MINION_SECRET || "";

function checkAuth(req: NextRequest): boolean {
  return (req.headers.get("x-minion-secret") || "") === SECRET;
}

interface HealthRow {
  date: string;
  body_battery_morning: number | null;
  body_battery_evening: number | null;
  sleep_score: number | null;
  sleep_duration_seconds: number | null;
  hrv_last_night: number | null;
  hrv_weekly_avg: number | null;
  resting_hr: number | null;
  stress_avg: number | null;
}

function average(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const days = Math.min(30, Math.max(2, parseInt(url.searchParams.get("days") || "7", 10) || 7));

  const db = getDb();
  const rows = db.prepare(
    `SELECT date, body_battery_morning, body_battery_evening,
            sleep_score, sleep_duration_seconds,
            hrv_last_night, hrv_weekly_avg,
            resting_hr, stress_avg
     FROM health
     ORDER BY date DESC
     LIMIT ?`,
  ).all(days) as HealthRow[];

  if (rows.length === 0) {
    return NextResponse.json({
      ok: true,
      today: null,
      history: [],
      baseline: { morning: null, evening: null, samples: 0 },
    });
  }

  const today = rows[0];
  const priorRows = rows.slice(1);
  const baselineMorning = average(priorRows.map(r => r.body_battery_morning));
  const baselineEvening = average(priorRows.map(r => r.body_battery_evening));

  return NextResponse.json({
    ok: true,
    today,
    history: rows,
    baseline: {
      morning: baselineMorning !== null ? Math.round(baselineMorning) : null,
      evening: baselineEvening !== null ? Math.round(baselineEvening) : null,
      samples: priorRows.length,
    },
  });
}
