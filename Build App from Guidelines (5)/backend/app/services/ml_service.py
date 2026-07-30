"""ML service — wraps backend/ml/pipeline.py (scikit-learn + optional XGBoost)."""
import json
import os
import sys
from pathlib import Path
from fastapi import HTTPException

# Ensure the pipeline module is importable regardless of working directory
_REPO_ROOT = Path(__file__).resolve().parents[4]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

try:
    import pandas as pd
    _PANDAS = True
except ImportError:
    _PANDAS = False

from ..database import get_conn, rows_to_dicts, log_event


class MLService:

    @staticmethod
    def _pipeline():
        """Lazy-import the ML pipeline to avoid loading scikit-learn on every request."""
        from backend.ml.pipeline import train as _train, load_best as _lb, predict_single as _ps, META_PATH as _mp
        return _train, _lb, _ps, _mp

    # ── Training ────────────────────────────────────────────────────────────────

    @staticmethod
    def trigger_train() -> dict:
        if not _PANDAS:
            raise HTTPException(status_code=503, detail="pandas not installed")
        _train, _lb, _ps, _mp = MLService._pipeline()
        conn = get_conn()
        rows = rows_to_dicts(conn.execute("SELECT * FROM flights").fetchall())
        if not rows:
            conn.close()
            raise HTTPException(status_code=400, detail="No flights in database")
        df = pd.DataFrame(rows)
        try:
            result = _train(df, db_conn=conn)
        except Exception as e:
            conn.close()
            log_event('error', 'ml', f"Training failed: {e}")
            raise HTTPException(status_code=500, detail=str(e))
        conn.close()
        log_event('info', 'ml', f"Training complete. Best: {result['best'].get('model_name')}")
        return result

    # ── Status ──────────────────────────────────────────────────────────────────

    @staticmethod
    def get_status() -> dict:
        _train, _lb, _ps, _mp = MLService._pipeline()
        pipe, meta = _lb()
        if pipe is None:
            return {'trained': False, 'message': 'No model trained yet. POST /api/ml/train to train.'}
        return {'trained': True, **meta}

    @staticmethod
    def list_model_runs() -> list:
        conn = get_conn()
        rows = conn.execute("SELECT * FROM model_runs ORDER BY f1 DESC LIMIT 100").fetchall()
        conn.close()
        return rows_to_dicts(rows)

    # ── Inference ───────────────────────────────────────────────────────────────

    @staticmethod
    def predict_single(data: dict) -> dict:
        _train, _lb, _ps, _mp = MLService._pipeline()
        result = _ps(data)
        if 'error' in result:
            raise HTTPException(status_code=503, detail=result['error'])
        flight_id = data.get('flight_id', 'MANUAL')
        conn = get_conn()
        conn.execute(
            "INSERT INTO predictions (flight_id,model_used,prob,label,risk_level,confidence,features) VALUES (?,?,?,?,?,?,?)",
            (flight_id, result['model_used'], result['deviation_prob'], result['label'],
             result['risk_level'], result['confidence'], json.dumps(data))
        )
        conn.commit()
        conn.close()
        return result

    @staticmethod
    def predict_batch(items: list) -> list:
        _train, _lb, _ps, _mp = MLService._pipeline()
        return [_ps(item) for item in items]

    @staticmethod
    def prediction_history(limit: int = 50) -> list:
        conn = get_conn()
        rows = conn.execute(
            "SELECT * FROM predictions ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()
        conn.close()
        return rows_to_dicts(rows)

    @staticmethod
    def feature_importance() -> list:
        _train, _lb, _ps, _mp = MLService._pipeline()
        if not os.path.exists(_mp):
            raise HTTPException(status_code=404, detail="No trained model found")
        with open(_mp) as f:
            meta = json.load(f)
        return meta.get('feature_importance', [])
