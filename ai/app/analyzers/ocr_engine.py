"""
ocr_engine.py — Text extraction using Gemini Vision API.

Replaces EasyOCR which requires downloading 100MB+ model files on first run
(causes timeouts on Render free tier cold starts).

Gemini Vision is called with the image bytes and extracts all visible text
including prices, countdown text, button labels, and UI copy.
Falls back to empty OCRResult on failure — pipeline continues with heuristics.
"""

import logging
import os
import base64
from typing import Optional

from app.schemas.models import OCRResult, OCRWord, BoundingBox, OCRError

logger = logging.getLogger(__name__)

DEFAULT_BBOX = BoundingBox(x=0.0, y=0.0, width=0.0, height=0.0)


def _extract_text_gemini_vision(image_bytes: bytes, mimetype: str = "image/png") -> str:
    """
    Use Gemini Vision to extract all visible text from an image.
    Returns the raw text string, or empty string on failure.
    """
    try:
        import google.generativeai as genai

        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
        model = genai.GenerativeModel("gemini-2.5-flash")

        # Encode as base64 for inline image data
        b64_data = base64.b64encode(image_bytes).decode("utf-8")

        prompt = (
            "Extract ALL visible text from this image exactly as it appears. "
            "Include: button labels, price text, countdown text, headings, "
            "body copy, disclaimers, urgency messages, checkbox labels, "
            "and any other text visible on screen. "
            "Return the text as plain lines, one piece of text per line. "
            "Do not describe the image — only output the extracted text."
        )

        response = model.generate_content([
            {"mime_type": mimetype, "data": b64_data},
            prompt,
        ])

        return response.text or ""

    except Exception as exc:
        logger.warning("[ocr_engine] Gemini Vision extraction failed: %s", exc)
        return ""


def _words_from_text(text: str) -> list[OCRWord]:
    """Convert extracted text string to OCRWord list with default bboxes."""
    words = []
    for word in text.split():
        word = word.strip()
        if word:
            words.append(OCRWord(text=word, confidence=0.95, bbox=DEFAULT_BBOX))
    return words


def extract_text(image_path: str) -> OCRResult:
    """
    Extract text from an image file using Gemini Vision.
    Reads file bytes, passes to Gemini, returns OCRResult.
    """
    try:
        with open(image_path, "rb") as f:
            image_bytes = f.read()

        # Detect mimetype from extension
        ext = os.path.splitext(image_path)[1].lower()
        mime_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
        mimetype = mime_map.get(ext, "image/png")

        text = _extract_text_gemini_vision(image_bytes, mimetype)
        words = _words_from_text(text)

        logger.info("[ocr_engine] Extracted %d words via Gemini Vision from %s", len(words), image_path)
        return OCRResult(text=text, words=words)

    except (FileNotFoundError, OSError) as exc:
        raise OCRError(f"Failed to open image '{image_path}': {exc}", stage="ocr") from exc
    except Exception as exc:
        logger.error("[ocr_engine] OCR failed for %s: %s", image_path, exc)
        # Return empty result — pipeline continues with heuristics only
        return OCRResult(text="", words=[])


def extract_text_from_bytes(image_bytes: bytes, mimetype: str = "image/png", filename: str = "upload.png") -> OCRResult:
    """
    Extract text directly from image bytes (for in-memory uploads).
    No temp file needed.
    """
    try:
        text = _extract_text_gemini_vision(image_bytes, mimetype)
        words = _words_from_text(text)
        logger.info("[ocr_engine] Extracted %d words via Gemini Vision from bytes", len(words))
        return OCRResult(text=text, words=words)
    except Exception as exc:
        logger.error("[ocr_engine] OCR from bytes failed: %s", exc)
        return OCRResult(text="", words=[])
