import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();

  const activityCount = (db.prepare("SELECT COUNT(*) as n FROM activities").get() as { n: number }).n;
  const healthCount = (db.prepare("SELECT COUNT(*) as n FROM health").get() as { n: number }).n;
  const latestActivity = db.prepare("SELECT date FROM activities ORDER BY date DESC LIMIT 1").get() as { date: string } | undefined;
  const latestHealth = db.prepare("SELECT date FROM health ORDER BY date DESC LIMIT 1").get() as { date: string } | undefined;

  return NextResponse.json({
    activity_count: activityCount,
    health_count: healthCount,
    latest_activity_date: latestActivity?.date ?? null,
    latest_health_date: latestHealth?.date ?? null,
    is_empty: activityCount === 0,
  });
}
