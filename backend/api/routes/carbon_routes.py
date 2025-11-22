from fastapi import APIRouter, Query
from typing import Optional, Literal
import asyncio
from concurrent.futures import ThreadPoolExecutor

from backend.dropbox import service as dropbox_service


router = APIRouter(prefix="/carbon", tags=["carbon"])


# ============================================================
#                       CO2 SECTION
# ============================================================
executor = ThreadPoolExecutor(max_workers=4)

@router.get("/co2/all", summary="CO2 raw data from WISE-4051 (all)")
async def co2_all_raw(
    limit: Optional[int] = Query(100, ge=1, le=166740, description="Limit number of results"),
    interval: Optional[Literal["raw", "1min", "5min", "15min", "30min", "1hour"]] = Query("5min", description="Data aggregation interval")
):
    # Run the blocking Dropbox/pandas operations in a thread pool
    loop = asyncio.get_event_loop()
    data = await loop.run_in_executor(
        executor,
        dropbox_service.get_co2_all_raw,
        limit,
        interval
    )
    return data

@router.get("/co2/hourly", summary="CO2 hourly average from WISE-4051")
def co2_hourly():
    return dropbox_service.get_co2_all_hourly()


@router.get("/co2/daily", summary="CO2 daily average from WISE-4051")
def co2_daily():
    return dropbox_service.get_co2_daily()


@router.get("/co2/count", summary="Count CO2 records quickly")
def co2_count():
    df = dropbox_service.read_all_csv_under(dropbox_service.WISE4051_ROOT)
    return {"rows": int(len(df))}


@router.get("/co2/page", summary="CO2 page-by-page for large datasets")
def co2_page(skip: int = 0, limit: int = 500):
    df = dropbox_service.read_all_csv_under(dropbox_service.WISE4051_ROOT)
    part = df.iloc[skip: skip + limit]
    return part.to_dict(orient="records")


@router.get("/co2/debug", summary="CO2 debug (sample, rows, columns)")
def co2_debug():
    try:
        df = dropbox_service.read_all_csv_under(dropbox_service.WISE4051_ROOT)
        return {
            "rows": int(len(df)),
            "columns": list(df.columns),
            "sample": df.head(5).to_dict(orient="records"),
        }
    except Exception as e:
        return {"error": str(e)}


# ============================================================
#                   TEMPERATURE SECTION
# ============================================================

@router.get("/temp/all", summary="Temperature raw data from WISE-4012 (all)")
def temp_all_raw():
    return dropbox_service.get_temp_all_raw()


@router.get("/temp/hourly", summary="Temperature hourly average from WISE-4012")
def temp_hourly():
    return dropbox_service.get_temp_all_hourly()


@router.get("/temp/daily", summary="Temperature daily average from WISE-4012")
def temp_daily():
    return dropbox_service.get_temp_daily()


@router.get("/temp/count", summary="Count temp records quickly")
def temp_count():
    df = dropbox_service.read_all_csv_under(dropbox_service.WISE4012_ROOT)
    return {"rows": int(len(df))}


@router.get("/temp/page", summary="Temperature data by page")
def temp_page(skip: int = 0, limit: int = 500):
    df = dropbox_service.read_all_csv_under(dropbox_service.WISE4012_ROOT)
    part = df.iloc[skip: skip + limit]
    return part.to_dict(orient="records")


@router.get("/temp/debug", summary="Temperature debug (sample, rows, columns)")
def temp_debug():
    try:
        df = dropbox_service.read_all_csv_under(dropbox_service.WISE4012_ROOT)
        return {
            "rows": int(len(df)),
            "columns": list(df.columns),
            "sample": df.head(5).to_dict(orient="records"),
        }
    except Exception as e:
        return {"error": str(e)}


# ============================================================
#                     HUMIDITY SECTION
# ============================================================

@router.get("/humid/all", summary="Humidity raw data from WISE-4012 (all)")
def humid_all_raw():
    return dropbox_service.get_humid_all_raw()


@router.get("/humid/hourly", summary="Humidity hourly average from WISE-4012")
def humid_hourly():
    return dropbox_service.get_humid_all_hourly()


@router.get("/humid/daily", summary="Humidity daily average from WISE-4012")
def humid_daily():
    return dropbox_service.get_humid_daily()


@router.get("/humid/count", summary="Count humidity records quickly")
def humid_count():
    df = dropbox_service.read_all_csv_under(dropbox_service.WISE4012_ROOT)
    return {"rows": int(len(df))}


@router.get("/humid/page", summary="Humidity data page-by-page")
def humid_page(skip: int = 0, limit: int = 500):
    df = dropbox_service.read_all_csv_under(dropbox_service.WISE4012_ROOT)
    part = df.iloc[skip: skip + limit]
    return part.to_dict(orient="records")


@router.get("/humid/debug", summary="Humidity debug (sample, rows, columns)")
def humid_debug():
    try:
        df = dropbox_service.read_all_csv_under(dropbox_service.WISE4012_ROOT)
        return {
            "rows": int(len(df)),
            "columns": list(df.columns),
            "sample": df.head(5).to_dict(orient="records"),
        }
    except Exception as e:
        return {"error": str(e)}