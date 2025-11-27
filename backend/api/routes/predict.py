import io
import warnings
import os
from typing import List, Dict, Optional, Literal, Any
from datetime import datetime

import dropbox
import pandas as pd
import numpy as np
from autogluon.tabular import TabularPredictor
from sklearn.preprocessing import StandardScaler

# --- Environment Variables (Assumed to be defined in backend.dropbox.env) ---
from backend.dropbox.env import DROPBOX_TOKEN, WISE4051_ROOT, WISE4012_ROOT

# Suppress AutoGluon/Pandas warnings during inference
warnings.filterwarnings('ignore', category=UserWarning)
warnings.filterwarnings('ignore', category=FutureWarning)

# ─────────────────────────────────────────────────────────────
# AI Configuration
# ─────────────────────────────────────────────────────────────

# NOTE: These paths must be accessible relative to where the service is run
MODEL_PATH_RATE_CHANGE = './autogluon_models_rate_change'
MODEL_PATH_RATE_PER_HOUR = './autogluon_models_rate_per_hour'

# Define the numerical features that were scaled during training
SCALED_NUMERICAL_FEATURES = [
    'Temp', 'Humidity', 'light_intensity', 'lux',
    'instantaneous_rate_change', 'instantaneous_rate_per_hour',
    'carbon_lag1', 'carbon_lag2', 'carbon_lag3', 'carbon_lag4', 'carbon_lag5',
    'carbon_rolling_mean_3', 'carbon_rolling_std_3', 'carbon_rolling_min_3', 'carbon_rolling_max_3',
    'carbon_rolling_mean_5', 'carbon_rolling_std_5', 'carbon_rolling_min_5', 'carbon_rolling_max_5',
    'carbon_rolling_mean_10', 'carbon_rolling_std_10', 'carbon_rolling_min_10', 'carbon_rolling_max_10',
    'carbon_lag1_diff', 'carbon_lag2_diff',
    'temp_humidity_interaction', 'comfort_index',
    'carbon_zscore'
]

# Define the final features used by the model
FINAL_FEATURE_COLUMNS = [
    'Temp', 'Humidity', 'light_intensity', 'lux',
    'instantaneous_rate_change', 'instantaneous_rate_per_hour',
    'hour', 'day_of_week', 'minute', 'is_weekend', 'time_of_day',
    'carbon_lag1', 'carbon_lag2', 'carbon_lag3', 'carbon_lag4', 'carbon_lag5',
    'carbon_rolling_mean_3', 'carbon_rolling_std_3', 'carbon_rolling_min_3', 'carbon_rolling_max_3',
    'carbon_rolling_mean_5', 'carbon_rolling_std_5', 'carbon_rolling_min_5', 'carbon_rolling_max_5',
    'carbon_rolling_mean_10', 'carbon_rolling_std_10', 'carbon_rolling_min_10', 'carbon_rolling_max_10',
    'carbon_lag1_diff', 'carbon_lag2_diff',
    'temp_humidity_interaction', 'comfort_index',
    'light_category', 'hour_sin', 'hour_cos', 'day_sin', 'day_cos', 'carbon_zscore'
]

# Required by AutoGluon pipeline
AUTOGLUON_PIPELINE_REQUIREMENTS = ['light intensity', 'time_diff_hours']
PREDICTION_INPUT_COLUMNS = list(set(FINAL_FEATURE_COLUMNS + AUTOGLUON_PIPELINE_REQUIREMENTS))


# ─────────────────────────────────────────────────────────────
# Sensor Columns (from user's original snippet)
# ─────────────────────────────────────────────────────────────
CO2_COL = "COM_1 Wd_0"
TEMP_COL = "COM_1 Wd_1"
HUMID_COL = "COM_1 Wd_2"
LEAF_COL = "AI_0 Val"
GROUND_COL = "AI_1 Val"

# ─────────────────────────────────────────────────────────────
# CACHE
# ─────────────────────────────────────────────────────────────
_cache: Dict[str, pd.DataFrame] = {}
_sensor_cache = {
    "wise4051": {"data": None, "last_updated": None},
    "wise4012": {"data": None, "last_updated": None},
}


