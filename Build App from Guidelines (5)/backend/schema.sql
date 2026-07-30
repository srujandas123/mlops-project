-- ============================================================
-- Airways ATC Operations Center — MySQL Schema
-- ============================================================
-- Usage:
--   mysql -u <user> -p <database> < schema.sql
-- Set DB_PATH to a MySQL URL in backend/.env:
--   DB_URL=mysql+pymysql://user:pass@localhost:3306/airways
-- ============================================================

CREATE DATABASE IF NOT EXISTS airways CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE airways;

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(120),
    email         VARCHAR(255),
    username      VARCHAR(80) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          ENUM('admin', 'operator', 'viewer') NOT NULL DEFAULT 'operator',
    last_login    DATETIME,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── Flights ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flights (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    flight_id           VARCHAR(20) UNIQUE NOT NULL,
    airline             VARCHAR(100),
    aircraft_type       VARCHAR(60),
    departure_airport   VARCHAR(10),
    arrival_airport     VARCHAR(10),
    scheduled_departure DATETIME,
    actual_departure    DATETIME,
    scheduled_arrival   DATETIME,
    actual_arrival      DATETIME,
    temperature         DECIMAL(6,2),
    visibility          DECIMAL(10,2),
    wind_speed          DECIMAL(6,2),
    rainfall            DECIMAL(6,2),
    storm               TINYINT(1) DEFAULT 0,
    airport_congestion  DECIMAL(6,2),
    runway_status       VARCHAR(30),
    technical_issue     TINYINT(1) DEFAULT 0,
    fuel_load           DECIMAL(6,2),
    distance            DECIMAL(10,2),
    altitude            DECIMAL(10,2),
    delay_minutes       INT DEFAULT 0,
    deviation           TINYINT(1) DEFAULT 0,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_deviation (deviation),
    INDEX idx_airline   (airline),
    INDEX idx_departure (departure_airport),
    INDEX idx_arrival   (arrival_airport)
) ENGINE=InnoDB;

-- ── Alerts ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    flight_id    VARCHAR(20),
    alert_type   VARCHAR(30),
    severity     ENUM('critical', 'warning', 'info') NOT NULL DEFAULT 'info',
    message      TEXT,
    acknowledged TINYINT(1) DEFAULT 0,
    dismissed    TINYINT(1) DEFAULT 0,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_severity (severity),
    INDEX idx_flight   (flight_id)
) ENGINE=InnoDB;

-- ── Model Runs ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS model_runs (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    model_name      VARCHAR(80),
    accuracy        DECIMAL(8,6),
    precision_score DECIMAL(8,6),
    recall          DECIMAL(8,6),
    f1              DECIMAL(8,6),
    roc_auc         DECIMAL(8,6),
    training_time   DECIMAL(10,3),
    is_best         TINYINT(1) DEFAULT 0,
    params          JSON,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── Predictions ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS predictions (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    flight_id   VARCHAR(20),
    model_used  VARCHAR(80),
    prob        DECIMAL(8,6),
    label       TINYINT(1),
    risk_level  VARCHAR(20),
    confidence  DECIMAL(8,6),
    features    JSON,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_flight (flight_id)
) ENGINE=InnoDB;

-- ── Logs ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS logs (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    level      ENUM('debug', 'info', 'warning', 'error') NOT NULL DEFAULT 'info',
    category   VARCHAR(40),
    message    TEXT,
    meta       JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_level    (level),
    INDEX idx_category (category)
) ENGINE=InnoDB;

-- ── Weather Cache ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weather_cache (
    airport_code VARCHAR(10) PRIMARY KEY,
    data         JSON,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── Default seed users ────────────────────────────────────────────────────────
-- Passwords hashed at app startup; these are placeholder entries.
-- The application's init_db() will auto-create admin/operator accounts.
-- To manually insert (replace <hash> with actual PBKDF2-SHA256 hex):
-- INSERT INTO users (name,email,username,password_hash,role)
--   VALUES ('Admin User','admin@airways.atc','admin','<hash>','admin');
-- INSERT INTO users (name,email,username,password_hash,role)
--   VALUES ('ATC Operator','operator@airways.atc','operator','<hash>','operator');
