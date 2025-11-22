# backend/dropbox/service.py

import io
from typing import List, Dict, Optional, Literal
from datetime import timedelta

import dropbox
import pandas as pd
import numpy as np  

from backend.dropbox.env import DROPBOX_TOKEN, WISE4051_ROOT, WISE4012_ROOT

CO2_COL = "COM_1 Wd_0"
TEMP_COL = "COM_1 Wd_1"
HUMID_COL = "COM_1 Wd_2"

# Cache to avoid re-reading from Dropbox every time
_cache = {}

def get_client() -> dropbox.Dropbox:
    return dropbox.Dropbox(DROPBOX_TOKEN)


def list_date_folders(root_path: str) -> List[str]:
    dbx = get_client()
    res = dbx.files_list_folder(root_path)
    folders: List[str] = []

    while True:
        for entry in res.entries:
            if isinstance(entry, dropbox.files.FolderMetadata):
                path = entry.path_lower or entry.path_display
                folders.append(path)
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
                path = entry.path_lower or entry.path_display
                files.append(path)
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
    if "timestamp" in df.columns:
        return df

    # เคส WISE-4051: มีคอลัมน์ TIM เป็น ISO time เช่น 2025-11-18T14:44:23+07:00
    if "TIM" in df.columns:
        df["timestamp"] = pd.to_datetime(df["TIM"], errors="coerce")
        if df["timestamp"].isna().all():
            raise ValueError("TIM column exists but cannot parse timestamps")
        return df

    year_cols = ["Year", "YEAR", "year"]
    month_cols = ["Month", "MONTH", "month"]
    day_cols = ["Day", "DAY", "day"]
    hour_cols = ["Hour", "HOUR", "hour"]
    minute_cols = ["Minute", "MINUTE", "minute"]
    second_cols = ["Second", "SECOND", "second"]

    def pick(cols):
        for c in cols:
            if c in df.columns:
                return c
        return None

    y_col = pick(year_cols)
    m_col = pick(month_cols)
    d_col = pick(day_cols)
    h_col = pick(hour_cols)
    mn_col = pick(minute_cols)
    s_col = pick(second_cols)

    if y_col and m_col and d_col and h_col and mn_col and s_col:
        df["timestamp"] = pd.to_datetime(
            dict(
                year=df[y_col],
                month=df[m_col],
                day=df[d_col],
                hour=df[h_col],
                minute=df[mn_col],
                second=df[s_col],
            ),
            errors="coerce",
        )
        return df

    if "Time" in df.columns:
        df["timestamp"] = pd.to_datetime(df["Time"], errors="coerce")
        return df

    raise ValueError("Cannot build timestamp column from CSV (no usable time columns)")


def read_all_csv_under(root_path: str, use_cache: bool = True, skip_old_data: bool = True) -> pd.DataFrame:
    # Use cache to avoid re-reading from Dropbox
    if use_cache and root_path in _cache:
        print(f"✅ Using cached data for {root_path}")
        return _cache[root_path]
    
    print(f"📥 Reading from Dropbox: {root_path}")
    dbx = get_client()
    all_rows: List[pd.DataFrame] = []

    folders = list_date_folders(root_path)
    
    # OPTIMIZATION: Only read recent folders if skip_old_data=True
    if skip_old_data and len(folders) > 7:
        # Only read last 7 days of data
        folders = sorted(folders)[-7:]
        print(f"⚡ Skipping old data, reading last {len(folders)} folders")
    
    for folder in folders:
        csv_files = list_csv_files(dbx, folder)
        for path in csv_files:
            try:
                df = download_csv_to_df(dbx, path)
                df = add_timestamp_column(df)
                all_rows.append(df)
            except Exception as e:
                print(f"⚠️ Failed to read {path}: {e}")
                continue

    if not all_rows:
        return pd.DataFrame()

    print(f"🔄 Concatenating {len(all_rows)} dataframes...")
    df_all = pd.concat(all_rows, ignore_index=True)
    df_all = df_all.sort_values("timestamp").reset_index(drop=True)
    
    # Cache the result
    if use_cache:
        _cache[root_path] = df_all
        print(f"💾 Cached {len(df_all)} rows")
    
    return df_all

# ---------- helper: clean NaN ก่อนส่งออก JSON ----------

def df_to_records(df: pd.DataFrame) -> List[Dict]:
    """
    แปลง DataFrame -> list[dict] โดยแปลง NaN เป็น None
    เพื่อให้ JSON encoder ของ FastAPI handle ได้
    """
    if df.empty:
        return []
    df_clean = df.replace({np.nan: None})
    return df_clean.to_dict(orient="records")


# ---------- NEW: Aggregation function ----------

