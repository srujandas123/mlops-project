"""Data-access layer for the flights table.

All raw SQL lives here; services never touch the DB directly.
"""
from typing import Optional
from ..database import get_conn, rows_to_dicts, log_event


class FlightRepository:

    # ── Read ────────────────────────────────────────────────────────────────────

    @staticmethod
    def find_all(q: str = "", limit: int = 200, offset: int = 0) -> tuple[list, int]:
        conn   = get_conn()
        sql    = "SELECT * FROM flights WHERE 1=1"
        params: list = []
        if q:
            sql += " AND (flight_id LIKE ? OR airline LIKE ? OR departure_airport LIKE ? OR arrival_airport LIKE ?)"
            w = f"%{q}%"
            params.extend([w, w, w, w])
        sql += f" ORDER BY id DESC LIMIT {limit} OFFSET {offset}"
        rows  = conn.execute(sql, params).fetchall()
        total = conn.execute("SELECT COUNT(*) FROM flights").fetchone()[0]
        conn.close()
        return rows_to_dicts(rows), total

    @staticmethod
    def find_by_id(flight_id: str) -> Optional[dict]:
        conn = get_conn()
        row  = conn.execute("SELECT * FROM flights WHERE flight_id=?", (flight_id,)).fetchone()
        conn.close()
        return dict(row) if row else None

    @staticmethod
    def find_all_raw() -> list:
        """Return all flights as dicts (used by analytics & ML training)."""
        conn = get_conn()
        rows = conn.execute("SELECT * FROM flights").fetchall()
        conn.close()
        return rows_to_dicts(rows)

    # ── Write ───────────────────────────────────────────────────────────────────

    @staticmethod
    def create(data: dict) -> str:
        cols = [
            'flight_id', 'airline', 'aircraft_type',
            'departure_airport', 'arrival_airport',
            'scheduled_departure', 'actual_departure',
            'scheduled_arrival', 'actual_arrival',
            'temperature', 'visibility', 'wind_speed', 'rainfall',
            'storm', 'airport_congestion', 'runway_status', 'technical_issue',
            'fuel_load', 'distance', 'altitude', 'delay_minutes', 'deviation',
        ]
        vals = [data.get(c) for c in cols]
        conn = get_conn()
        conn.execute(
            f"INSERT INTO flights ({','.join(cols)}) VALUES ({','.join(['?']*len(cols))})",
            vals
        )
        conn.commit()
        conn.close()
        log_event('info', 'flights', f"Created {data.get('flight_id')}")
        return data.get('flight_id', '')

    @staticmethod
    def update(flight_id: str, data: dict) -> bool:
        allowed = [
            'airline', 'aircraft_type', 'departure_airport', 'arrival_airport',
            'temperature', 'visibility', 'wind_speed', 'rainfall', 'storm',
            'airport_congestion', 'runway_status', 'technical_issue',
            'fuel_load', 'distance', 'altitude', 'delay_minutes', 'deviation',
        ]
        sets = [f"{k}=?" for k in allowed if k in data]
        vals = [data[k] for k in allowed if k in data] + [flight_id]
        if not sets:
            return False
        conn = get_conn()
        conn.execute(f"UPDATE flights SET {','.join(sets)} WHERE flight_id=?", vals)
        conn.commit()
        conn.close()
        log_event('info', 'flights', f"Updated {flight_id}")
        return True

    @staticmethod
    def delete(flight_id: str) -> None:
        conn = get_conn()
        conn.execute("DELETE FROM flights WHERE flight_id=?", (flight_id,))
        conn.commit()
        conn.close()
        log_event('info', 'flights', f"Deleted {flight_id}")

    @staticmethod
    def bulk_insert(rows: list) -> tuple[int, list]:
        """Insert a list of row dicts (from CSV upload). Returns (inserted, errors)."""
        conn     = get_conn()
        inserted = 0
        errors:  list = []
        for row in rows:
            try:
                conn.execute("""
                    INSERT OR IGNORE INTO flights
                    (flight_id,airline,aircraft_type,departure_airport,arrival_airport,
                     scheduled_departure,actual_departure,scheduled_arrival,actual_arrival,
                     temperature,visibility,wind_speed,rainfall,storm,airport_congestion,
                     runway_status,technical_issue,fuel_load,distance,altitude,delay_minutes,deviation)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """, [
                    row.get('flight_id', ''), row.get('airline', ''),
                    row.get('aircraft_type', ''), row.get('departure_airport', ''),
                    row.get('arrival_airport', ''),
                    row.get('scheduled_departure', ''), row.get('actual_departure', ''),
                    row.get('scheduled_arrival', ''),  row.get('actual_arrival', ''),
                    float(row.get('temperature', 0) or 0),
                    float(row.get('visibility', 8000) or 8000),
                    float(row.get('wind_speed', 0) or 0),
                    float(row.get('rainfall', 0) or 0),
                    int(str(row.get('storm', '0')).lower() in ('1', 'true', 'yes')),
                    float(row.get('airport_congestion', 50) or 50),
                    row.get('runway_status', 'Operational'),
                    int(str(row.get('technical_issue', '0')).lower() in ('1', 'true', 'yes')),
                    float(row.get('fuel_load', 70) or 70),
                    float(row.get('distance', 0) or 0),
                    float(row.get('altitude', 35000) or 35000),
                    int(row.get('delay_minutes', 0) or 0),
                    int(row.get('deviation', 0) or 0),
                ])
                inserted += 1
            except Exception as e:
                errors.append(str(e))
        conn.commit()
        conn.close()
        log_event('info', 'upload', f"CSV: {inserted} rows inserted, {len(errors)} errors")
        return inserted, errors

    @staticmethod
    def export_all() -> list:
        conn  = get_conn()
        rows  = conn.execute("SELECT * FROM flights ORDER BY id DESC").fetchall()
        conn.close()
        return rows_to_dicts(rows)
