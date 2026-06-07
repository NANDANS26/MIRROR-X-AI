"""
score.py — Risk scoring endpoint for MIRROR X AI service.

POST /score — Compute Manipulation, Trust, Friction scores and UX Fairness Index.

Validates: Requirements 5.1–5.5
"""

from fastapi import APIRouter

from app.schemas.models import ScoreRequest, AnalysisScores
from app.scoring.scoring_engine import compute_scores

router = APIRouter()


@router.post("/score", response_model=AnalysisScores)
async def score(body: ScoreRequest):
    """Compute risk scores for a list of detected dark patterns."""
    return compute_scores(body.detected_patterns)
