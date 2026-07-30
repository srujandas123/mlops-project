"""Weather monitoring endpoints (simulated — no external API key needed)."""
import random
import math
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/weather", tags=["Weather"])

_AIRPORTS = {
    'DXB': {'name': 'Dubai',       'lat': 25.25, 'lon': 55.36},
    'AUH': {'name': 'Abu Dhabi',   'lat': 24.43, 'lon': 54.65},
    'DOH': {'name': 'Doha',        'lat': 25.27, 'lon': 51.61},
    'IST': {'name': 'Istanbul',    'lat': 40.98, 'lon': 28.82},
    'LHR': {'name': 'London',      'lat': 51.48, 'lon': -0.45},
    'FRA': {'name': 'Frankfurt',   'lat': 50.03, 'lon':  8.57},
    'CDG': {'name': 'Paris',       'lat': 49.01, 'lon':  2.55},
    'JFK': {'name': 'New York',    'lat': 40.64, 'lon': -73.78},
    'SIN': {'name': 'Singapore',   'lat':  1.36, 'lon': 103.99},
    'KUL': {'name': 'Kuala Lumpur','lat':  2.74, 'lon': 101.71},
    'BKK': {'name': 'Bangkok',     'lat': 13.69, 'lon': 100.75},
    'HKG': {'name': 'Hong Kong',   'lat': 22.31, 'lon': 113.92},
    'DEL': {'name': 'Delhi',       'lat': 28.56, 'lon':  77.10},
    'BOM': {'name': 'Mumbai',      'lat': 19.09, 'lon':  72.87},
    'CAI': {'name': 'Cairo',       'lat': 30.12, 'lon':  31.41},
}

_BASE_TEMP = {
    'DXB': 34, 'AUH': 33, 'DOH': 36, 'IST': 18, 'LHR': 12,
    'FRA': 14, 'CDG': 13, 'JFK': 16, 'SIN': 30, 'KUL': 31,
    'BKK': 32, 'HKG': 25, 'DEL': 28, 'BOM': 30, 'CAI': 26,
}


def _wx(code: str) -> dict:
    rng = random.Random(code + datetime.utcnow().strftime('%Y%m%d%H'))
    t = _BASE_TEMP.get(code, 20) + rng.uniform(-5, 5)
    wind = rng.uniform(5, 55)
    vis  = rng.uniform(1000, 10000)
    storm = rng.random() < 0.12
    status = 'STORM' if storm else ('WINDY' if wind > 45 else ('FOG' if vis < 3000 else 'CLEAR'))
    return {
        'airport':     code,
        'name':        _AIRPORTS.get(code, {}).get('name', code),
        'temperature': round(t, 1),
        'wind_speed':  round(wind, 1),
        'visibility':  round(vis, 0),
        'humidity':    round(rng.uniform(30, 90), 1),
        'pressure':    round(rng.uniform(1000, 1025), 1),
        'storm':       storm,
        'status':      status,
        'updated_at':  datetime.utcnow().isoformat(),
    }


@router.get("")
def all_weather():
    return [_wx(c) for c in _AIRPORTS]


@router.get("/cells")
def weather_cells():
    return [
        {'id': 'wx1',  'lat': 28,  'lon':  47, 'radius_km': 220, 'type': 'storm', 'intensity': 0.80, 'label': 'Gulf Storm'},
        {'id': 'wx2',  'lat': 52,  'lon':   5, 'radius_km': 180, 'type': 'rain',  'intensity': 0.65, 'label': 'North Sea Rain'},
        {'id': 'wx3',  'lat': 24,  'lon':  88, 'radius_km': 260, 'type': 'storm', 'intensity': 0.72, 'label': 'Bay of Bengal'},
        {'id': 'wx4',  'lat': 35,  'lon': 140, 'radius_km': 200, 'type': 'rain',  'intensity': 0.55, 'label': 'Japan Rain'},
        {'id': 'wx5',  'lat': -5,  'lon':  37, 'radius_km': 300, 'type': 'storm', 'intensity': 0.90, 'label': 'East Africa Storm'},
        {'id': 'wx6',  'lat': 48,  'lon':  22, 'radius_km': 150, 'type': 'fog',   'intensity': 0.60, 'label': 'Carpathian Fog'},
        {'id': 'wx7',  'lat': 20,  'lon':  78, 'radius_km': 240, 'type': 'rain',  'intensity': 0.70, 'label': 'India Monsoon'},
        {'id': 'wx8',  'lat': 55,  'lon':  -3, 'radius_km': 190, 'type': 'rain',  'intensity': 0.50, 'label': 'UK Weather'},
        {'id': 'wx9',  'lat': 33,  'lon': 130, 'radius_km': 170, 'type': 'storm', 'intensity': 0.68, 'label': 'Yellow Sea'},
        {'id': 'wx10', 'lat': 41,  'lon': -73, 'radius_km': 200, 'type': 'rain',  'intensity': 0.60, 'label': 'US East Coast'},
    ]


@router.get("/forecast/{airport_code}")
def forecast(airport_code: str):
    code = airport_code.upper()
    if code not in _AIRPORTS:
        raise HTTPException(status_code=404, detail=f"Unknown airport {code}")
    now = datetime.utcnow()
    data = []
    for h in range(24):
        t = now + timedelta(hours=h)
        rng = random.Random(code + t.strftime('%Y%m%d%H'))
        data.append({
            'hour':        t.strftime('%H:00'),
            'wind':        round(10 + math.sin(h * 0.4) * 15 + rng.uniform(-3, 3), 1),
            'visibility':  round(7000 + math.sin(h * 0.3 + 1) * 3000 + rng.uniform(-200, 200), 0),
            'temperature': round(22 + math.sin(h * 0.26 + 2) * 8 + rng.uniform(-2, 2), 1),
            'rain_prob':   round(max(0, min(1, 0.1 + math.sin(h * 0.5) * 0.2 + rng.uniform(0, 0.1))), 2),
        })
    return {'airport': code, 'forecast': data}


@router.get("/{airport_code}")
def airport_weather(airport_code: str):
    code = airport_code.upper()
    if code not in _AIRPORTS:
        raise HTTPException(status_code=404, detail=f"Unknown airport {code}")
    return _wx(code)
