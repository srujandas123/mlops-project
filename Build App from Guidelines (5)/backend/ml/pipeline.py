"""
ML Pipeline — trains 12 models, picks the best by F1, persists with joblib.
Re-uses a saved model on every restart; only retrains when explicitly requested.
"""
import os
import json
import time
import warnings
import numpy as np
import pandas as pd
import joblib
from datetime import datetime
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import (accuracy_score, precision_score, recall_score,
                             f1_score, roc_auc_score, confusion_matrix)
from sklearn.ensemble import (RandomForestClassifier, GradientBoostingClassifier,
                              AdaBoostClassifier, ExtraTreesClassifier)
from sklearn.tree import DecisionTreeClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.neighbors import KNeighborsClassifier
from sklearn.naive_bayes import GaussianNB

warnings.filterwarnings('ignore')

MODEL_DIR  = os.path.join(os.path.dirname(__file__), 'saved')
BEST_PATH  = os.path.join(MODEL_DIR, 'best_model.joblib')
META_PATH  = os.path.join(MODEL_DIR, 'model_meta.json')

os.makedirs(MODEL_DIR, exist_ok=True)

FEATURE_COLS = [
    'temperature', 'visibility', 'wind_speed', 'rainfall',
    'storm', 'airport_congestion', 'technical_issue',
    'fuel_load', 'distance', 'altitude', 'delay_minutes',
]
TARGET_COL = 'deviation'


def _build_candidates():
    candidates = {
        'Random Forest':        RandomForestClassifier(n_estimators=200, max_depth=12, random_state=42, n_jobs=-1),
        'Gradient Boosting':    GradientBoostingClassifier(n_estimators=200, max_depth=5, learning_rate=0.05, random_state=42),
        'Extra Trees':          ExtraTreesClassifier(n_estimators=200, max_depth=12, random_state=42, n_jobs=-1),
        'AdaBoost':             AdaBoostClassifier(n_estimators=150, learning_rate=0.5, random_state=42),
        'Decision Tree':        DecisionTreeClassifier(max_depth=10, random_state=42),
        'Logistic Regression':  LogisticRegression(max_iter=2000, C=1.0, random_state=42),
        'SVM':                  SVC(probability=True, C=1.0, kernel='rbf', random_state=42),
        'KNN':                  KNeighborsClassifier(n_neighbors=7),
        'Naive Bayes':          GaussianNB(),
    }
    # XGBoost — optional
    try:
        from xgboost import XGBClassifier
        candidates['XGBoost'] = XGBClassifier(n_estimators=300, max_depth=6, learning_rate=0.05,
                                               use_label_encoder=False, eval_metric='logloss',
                                               random_state=42, n_jobs=-1)
    except ImportError:
        pass
    # LightGBM — optional
    try:
        from lightgbm import LGBMClassifier
        candidates['LightGBM'] = LGBMClassifier(n_estimators=300, max_depth=6, learning_rate=0.05,
                                                 random_state=42, n_jobs=-1, verbose=-1)
    except ImportError:
        pass
    # CatBoost — optional
    try:
        from catboost import CatBoostClassifier
        candidates['CatBoost'] = CatBoostClassifier(iterations=300, depth=6, learning_rate=0.05,
                                                     random_seed=42, verbose=0)
    except ImportError:
        pass
    return candidates


def _evaluate(name: str, clf, X_train, X_test, y_train, y_test, scaler) -> dict:
    pipe = Pipeline([('scaler', scaler), ('clf', clf)])
    t0 = time.time()
    pipe.fit(X_train, y_train)
    training_time = round(time.time() - t0, 3)
    y_pred  = pipe.predict(X_test)
    y_proba = pipe.predict_proba(X_test)[:, 1] if hasattr(clf, 'predict_proba') else y_pred.astype(float)
    cm = confusion_matrix(y_test, y_pred).tolist()
    fi: list = []
    inner = pipe.named_steps['clf']
    if hasattr(inner, 'feature_importances_'):
        fi = [{'feature': FEATURE_COLS[i], 'importance': round(float(v), 4)}
              for i, v in enumerate(inner.feature_importances_)]
        fi.sort(key=lambda x: x['importance'], reverse=True)
    elif hasattr(inner, 'coef_'):
        coef = np.abs(inner.coef_[0])
        fi = [{'feature': FEATURE_COLS[i], 'importance': round(float(v / coef.sum()), 4)}
              for i, v in enumerate(coef)]
        fi.sort(key=lambda x: x['importance'], reverse=True)
    return {
        'model_name':      name,
        'accuracy':        round(accuracy_score(y_test, y_pred), 4),
        'precision_score': round(precision_score(y_test, y_pred, zero_division=0), 4),
        'recall':          round(recall_score(y_test, y_pred, zero_division=0), 4),
        'f1':              round(f1_score(y_test, y_pred, zero_division=0), 4),
        'roc_auc':         round(roc_auc_score(y_test, y_proba), 4),
        'training_time':   training_time,
        'confusion_matrix': cm,
        'feature_importance': fi,
        'pipeline':        pipe,
    }


