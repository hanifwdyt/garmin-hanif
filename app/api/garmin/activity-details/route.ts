import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const SECRET = process.env.MINION_SECRET || "";

function checkAuth(req: NextRequest): boolean {
  return (req.headers.get("x-minion-secret") || "") === SECRET;
}

const COLS = [
  "hr_zone_1_seconds", "hr_zone_2_seconds", "hr_zone_3_seconds",
  "hr_zone_4_seconds", "hr_zone_5_seconds",
  "weather_temp_c", "weather_apparent_temp_c", "weather_humidity_pct",
  "weather_wind_kph", "weather_conditions",
  "splits_json",
];

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body?.activity_id) return NextResponse.json({ error: "activity_id required" }, { status: 400 });

  const db = getDb();
  const insertCols = ["activity_id", ...COLS, "updated_at"];
  const placeholders = insertCols.map(c => c === "updated_at" ? "datetime('now')" : `@${c}`).join(", ");
  const updateClauses = COLS.map(c => `${c} = excluded.${c}`).join(", ");

  const sql = `
    INSERT INTO activity_details (${insertCols.join(", ")})
    VALUES (${placeholders})
    ON CONFLICT(activity_id) DO UPDATE SET
      ${updateClauses},
      updated_at = datetime('now')
  `;

  const params: Record<string, unknown> = { activity_id: body.activity_id };
  for (const col of COLS) {
    params[col] = body[col] ?? null;
  }

  db.prepare(sql).run(params);
  return NextResponse.json({ ok: true, activity_id: body.activity_id });
}