def aggregate_data(
    df: pd.DataFrame, 
    interval: Literal["1min", "5min", "15min", "30min", "1hour"]
) -> pd.DataFrame:
    """Aggregate sensor data by time interval"""
    if df.empty:
        return df
    
    # Map interval to pandas frequency string
    freq_map = {
        "1min": "1min",
        "5min": "5min",
        "15min": "15min",
        "30min": "30min",
        "1hour": "1h"
    }
    
    freq = freq_map.get(interval, "5min")
    
    # Separate numeric and non-numeric columns
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    
    # Keep timestamp and numeric columns only for aggregation
    df_numeric = df[['timestamp'] + numeric_cols].copy()
    
    # Group by time interval and calculate mean (only numeric columns)
    df_agg = df_numeric.set_index("timestamp").resample(freq).mean().reset_index()
    
    # Add back non-numeric columns (take first value in each group)
    non_numeric_cols = df.select_dtypes(exclude=[np.number]).columns.tolist()
    if non_numeric_cols:
        # Remove 'timestamp' if it's in the list
        non_numeric_cols = [col for col in non_numeric_cols if col != 'timestamp']
        
        if non_numeric_cols:
            df_non_numeric = df[['timestamp'] + non_numeric_cols].copy()
            df_non_numeric_agg = (
                df_non_numeric.set_index("timestamp")
                .resample(freq)
                .first()
                .reset_index()
            )
            # Merge numeric and non-numeric
            df_agg = df_agg.merge(df_non_numeric_agg, on='timestamp', how='left')
    
    # Round numeric columns to reasonable precision
    numeric_cols_in_result = df_agg.select_dtypes(include=[np.number]).columns
    df_agg[numeric_cols_in_result] = df_agg[numeric_cols_in_result].round(2)
    
    return df_agg

def group_hourly(df: pd.DataFrame, value_col: str) -> List[Dict]:
    if df.empty or value_col not in df.columns:
        return []

    grouped = (
        df.groupby(df["timestamp"].dt.floor("h"))[value_col]
        .mean()
        .reset_index()
        .rename(columns={"timestamp": "time", value_col: "value"})
    )
    grouped["time"] = grouped["time"].dt.strftime("%Y-%m-%d %H:%M:%S")
    return df_to_records(grouped)


def group_daily(df: pd.DataFrame, value_col: str) -> List[Dict]:
    if df.empty or value_col not in df.columns:
        return []

    df["date"] = df["timestamp"].dt.date
    grouped = (
        df.groupby("date")[value_col]
        .mean()
        .reset_index()
        .rename(columns={value_col: "value"})
    )
    grouped["date"] = grouped["date"].astype(str)
    return df_to_records(grouped)


# ---------- CO2 (WISE-4051) ----------

def get_co2_all_raw(
    limit: Optional[int] = None,
    interval: Optional[Literal["raw", "1min", "5min", "15min", "30min", "1hour"]] = "raw"
) -> List[Dict]:
    df = read_all_csv_under(WISE4051_ROOT)
    
    # Apply aggregation if requested
    if interval != "raw":
        df = aggregate_data(df, interval)
    
    # Apply limit (get last N records)
    if limit is not None and limit > 0:
        df = df.tail(limit)
    
    return df_to_records(df)


def get_co2_all_hourly() -> List[Dict]:
    df = read_all_csv_under(WISE4051_ROOT)
    return group_hourly(df, CO2_COL)


def get_co2_daily() -> List[Dict]:
    df = read_all_csv_under(WISE4051_ROOT)
    return group_daily(df, CO2_COL)


# ---------- Temperature (WISE-4012) ----------

def get_temp_all_raw() -> List[Dict]:
    df = read_all_csv_under(WISE4012_ROOT)
    return df_to_records(df)


def get_temp_all_hourly() -> List[Dict]:
    df = read_all_csv_under(WISE4012_ROOT)
    return group_hourly(df, TEMP_COL)


def get_temp_daily() -> List[Dict]:
    df = read_all_csv_under(WISE4012_ROOT)
    return group_daily(df, TEMP_COL)


# ---------- Humidity (WISE-4012) ----------

def get_humid_all_raw() -> List[Dict]:
    df = read_all_csv_under(WISE4012_ROOT)
    return df_to_records(df)


def get_humid_all_hourly() -> List[Dict]:
    df = read_all_csv_under(WISE4012_ROOT)
    return group_hourly(df, HUMID_COL)


def get_humid_daily() -> List[Dict]:
    df = read_all_csv_under(WISE4012_ROOT)
    return group_daily(df, HUMID_COL)


# ---------- Cache management ----------

def clear_cache():
    """Clear the data cache - call this when new data is added"""
    global _cache
    _cache = {}