def train(df: pd.DataFrame, db_conn=None) -> dict:
    """Train all candidates on df, persist the best, return results list."""
    X = df[FEATURE_COLS].copy()
    y = df[TARGET_COL].copy()
    # Convert bool cols
    for c in ['storm', 'technical_issue']:
        X[c] = X[c].astype(int)
    X = X.fillna(X.median(numeric_only=True))

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y)

    scaler     = StandardScaler()
    candidates = _build_candidates()
    results    = []

    for name, clf in candidates.items():
        try:
            res = _evaluate(name, clf, X_train.values, X_test.values,
                            y_train.values, y_test.values, StandardScaler())
            results.append(res)
        except Exception as e:
            results.append({'model_name': name, 'error': str(e), 'f1': 0.0, 'roc_auc': 0.0})

    # Best by F1
    valid = [r for r in results if 'error' not in r]
    best  = max(valid, key=lambda r: r['f1'])

    # Persist
    joblib.dump(best['pipeline'], BEST_PATH)
    meta = {k: v for k, v in best.items() if k != 'pipeline'}
    meta['trained_at'] = datetime.utcnow().isoformat()
    meta['feature_cols'] = FEATURE_COLS
    with open(META_PATH, 'w') as f:
        json.dump(meta, f, indent=2)

    # Optionally record in DB
    if db_conn is not None:
        for r in valid:
            db_conn.execute("""
                INSERT INTO model_runs
                (model_name,accuracy,precision_score,recall,f1,roc_auc,training_time,is_best)
                VALUES (?,?,?,?,?,?,?,?)
            """, (r['model_name'], r.get('accuracy'), r.get('precision_score'),
                  r.get('recall'), r.get('f1'), r.get('roc_auc'),
                  r.get('training_time'), int(r['model_name'] == best['model_name'])))
        db_conn.commit()

    # Sanitise for JSON response (drop pipeline objects)
    clean = []
    for r in results:
        row = {k: v for k, v in r.items() if k != 'pipeline'}
        clean.append(row)

    return {'best': {k: v for k, v in meta.items()}, 'all_models': clean}


def load_best():
    """Return (pipeline, meta) if a saved model exists, else (None, None)."""
    if not os.path.exists(BEST_PATH) or not os.path.exists(META_PATH):
        return None, None
    try:
        pipe = joblib.load(BEST_PATH)
        with open(META_PATH) as f:
            meta = json.load(f)
        return pipe, meta
    except Exception:
        return None, None


def predict_single(features: dict) -> dict:
    """Predict deviation probability for a single flight features dict."""
    pipe, meta = load_best()
    if pipe is None:
        return {'error': 'No trained model found. POST /api/ml/train first.'}

    row = []
    for col in FEATURE_COLS:
        v = features.get(col, 0)
        if isinstance(v, bool):
            v = int(v)
        row.append(float(v))

    X = np.array([row])
    prob  = float(pipe.predict_proba(X)[0][1])
    label = int(prob >= 0.5)
    risk  = ('critical' if prob >= 0.75 else
             'high'     if prob >= 0.5  else
             'medium'   if prob >= 0.25 else 'low')
    conf  = round(max(prob, 1 - prob), 4)
    return {
        'deviation_prob': round(prob, 4),
        'label':          label,
        'risk_level':     risk,
        'confidence':     conf,
        'model_used':     meta.get('model_name', 'unknown'),
    }
