# app/main.py
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI,HTTPException
from backend.mongo.main import mongodb

import threading
import time

from backend.api.router import api_router


# ────────────────────────────────────────────────────────────
# Background Sensor Sync (REALTIME CACHE)
# ────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 Starting background Dropbox sensor sync...")

    from backend.dropbox import service as dropbox_service

    stop_flag = {"stop": False}

    def sync_loop():
        while not stop_flag["stop"]:
            try:
                dropbox_service.refresh_sensor_cache(
                    limit=1000,        # เก็บข้อมูลล่าสุด 1,000 แถว
                    interval="5min"    # aggregate ราย 5 นาที
                )
            except Exception as e:
                print(f"⚠️ Error refreshing sensor cache: {e}")

            time.sleep(60)  # Sync ทุก 60 วินาที

    thread = threading.Thread(target=sync_loop, daemon=True)
    thread.start()

    yield  # แอปพร้อมให้บริการ

    print("👋 Shutting down background Dropbox sensor sync...")
    stop_flag["stop"] = True
    time.sleep(1)


# ────────────────────────────────────────────────────────────
# FastAPI Application
# ────────────────────────────────────────────────────────────
app = FastAPI(
    title="Decarbonator3000",
    lifespan=lifespan,
)


# ────────────────────────────────────────────────────────────
# CORS (Frontend Dev)
# ────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ────────────────────────────────────────────────────────────
# Routers
# ────────────────────────────────────────────────────────────
app.include_router(api_router)


# ────────────────────────────────────────────────────────────
# Health Check
# ────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/db-info")
async def get_database_info():
    try:
        database = await mongodb.get_database()
        collections = await database.list_collection_names()
        return {
            "database_name": "aiot",
            "collections": collections,
            "collections_count": len(collections)
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Error getting database info: {str(e)}"
        )

@app.get("/plants/all")
async def get_all_plants():
    """Get all plants from database"""
    try:
        database = await mongodb.get_database()
        plants_collection = database["plant"]
        
        plants = []
        async for plant in plants_collection.find():
            # Convert ObjectId to string
            plant["id"] = str(plant.pop("_id"))
            plants.append(plant)
        
        return {
            "success": True,
            "count": len(plants),
            "plants": plants
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Error getting plants: {str(e)}"
        )


