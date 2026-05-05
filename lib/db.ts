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

function ensureColumn(db: Database.Database, table: string, column: string, ddl: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some(c => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
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

    CREATE TABLE IF NOT EXISTS fitness_metrics (
      date TEXT PRIMARY KEY,
      vo2_max_running REAL,
      vo2_max_cycling REAL,
      fitness_age INTEGER,
      training_status TEXT,
      training_status_load_balance TEXT,
      acute_load REAL,
      chronic_load REAL,
      load_ratio REAL,
      hill_score REAL,
      endurance_score REAL,
      lactate_threshold_hr INTEGER,
      lactate_threshold_speed_mps REAL,
      lactate_threshold_pace_min_per_km TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS race_predictions (
      date TEXT PRIMARY KEY,
      race_5k_seconds INTEGER,
      race_10k_seconds INTEGER,
      race_half_marathon_seconds INTEGER,
      race_marathon_seconds INTEGER,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity_details (
      activity_id TEXT PRIMARY KEY,
      hr_zone_1_seconds INTEGER,
      hr_zone_2_seconds INTEGER,
      hr_zone_3_seconds INTEGER,
      hr_zone_4_seconds INTEGER,
      hr_zone_5_seconds INTEGER,
      weather_temp_c REAL,
      weather_apparent_temp_c REAL,
      weather_humidity_pct INTEGER,
      weather_wind_kph REAL,
      weather_conditions TEXT,
      splits_json TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS personal_records (
      record_type TEXT PRIMARY KEY,
      value_seconds INTEGER,
      value_distance_meters REAL,
      activity_id TEXT,
      record_date TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Add new columns to health (idempotent)
  ensureColumn(db, "health", "spo2_avg", "INTEGER");
  ensureColumn(db, "health", "spo2_lowest", "INTEGER");
  ensureColumn(db, "health", "respiration_avg", "REAL");
  ensureColumn(db, "health", "respiration_lowest", "REAL");
  ensureColumn(db, "health", "respiration_highest", "REAL");
  ensureColumn(db, "health", "intensity_minutes_moderate", "INTEGER");
  ensureColumn(db, "health", "intensity_minutes_vigorous", "INTEGER");
  ensureColumn(db, "health", "intensity_minutes_weekly", "INTEGER");
  ensureColumn(db, "health", "floors_climbed", "INTEGER");
  ensureColumn(db, "health", "floors_goal", "INTEGER");
  ensureColumn(db, "health", "weight_kg", "REAL");
  ensureColumn(db, "health", "body_fat_pct", "REAL");
  ensureColumn(db, "health", "bmi", "REAL");
  ensureColumn(db, "health", "training_readiness_score", "INTEGER");
  ensureColumn(db, "health", "training_readiness_level", "TEXT");
  ensureColumn(db, "health", "training_readiness_factors_json", "TEXT");
  ensureColumn(db, "health", "hydration_ml", "INTEGER");
  ensureColumn(db, "health", "hydration_goal_ml", "INTEGER");
}
