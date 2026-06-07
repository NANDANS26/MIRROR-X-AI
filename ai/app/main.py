"""
main.py — FastAPI application entry point for MIRROR X AI service.

Registered endpoints:
  POST /analyze/upload   — Analyze uploaded screenshot
  POST /analyze/url      — Analyze scraped URL data
  POST /simulate         — Behavioral simulation for personas
  POST /score            — Risk score computation
  POST /chat/explain     — AI_Investigator conversational response
  POST /report/generate  — PDF forensic report generation
  GET  /health           — Health check
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.analyze import router as analyze_router
from app.api.chat import router as chat_router
from app.api.report import router as report_router
from app.api.simulate import router as simulate_router
from app.api.score import router as score_router

app = FastAPI(
    title="MIRROR X AI Service",
    version="1.0.0",
    description="AI-powered digital manipulation investigator microservice.",
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
app.include_router(report_router)
app.include_router(simulate_router)
app.include_router(score_router)


@app.get("/")
async def root():
    return {
        "success": True,
        "message": "MIRROR X AI Service Running",
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