# ─────────────────────────────────────────────────────────────
# Dropbox Utils (kept as provided by user)
# ─────────────────────────────────────────────────────────────
def get_client() -> dropbox.Dropbox:
    return dropbox.Dropbox(DROPBOX_TOKEN)

def list_date_folders(root_path: str) -> List[str]:
    dbx = get_client()
    res = dbx.files_list_folder(root_path)
    folders: List[str] = []
    while True:
        for entry in res.entries:
            if isinstance(entry, dropbox.files.FolderMetadata):
                folders.append(entry.path_display)
        if not res.has_more:
            break
        res = dbx.files_list_folder_continue(res.cursor)
    return folders

def list_csv_files(dbx: dropbox.Dropbox, folder_path: str) -> List[str]:
    res = dbx.files_list_folder(folder_path)
    files: List[str] = []
    while True:
        for entry in res.entries:
            if isinstance(entry, dropbox.files.FileMetadata) and entry.name.lower().endswith(
                ".csv"
            ):
                files.append(entry.path_display)
        if not res.has_more:
            break
        res = dbx.files_list_folder_continue(res.cursor)
    return files

def download_csv_to_df(dbx: dropbox.Dropbox, file_path: str) -> pd.DataFrame:
    _, resp = dbx.files_download(file_path)
    content = resp.content.decode("utf-8", errors="ignore")
    df = pd.read_csv(io.StringIO(content))
    return df

def add_timestamp_column(df: pd.DataFrame) -> pd.DataFrame:
    # Logic to create 'timestamp' column from various formats...
    if "timestamp" in df.columns:
        return df
    if "TIM" in df.columns:
        df["timestamp"] = pd.to_datetime(df["TIM"], errors="coerce")
        return df

    cols = {
        "year": ["Year", "YEAR", "year"],
        "month": ["Month", "MONTH", "month"],
        "day": ["Day", "DAY", "day"],
        "hour": ["Hour", "HOUR", "hour"],
        "minute": ["Minute", "MINUTE", "minute"],
        "second": ["Second", "SECOND", "second"],
    }
    def pick(name):
        for c in cols[name]:
            if c in df.columns:
                return c
        return None
    y, m, d = pick("year"), pick("month"), pick("day")
    h, mn, s = pick("hour"), pick("minute"), pick("second")
    if all([y, m, d, h, mn, s]):
        df["timestamp"] = pd.to_datetime(
            dict(
                year=df[y], month=df[m], day=df[d],
                hour=df[h], minute=df[mn], second=df[s],
            ),
            errors="coerce",
        )
        return df
    if "Time" in df.columns:
        df["timestamp"] = pd.to_datetime(df["Time"], errors="coerce")
        return df
    raise ValueError("Cannot detect timestamp columns in CSV.")

def read_all_csv_under(
    root_path: str,
    use_cache: bool = True,
    skip_old_data: bool = True,
) -> pd.DataFrame:
    if use_cache and root_path in _cache:
        print(f"✅ Using cached data for {root_path}")
        return _cache[root_path]

    print(f"📥 Reading fresh data from Dropbox: {root_path}")
    dbx = get_client()
    all_rows: List[pd.DataFrame] = []
    folders = list_date_folders(root_path)
    if skip_old_data and len(folders) > 7:
        folders = sorted(folders)[-7:]

    for folder in folders:
        csv_files = list_csv_files(dbx, folder)
        for file_path in csv_files:
            try:
                df = download_csv_to_df(dbx, file_path)
                df = add_timestamp_column(df)
                all_rows.append(df)
            except Exception as e:
                print(f"⚠️ Failed to read {file_path}: {e}")

    if not all_rows:
        return pd.DataFrame()

    print(f"🔄 Concatenating {len(all_rows)} dataframes...")
    df_all = pd.concat(all_rows, ignore_index=True)
    df_all = df_all.sort_values("timestamp").reset_index(drop=True)

    if use_cache:
        _cache[root_path] = df_all
        print(f"💾 Cached {len(df_all)} rows")

    return df_all

