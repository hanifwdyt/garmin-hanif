import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, "garmin.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  migrate(_db);
  return _db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_id TEXT UNIQUE NOT NULL,
      activity_type TEXT,
      date TEXT,
      start_time_local TEXT,
      duration_seconds REAL,
      distance_meters REAL,
      avg_hr INTEGER,
      max_hr INTEGER,
      avg_pace_min_per_km TEXT,
      avg_cadence_spm INTEGER,
      calories INTEGER,
      elevation_gain_m REAL,
      training_effect_aerobic REAL,
      training_effect_anaerobic REAL,
      name TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS health (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE NOT NULL,
      sleep_score INTEGER,
      sleep_duration_seconds INTEGER,
      sleep_start TEXT,
      sleep_end TEXT,
      hrv_weekly_avg REAL,
      hrv_last_night REAL,
      hrv_status TEXT,
      body_battery_morning INTEGER,
      body_battery_evening INTEGER,
      resting_hr INTEGER,
      stress_avg INTEGER,
      steps INTEGER,
      calories_active INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
}
