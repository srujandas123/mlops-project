"""Business logic layer for flight operations."""
import io
import csv
import statistics
from fastapi import HTTPException
from fastapi.responses import StreamingResponse

from ..repositories import FlightRepository


class FlightService:

    @staticmethod
    def list_flights(q: str, limit: int, offset: int) -> dict:
        rows, total = FlightRepository.find_all(q, limit, offset)
        return {"flights": rows, "total": total}

    @staticmethod
    def get_flight(flight_id: str) -> dict:
        row = FlightRepository.find_by_id(flight_id)
        if not row:
            raise HTTPException(status_code=404, detail="Flight not found")
        return row

    @staticmethod
    def create_flight(data: dict) -> dict:
        try:
            fid = FlightRepository.create(data)
            return {"status": "created", "flight_id": fid}
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    @staticmethod
    def update_flight(flight_id: str, data: dict) -> dict:
        ok = FlightRepository.update(flight_id, data)
        if not ok:
            raise HTTPException(status_code=400, detail="No valid fields to update")
        return {"status": "updated"}

    @staticmethod
    def delete_flight(flight_id: str) -> dict:
        FlightRepository.delete(flight_id)
        return {"status": "deleted"}

    @staticmethod
    def upload_csv(file_bytes: bytes) -> dict:
        stream  = io.StringIO(file_bytes.decode('utf-8-sig'))
        reader  = csv.DictReader(stream)
        rows    = list(reader)
        if not rows:
            raise HTTPException(status_code=400, detail="Empty CSV file")
        inserted, errors = FlightRepository.bulk_insert(rows)
        return {"inserted": inserted, "total_rows": len(rows), "errors": errors[:10]}

    @staticmethod
    def export_csv() -> StreamingResponse:
        rows = FlightRepository.export_all()
        if not rows:
            raise HTTPException(status_code=404, detail="No data to export")
        buf = io.StringIO()
        w   = csv.DictWriter(buf, fieldnames=rows[0].keys())
        w.writeheader()
        w.writerows(rows)
        return StreamingResponse(
            io.BytesIO(buf.getvalue().encode()),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=airways_flights.csv"},
        )

    # ── Analytics helpers ──────────────────────────────────────────────────────

    @staticmethod
    def analytics_overview() -> dict:
        rows = FlightRepository.find_all_raw()
        if not rows:
            return {}
        total      = len(rows)
        deviations = sum(1 for r in rows if r['deviation'] == 1)
        delayed    = sum(1 for r in rows if r['delay_minutes'] > 30)
        storms     = sum(1 for r in rows if r['storm'])
        tech       = sum(1 for r in rows if r['technical_issue'])
        avg_delay  = round(sum(r['delay_minutes'] for r in rows) / total, 1)
        avg_fuel   = round(sum(r['fuel_load'] for r in rows) / total, 1)
        return {
            'total': total, 'deviations': deviations, 'delayed': delayed,
            'storm_events': storms, 'tech_issues': tech,
            'avg_delay': avg_delay, 'avg_fuel': avg_fuel,
            'deviation_rate': round(deviations / total * 100, 1),
        }

    @staticmethod
    def analytics_by_airline() -> list:
        rows     = FlightRepository.find_all_raw()
        airlines: dict = {}
        for r in rows:
            a = r['airline']
            if a not in airlines:
                airlines[a] = {'airline': a, 'total': 0, 'deviations': 0, 'delays': [], 'storms': 0}
            airlines[a]['total']      += 1
            airlines[a]['deviations'] += r['deviation']
            airlines[a]['delays'].append(r['delay_minutes'])
            airlines[a]['storms']     += int(bool(r['storm']))
        result = []
        for d in airlines.values():
            d['avg_delay'] = round(sum(d['delays']) / len(d['delays']), 1) if d['delays'] else 0
            d['dev_rate']  = round(d['deviations'] / d['total'] * 100, 1)
            del d['delays']
            result.append(d)
        result.sort(key=lambda x: x['total'], reverse=True)
        return result

    @staticmethod
    def analytics_by_airport() -> list:
        rows     = FlightRepository.find_all_raw()
        airports: dict = {}
        for r in rows:
            for key in ('departure_airport', 'arrival_airport'):
                ap = r[key]
                if ap not in airports:
                    airports[ap] = {'airport': ap, 'departures': 0, 'arrivals': 0, 'deviations': 0, 'delays': []}
                airports[ap]['departures' if key == 'departure_airport' else 'arrivals'] += 1
                airports[ap]['deviations'] += r['deviation']
                airports[ap]['delays'].append(r['delay_minutes'])
        result = []
        for d in airports.values():
            d['avg_delay'] = round(sum(d['delays']) / len(d['delays']), 1) if d['delays'] else 0
            d['total']     = d['departures'] + d['arrivals']
            del d['delays']
            result.append(d)
        result.sort(key=lambda x: x['total'], reverse=True)
        return result

    @staticmethod
    def analytics_delay_distribution() -> dict:
        rows   = FlightRepository.find_all_raw()
        delays = [r['delay_minutes'] for r in rows]
        buckets = [
            {'bucket': 'On Time', 'min': 0,   'max': 0,    'count': sum(1 for d in delays if d == 0)},
            {'bucket': '1–15m',   'min': 1,   'max': 15,   'count': sum(1 for d in delays if 1 <= d <= 15)},
            {'bucket': '16–30m',  'min': 16,  'max': 30,   'count': sum(1 for d in delays if 16 <= d <= 30)},
            {'bucket': '31–60m',  'min': 31,  'max': 60,   'count': sum(1 for d in delays if 31 <= d <= 60)},
            {'bucket': '>60m',    'min': 61,  'max': 9999, 'count': sum(1 for d in delays if d > 60)},
        ]
        return {
            'buckets': buckets,
            'mean':   round(statistics.mean(delays), 1) if delays else 0,
            'median': round(statistics.median(delays), 1) if delays else 0,
            'stdev':  round(statistics.stdev(delays), 1) if len(delays) > 1 else 0,
            'max':    max(delays) if delays else 0,
        }

    @staticmethod
    def analytics_weather_impact() -> dict:
        rows = FlightRepository.find_all_raw()
        return {
            'storm':     {'deviation': sum(1 for r in rows if r['storm'] and r['deviation']),
                          'normal':    sum(1 for r in rows if r['storm'] and not r['deviation'])},
            'technical': {'deviation': sum(1 for r in rows if r['technical_issue'] and r['deviation']),
                          'normal':    sum(1 for r in rows if r['technical_issue'] and not r['deviation'])},
            'high_wind': {'deviation': sum(1 for r in rows if r['wind_speed'] > 50 and r['deviation']),
                          'normal':    sum(1 for r in rows if r['wind_speed'] > 50 and not r['deviation'])},
            'low_vis':   {'deviation': sum(1 for r in rows if r['visibility'] < 2000 and r['deviation']),
                          'normal':    sum(1 for r in rows if r['visibility'] < 2000 and not r['deviation'])},
            'congestion':{'deviation': sum(1 for r in rows if r['airport_congestion'] > 80 and r['deviation']),
                          'normal':    sum(1 for r in rows if r['airport_congestion'] > 80 and not r['deviation'])},
        }

    @staticmethod
    def analytics_top_routes() -> list:
        rows   = FlightRepository.find_all_raw()
        routes: dict = {}
        for r in rows:
            key = f"{r['departure_airport']}→{r['arrival_airport']}"
            if key not in routes:
                routes[key] = {'route': key, 'dep': r['departure_airport'],
                               'arr': r['arrival_airport'], 'total': 0, 'deviations': 0}
            routes[key]['total']      += 1
            routes[key]['deviations'] += r['deviation']
        result = [{'dev_rate': round(v['deviations'] / v['total'] * 100, 1), **v} for v in routes.values()]
        result.sort(key=lambda x: x['dev_rate'], reverse=True)
        return result[:15]

    @staticmethod
    def analytics_stats() -> dict:
        rows = FlightRepository.find_all_raw()
        if not rows:
            return {}
        cols = ['temperature', 'visibility', 'wind_speed', 'rainfall',
                'airport_congestion', 'fuel_load', 'distance', 'altitude', 'delay_minutes']
        out = {}
        for c in cols:
            vals = [r[c] for r in rows if r.get(c) is not None]
            if not vals:
                continue
            out[c] = {
                'count':  len(vals),
                'mean':   round(sum(vals) / len(vals), 2),
                'median': round(statistics.median(vals), 2),
                'stdev':  round(statistics.stdev(vals), 2) if len(vals) > 1 else 0,
                'min':    min(vals),
                'max':    max(vals),
            }
        return out