# ─────────────────────────────────────────────────────────────
# AI FEATURE ENGINEERING (Restored the safe version)
# ─────────────────────────────────────────────────────────────
def create_advanced_features(df: pd.DataFrame) -> pd.DataFrame:
    """Create sophisticated features for carbon prediction WITHOUT data leakage"""
    df = df.copy()

    # Rename 'timestamp' to 'TIM' for consistency with training
    df = df.rename(columns={'timestamp': 'TIM'})

    # Ensure 'TIM' is datetime and sort
    df['TIM'] = pd.to_datetime(df['TIM'])
    df = df.sort_values('TIM').reset_index(drop=True)

    # Calculate instantaneous changes (mandatory for AutoGluon pipeline)
    df['instantaneous_rate_change'] = df['carbon'].diff()
    df['time_diff_hours'] = df['TIM'].diff().dt.total_seconds() / 3600
    df['instantaneous_rate_per_hour'] = df['instantaneous_rate_change'] / df['time_diff_hours'].replace(0, np.nan)
    df['time_diff_hours'] = df['time_diff_hours'].fillna(0.0) # Fill first row NaN

    # Required by AutoGluon pipeline (renaming)
    if 'light_intensity' in df.columns and 'light intensity' not in df.columns:
        df['light intensity'] = df['light_intensity']

    # Basic time features
    df['hour'] = df['TIM'].dt.hour
    df['day_of_week'] = df['TIM'].dt.dayofweek
    df['minute'] = df['TIM'].dt.minute
    df['is_weekend'] = (df['day_of_week'] >= 5).astype(int)

    # Time of day categories
    df['time_of_day'] = pd.cut(df['hour'],
                                 bins=[0, 6, 12, 18, 24],
                                 labels=['night', 'morning', 'afternoon', 'evening'],
                                 right=False,
                                 include_lowest=True)

    # Carbon-based features (using only PAST information - CRITICAL SHIFT(1))
    df['carbon_lag1'] = df['carbon'].shift(1)
    df['carbon_lag2'] = df['carbon'].shift(2)
    df['carbon_lag3'] = df['carbon'].shift(3)
    df['carbon_lag4'] = df['carbon'].shift(4)
    df['carbon_lag5'] = df['carbon'].shift(5)

    # Rolling statistics (using only PAST information - CRITICAL SHIFT(1))
    for window in [3, 5, 10]:
        df[f'carbon_rolling_mean_{window}'] = df['carbon'].rolling(window=window).mean().shift(1)
        df[f'carbon_rolling_std_{window}'] = df['carbon'].rolling(window=window).std().shift(1)
        df[f'carbon_rolling_min_{window}'] = df['carbon'].rolling(window=window).min().shift(1)
        df[f'carbon_rolling_max_{window}'] = df['carbon'].rolling(window=window).max().shift(1)

    # Safe lagged differences
    df['carbon_lag1_diff'] = df['carbon_lag1'] - df['carbon_lag2']
    df['carbon_lag2_diff'] = df['carbon_lag2'] - df['carbon_lag3']

    # Interaction features
    if 'Temp' in df.columns and 'Humidity' in df.columns:
        df['temp_humidity_interaction'] = df['Temp'] * df['Humidity']
        df['comfort_index'] = 0.5 * (df['Temp'] + df['Humidity'])

    # Light intensity category
    if 'light_intensity' in df.columns:
        df['light_category'] = pd.cut(df['light_intensity'],
                                     bins=[0, 100, 500, 1000, float('inf')],
                                     labels=['dark', 'low', 'medium', 'bright'],
                                     right=False,
                                     include_lowest=True)

    # Cyclical time features
    df['hour_sin'] = np.sin(2 * np.pi * df['hour']/24)
    df['hour_cos'] = np.cos(2 * np.pi * df['hour']/24)
    df['day_sin'] = np.sin(2 * np.pi * df['day_of_week']/7)
    df['day_cos'] = np.cos(2 * np.pi * df['day_of_week']/7)

    # Statistical features
    df['carbon_zscore'] = (df['carbon'] - df['carbon'].mean()) / df['carbon'].std()

    return df

