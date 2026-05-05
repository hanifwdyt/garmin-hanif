import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const SECRET = process.env.MINION_SECRET || "";

function checkAuth(req: NextRequest): boolean {
  return (req.headers.get("x-minion-secret") || "") === SECRET;
}

const COLS = [
  "vo2_max_running", "vo2_max_cycling", "fitness_age",
  "training_status", "training_status_load_balance",
  "acute_load", "chronic_load", "load_ratio",
  "hill_score", "endurance_score",
  "lactate_threshold_hr", "lactate_threshold_speed_mps", "lactate_threshold_pace_min_per_km",
];

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body?.date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const db = getDb();
  const insertCols = ["date", ...COLS, "updated_at"];
  const placeholders = insertCols.map(c => c === "updated_at" ? "datetime('now')" : `@${c}`).join(", ");
  const updateClauses = COLS.map(c => `${c} = excluded.${c}`).join(", ");

  const sql = `
    INSERT INTO fitness_metrics (${insertCols.join(", ")})
    VALUES (${placeholders})
    ON CONFLICT(date) DO UPDATE SET
      ${updateClauses},
      updated_at = datetime('now')
  `;

  const params: Record<string, unknown> = { date: body.date };
  for (const col of COLS) {
    params[col] = body[col] ?? null;
  }

  db.prepare(sql).run(params);
  return NextResponse.json({ ok: true, date: body.date });
}
