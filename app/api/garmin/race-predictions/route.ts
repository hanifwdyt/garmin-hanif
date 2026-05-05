import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const SECRET = process.env.MINION_SECRET || "";

function checkAuth(req: NextRequest): boolean {
  return (req.headers.get("x-minion-secret") || "") === SECRET;
}

const COLS = [
  "race_5k_seconds", "race_10k_seconds",
  "race_half_marathon_seconds", "race_marathon_seconds",
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
    INSERT INTO race_predictions (${insertCols.join(", ")})
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