# ─────────────────────────────────────────────────────────────
# AI SERVICE FUNCTION FOR FASTAPI
# ─────────────────────────────────────────────────────────────
def get_carbon_prediction(force_refresh: bool = False) -> Dict[str, Any]:
    """
    Loads historical data, engineers features, and makes a dual-target carbon prediction.
    """
    try:
        # 1. Load Data from Dropbox (using the user's utility)
        df_raw = read_all_csv_under(WISE4051_ROOT, use_cache=not force_refresh)

        if df_raw.empty:
            return {"error": "Failed to load any data from Dropbox."}

        # 2. Data Cleaning and Renaming (from user's prepare_df logic)
        df_clean = df_raw.drop(columns=[
            "COM_1 Wd_0 Evt","COM_1 Wd_1 Evt","COM_1 Wd_2 Evt",
            "COM_1 Wd_3","COM_1 Wd_3 Evt","COM_1 Wd_4 Evt",
            "COM_1 Wd_5","COM_1 Wd_5 Evt","COM_1 Wd_6 Evt","COM_1 Wd_7","COM_1 Wd_7 Evt"
        ], errors='ignore')
        df_clean = df_clean.rename(columns={
            "COM_1 Wd_0": "carbon",
            "COM_1 Wd_1": "Temp",
            "COM_1 Wd_2": "Humidity",
            "COM_1 Wd_4": "light_intensity", # Use snake_case for internal consistency
            "COM_1 Wd_6": "lux"
        })

        # 3. Feature Engineering (Creates lags, rolling stats, etc.)
        df_processed = create_advanced_features(df_clean)

        # We need enough clean rows to calculate features for the very last row (T)
        rows_needed_for_features = 11
        df_final_input = df_processed.iloc[-rows_needed_for_features:].dropna().copy()

        if df_final_input.empty:
            return {"error": "Not enough historical data (need >10 clean rows) to calculate lag/rolling features."}

        # 4. Feature Scaling (REQUIRED)
        mock_scaler = StandardScaler()
        cols_to_fit = [col for col in SCALED_NUMERICAL_FEATURES if col in df_processed.columns]

        # Fit scaler on the full processed historical data, then transform the final input block
        mock_scaler.fit(df_processed[cols_to_fit])
        df_final_input[cols_to_fit] = mock_scaler.transform(df_final_input[cols_to_fit])

        # 5. Prepare Prediction Input (Always the last row)
        prediction_df = df_final_input.iloc[[-1]][PREDICTION_INPUT_COLUMNS]

        # 6. Load Models and Predict
        predictor_rc = TabularPredictor.load(MODEL_PATH_RATE_CHANGE)
        predictor_rph = TabularPredictor.load(MODEL_PATH_RATE_PER_HOUR)

        prediction_result_rc = predictor_rc.predict(prediction_df)
        prediction_result_rph = predictor_rph.predict(prediction_df)

        # 7. Extract Results
        current_carbon = df_clean['carbon'].iloc[-1]
        current_time = df_clean['timestamp'].iloc[-1]
        predicted_rc = prediction_result_rc.iloc[0]
        predicted_rph = prediction_result_rph.iloc[0]

        # 8. Return Structured Dictionary
        return {
            "timestamp_current": current_time.isoformat(),
            "carbon_current": float(current_carbon),
            "carbon_predicted_rate_change_5min": float(predicted_rc),
            "carbon_predicted_rate_per_hour": float(predicted_rph),
            "carbon_predicted_next_level": float(current_carbon + predicted_rc),
            "message": "Prediction successful."
        }

    except FileNotFoundError as e:
        return {"error": f"Model files not found. Ensure models are trained and present: {e}"}
    except Exception as e:
        # Log the full error in a real service
        print(f"Prediction Service Error: {e}")
        return {"error": f"An unexpected error occurred during prediction: {type(e).__name__}"}