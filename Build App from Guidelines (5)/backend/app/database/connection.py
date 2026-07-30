"""SQLite database connection, schema initialisation, and seed data."""
import sqlite3
import json
import random
from datetime import datetime, timedelta
from pathlib import Path

from ..config import settings

DB_PATH = settings.db_path

SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS flights (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    flight_id           TEXT UNIQUE NOT NULL,
    airline             TEXT,
    aircraft_type       TEXT,
    departure_airport   TEXT,
    arrival_airport     TEXT,
    scheduled_departure TEXT,
    actual_departure    TEXT,
    scheduled_arrival   TEXT,
    actual_arrival      TEXT,
    temperature         REAL,
    visibility          REAL,
    wind_speed          REAL,
    rainfall            REAL,
    storm               INTEGER,
    airport_congestion  REAL,
    runway_status       TEXT,
    technical_issue     INTEGER,
    fuel_load           REAL,
    distance            REAL,
    altitude            REAL,
    delay_minutes       INTEGER,
    deviation           INTEGER,
    created_at          TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS alerts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    flight_id   TEXT,
    alert_type  TEXT,
    severity    TEXT,
    message     TEXT,
    acknowledged INTEGER DEFAULT 0,
    dismissed    INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS model_runs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    model_name      TEXT,
    accuracy        REAL,
    precision_score REAL,
    recall          REAL,
    f1              REAL,
    roc_auc         REAL,
    training_time   REAL,
    is_best         INTEGER DEFAULT 0,
    params          TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS predictions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    flight_id   TEXT,
    model_used  TEXT,
    prob        REAL,
    label       INTEGER,
    risk_level  TEXT,
    confidence  REAL,
    features    TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    level       TEXT,
    category    TEXT,
    message     TEXT,
    meta        TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS weather_cache (
    airport_code TEXT PRIMARY KEY,
    data         TEXT,
    updated_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT,
    email         TEXT,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT DEFAULT 'operator',
    last_login    TEXT,
    created_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_flights_deviation ON flights(deviation);
CREATE INDEX IF NOT EXISTS idx_flights_airline   ON flights(airline);
CREATE INDEX IF NOT EXISTS idx_alerts_severity   ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_predictions_flight ON predictions(flight_id);
"""

_AIRLINES = ['Emirates', 'Qatar Airways', 'Turkish Airlines', 'Lufthansa',
             'British Airways', 'Air Arabia', 'FlyDubai', 'Etihad']
_AIRCRAFT = ['Boeing 737', 'Airbus A320', 'Boeing 777', 'Airbus A380',
             'Boeing 787', 'Airbus A350']
_AIRPORTS = ['DXB', 'AUH', 'DOH', 'IST', 'LHR', 'FRA', 'CDG', 'JFK', 'SIN', 'KUL', 'BKK']
_RUNWAYS  = ['Operational', 'Partially Closed', 'Maintenance', 'Wet', 'Dry']


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def rows_to_dicts(rows) -> list:
    return [dict(r) for r in rows]


def log_event(level: str, category: str, message: str, meta: dict | None = None) -> None:
    try:
        conn = get_conn()
        conn.execute(
            "INSERT INTO logs (level,category,message,meta) VALUES (?,?,?,?)",
            (level, category, message, json.dumps(meta or {}))
        )
        conn.commit()
        conn.close()
    except Exception:
        pass


def init_db() -> None:
    """Create tables and seed initial data if the database is empty."""
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    conn = get_conn()
    conn.executescript(SCHEMA)
    conn.commit()

    if conn.execute("SELECT COUNT(*) FROM flights").fetchone()[0] == 0:
        _seed_flights(conn, 120)

    _ensure_default_users(conn)
    conn.close()


def _seed_flights(conn: sqlite3.Connection, n: int) -> None:
    rows = []
    for i in range(n):
        dep   = random.choice(_AIRPORTS)
        arr   = random.choice([a for a in _AIRPORTS if a != dep])
        base  = datetime(2024, random.randint(1, 12), random.randint(1, 28),
                         random.randint(0, 23), random.randint(0, 59))
        delay = random.randint(0, 120)
        storm = int(random.random() < 0.15)
        tech  = int(random.random() < 0.10)
        cong  = round(random.uniform(10, 95), 1)
        wind  = round(random.uniform(0, 80), 1)
        vis   = round(random.uniform(200, 10000), 0)
        rain  = round(random.uniform(0, 50), 1)
        fuel  = round(random.uniform(20, 95), 1)
        dist  = round(random.uniform(500, 12000), 0)
        alt   = round(random.uniform(25000, 42000), 0)
        temp  = round(random.uniform(-60, 40), 1)
        prob  = (storm * .35 + tech * .25 + (cong > 80) * .15
                 + (wind > 60) * .1 + (vis < 500) * .1 + (delay > 60) * .05
                 + random.uniform(0, .1))
        dev   = int(prob > 0.4)
        fmt   = lambda d: d.strftime('%Y-%m-%d %H:%M')
        rows.append((
            f'FL{1000 + i}',
            random.choice(_AIRLINES), random.choice(_AIRCRAFT),
            dep, arr,
            fmt(base), fmt(base + timedelta(minutes=delay)),
            fmt(base + timedelta(hours=random.randint(2, 12))),
            fmt(base + timedelta(hours=random.randint(2, 12), minutes=delay)),
            temp, vis, wind, rain, storm, cong,
            random.choice(_RUNWAYS), tech, fuel, dist, alt, delay, dev,
        ))
    conn.executemany("""
        INSERT OR IGNORE INTO flights
        (flight_id,airline,aircraft_type,departure_airport,arrival_airport,
         scheduled_departure,actual_departure,scheduled_arrival,actual_arrival,
         temperature,visibility,wind_speed,rainfall,storm,airport_congestion,
         runway_status,technical_issue,fuel_load,distance,altitude,delay_minutes,deviation)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, rows)
    conn.commit()
    _seed_alerts(conn)


def _seed_alerts(conn: sqlite3.Connection) -> None:
    cur = conn.execute(
        "SELECT flight_id,departure_airport,arrival_airport,storm,technical_issue,delay_minutes,deviation "
        "FROM flights LIMIT 30"
    )
    for r in cur.fetchall():
        if r['deviation'] == 1 and r['storm']:
            conn.execute(
                "INSERT INTO alerts (flight_id,alert_type,severity,message) VALUES (?,?,?,?)",
                (r['flight_id'], 'Weather', 'critical',
                 f"Storm deviation on {r['flight_id']} ({r['departure_airport']}→{r['arrival_airport']})")
            )
        if r['technical_issue']:
            conn.execute(
                "INSERT INTO alerts (flight_id,alert_type,severity,message) VALUES (?,?,?,?)",
                (r['flight_id'], 'Technical', 'warning',
                 f"Technical issue on {r['flight_id']}")
            )
        if r['delay_minutes'] > 90:
            conn.execute(
                "INSERT INTO alerts (flight_id,alert_type,severity,message) VALUES (?,?,?,?)",
                (r['flight_id'], 'Delay', 'info',
                 f"Excessive delay: {r['flight_id']} — {r['delay_minutes']} min")
            )
    conn.commit()


def _ensure_default_users(conn: sqlite3.Connection) -> None:
    import hashlib
    secret = settings.airways_secret

    def _hash(pw: str) -> str:
        return hashlib.pbkdf2_hmac('sha256', pw.encode(), secret.encode(), 200_000).hex()

    if conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
        conn.execute("INSERT INTO users (name,email,username,password_hash,role) VALUES (?,?,?,?,?)",
                     ('Admin User', 'admin@airways.atc', 'admin', _hash('admin123'), 'admin'))
        conn.execute("INSERT INTO users (name,email,username,password_hash,role) VALUES (?,?,?,?,?)",
                     ('ATC Operator', 'operator@airways.atc', 'operator', _hash('atc2024'), 'operator'))
        conn.commit()
