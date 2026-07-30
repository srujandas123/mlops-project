"""Alert management service."""
from fastapi import HTTPException
from ..database import get_conn, rows_to_dicts


class AlertService:

    @staticmethod
    def list_alerts(severity: str | None, limit: int) -> dict:
        conn   = get_conn()
        sql    = "SELECT * FROM alerts WHERE dismissed=0"
        params: list = []
        if severity:
            sql += " AND severity=?"
            params.append(severity)
        sql += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)
        rows  = conn.execute(sql, params).fetchall()
        total = conn.execute("SELECT COUNT(*) FROM alerts WHERE dismissed=0").fetchone()[0]
        counts = {
            'critical': conn.execute("SELECT COUNT(*) FROM alerts WHERE severity='critical' AND dismissed=0 AND acknowledged=0").fetchone()[0],
            'warning':  conn.execute("SELECT COUNT(*) FROM alerts WHERE severity='warning'  AND dismissed=0 AND acknowledged=0").fetchone()[0],
            'info':     conn.execute("SELECT COUNT(*) FROM alerts WHERE severity='info'     AND dismissed=0 AND acknowledged=0").fetchone()[0],
        }
        conn.close()
        return {'alerts': rows_to_dicts(rows), 'total': total, 'counts': counts}

    @staticmethod
    def create_alert(data: dict) -> dict:
        conn = get_conn()
        cur  = conn.execute(
            "INSERT INTO alerts (flight_id,alert_type,severity,message) VALUES (?,?,?,?)",
            (data.get('flight_id', ''), data.get('alert_type', 'info'),
             data.get('severity', 'info'), data.get('message', ''))
        )
        conn.commit()
        aid = cur.lastrowid
        conn.close()
        return {'status': 'created', 'id': aid}

    @staticmethod
    def acknowledge(alert_id: int) -> dict:
        conn = get_conn()
        conn.execute("UPDATE alerts SET acknowledged=1 WHERE id=?", (alert_id,))
        conn.commit()
        conn.close()
        return {'status': 'acknowledged'}

    @staticmethod
    def dismiss(alert_id: int) -> dict:
        conn = get_conn()
        conn.execute("UPDATE alerts SET dismissed=1 WHERE id=?", (alert_id,))
        conn.commit()
        conn.close()
        return {'status': 'dismissed'}

    @staticmethod
    def acknowledge_all() -> dict:
        conn = get_conn()
        conn.execute("UPDATE alerts SET acknowledged=1 WHERE dismissed=0")
        conn.commit()
        conn.close()
        return {'status': 'all acknowledged'}

    @staticmethod
    def delete(alert_id: int) -> dict:
        conn = get_conn()
        conn.execute("DELETE FROM alerts WHERE id=?", (alert_id,))
        conn.commit()
        conn.close()
        return {'status': 'deleted'}

    @staticmethod
    def list_logs(level: str | None, limit: int) -> list:
        conn   = get_conn()
        sql    = "SELECT * FROM logs WHERE 1=1"
        params: list = []
        if level:
            sql += " AND level=?"
            params.append(level)
        sql += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)
        rows = conn.execute(sql, params).fetchall()
        conn.close()
        return rows_to_dicts(rows)
