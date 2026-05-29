from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.analyze import router as analyze_router
from app.api.chat import router as chat_router
from app.api.report import (
    router as report_router
)

app = FastAPI(
    title="MIRROR X AI Service",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze_router)
app.include_router(chat_router)
app.include_router(
    report_router
)

@app.get("/")
async def root():
    return {
        "success": True,
        "message": "MIRROR X AI Service Running"
    }

@app.get("/health")
async def health():
    return {
        "status": "ok"
    }