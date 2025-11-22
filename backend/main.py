# app/main.py
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware

from fastapi import FastAPI

from backend.api.router import api_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load data into cache on startup
    print("🚀 Warming up cache...")
    import threading
    
    def load_cache():
        from backend.dropbox import service as dropbox_service
        dropbox_service.get_co2_all_raw(limit=1000, interval="5min")
        print("✅ Cache warmed up!")
    
    thread = threading.Thread(target=load_cache)
    thread.start()
    
    yield
    # Cleanup on shutdown
    print("👋 Shutting down...")

app = FastAPI(title="Decarbonator3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "http://127.0.0.1:3000"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
def health():
    return {"status": "ok"}
