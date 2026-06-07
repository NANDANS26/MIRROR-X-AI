"""
analyze.py — Analysis endpoints for MIRROR X AI service.

POST /analyze/upload — Analyze an uploaded image file.
POST /analyze/url   — Analyze a URL via scraped DOM/HTML data from the backend.

Pattern detection pipeline:
  1. OCR — extract text + word positions
  2. Rule engine — regex-based dark pattern flags (8 categories)
  3. Visual heuristics — layout/language visual manipulation signals (NO Gemini)
  4. Gemini — AI explanation of the combined flags (1 call, graceful fallback)
  5. Scoring — compute manipulation/trust/friction scores from all patterns

Validates: Requirements 1.2, 1.3, 3.1
"""

import logging
import os
from uuid import uuid4

from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel
from typing import List

from app.analyzers.ocr_engine import extract_text
from app.analyzers.rule_engine import analyze_content
from app.analyzers.analyzer import detect_patterns
from app.analyzers.visual_heuristics import run_visual_heuristics
from app.services.gemini_client import generate_ai_analysis
from app.scoring.scoring_engine import compute_scores
from app.schemas.models import OCRResult, OCRWord, BoundingBox, DetectedPattern

router = APIRouter()
logger = logging.getLogger(__name__)

UPLOAD_DIR = "temp_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

DEFAULT_BBOX = BoundingBox(x=0.0, y=0.0, width=0.0, height=0.0)


class UrlAnalysisRequest(BaseModel):
    dom_html: str = ""
    screenshot_path: str = ""
    page_title: str = ""
    meta_description: str = ""
    buttons: List[str] = []
    ocr_text: str = ""


def _ocr_from_text(text: str) -> OCRResult:
    """Build a synthetic OCRResult from a plain text string."""
    words = []
    for word_text in text.split():
        word_text = word_text.strip()
        if word_text:
            words.append(OCRWord(text=word_text, confidence=0.9, bbox=DEFAULT_BBOX))
    return OCRResult(text=text, words=words)


def _merge_patterns(
    rule_based: list[DetectedPattern],
    visual: list[DetectedPattern],
) -> list[DetectedPattern]:
    """
    Merge rule-engine patterns and visual heuristic patterns.
    Deduplicate by (category, element_identifier) — keep the higher-confidence one.
    """
    seen: dict[tuple, DetectedPattern] = {}
    confidence_rank = {"Low": 0, "Medium": 1, "High": 2}

    for p in rule_based + visual:
        key = (p.category, p.element_identifier)
        existing = seen.get(key)
        if existing is None:
            seen[key] = p
        else:
            # Keep the higher-confidence entry
            if confidence_rank.get(p.confidence_level, 0) > confidence_rank.get(existing.confidence_level, 0):
                seen[key] = p

    merged = list(seen.values())
    logger.info(
        "[analyze] Pattern merge: %d rule-based + %d visual = %d merged (deduped from %d)",
        len(rule_based),
        len(visual),
        len(merged),
        len(rule_based) + len(visual),
    )
    return merged


@router.post("/analyze/upload")
async def analyze_upload(file: UploadFile = File(...)):
    """Analyze an uploaded image file via OCR + rule engine + visual heuristics + Gemini."""
    ext = os.path.splitext(file.filename or "upload")[1] or ".png"
    stored_filename = f"{uuid4()}{ext}"
    file_path = os.path.join(UPLOAD_DIR, stored_filename)

    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())

    # 1. OCR
    ocr_result = extract_text(file_path)
    logger.info("[analyze/upload] OCR complete. text_length=%d words=%d",
                len(ocr_result.text), len(ocr_result.words))

    # 2. Rule engine
    rule_flags = analyze_content(ocr_result)
    logger.info("[analyze/upload] Rule engine: %d flags", len(rule_flags))

    # 3. Gemini-based pattern detection from rule flags
    rule_patterns = detect_patterns(ocr_result, rule_flags)

    # 4. Visual heuristics (no Gemini — pure OCR text analysis)
    visual_patterns = run_visual_heuristics(ocr_result)

    # 5. Merge and deduplicate
    detected_patterns_list = _merge_patterns(rule_patterns, visual_patterns)
    logger.info("[analyze/upload] Total patterns after merge: %d", len(detected_patterns_list))

    # 6. Gemini AI analysis (1 call, graceful fallback on failure)
    ai_analysis = generate_ai_analysis(ocr_result, rule_flags)

    # 7. Scoring
    scores = compute_scores(detected_patterns_list)

    return {
        "success": True,
        "screenshot_path": file_path,
        "ocr_result": ocr_result.model_dump(),
        "rule_flags": [flag.model_dump() for flag in rule_flags],
        "detected_patterns": [p.model_dump() for p in detected_patterns_list],
        "scores": scores.model_dump(),
        "ai_analysis": ai_analysis,
    }


@router.post("/analyze/url")
async def analyze_url(body: UrlAnalysisRequest):
    """Analyze a URL via scraped DOM + HTML data from the backend."""
    combined_text = " ".join(filter(None, [
        body.ocr_text,
        body.page_title,
        body.meta_description,
        " ".join(body.buttons),
    ]))
    ocr_result = _ocr_from_text(combined_text)
    logger.info("[analyze/url] Synthetic OCR. text_length=%d", len(combined_text))

    # 1. Rule engine (with DOM HTML for HTML-level detectors)
    rule_flags = analyze_content(ocr_result, dom_html=body.dom_html)
    logger.info("[analyze/url] Rule engine: %d flags", len(rule_flags))

    # 2. Gemini-based pattern detection
    rule_patterns = detect_patterns(ocr_result, rule_flags)

    # 3. Visual heuristics against the combined text
    visual_patterns = run_visual_heuristics(ocr_result)

    # 4. Merge
    detected_patterns_list = _merge_patterns(rule_patterns, visual_patterns)
    logger.info("[analyze/url] Total patterns after merge: %d", len(detected_patterns_list))

    # 5. AI analysis
    ai_analysis = generate_ai_analysis(ocr_result, rule_flags)

    # 6. Scoring
    scores = compute_scores(detected_patterns_list)

    return {
        "success": True,
        "screenshot_path": body.screenshot_path,
        "ocr_result": ocr_result.model_dump(),
        "rule_flags": [flag.model_dump() for flag in rule_flags],
        "detected_patterns": [p.model_dump() for p in detected_patterns_list],
        "scores": scores.model_dump(),
        "ai_analysis": ai_analysis,
    }
