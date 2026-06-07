"""
ocr_engine.py — OCR text extraction using EasyOCR.

EasyOCR is a pure-Python OCR library with no system binary dependencies.
It works on Render free tier without apt-get / Tesseract installation.

Falls back to empty OCRResult on failure so the pipeline never crashes.
"""

import logging
import io
from typing import Optional

from PIL import Image, UnidentifiedImageError

from app.schemas.models import OCRResult, OCRWord, BoundingBox, OCRError

logger = logging.getLogger(__name__)

# Lazy-load the EasyOCR reader to avoid slow import at startup
_reader = None

def _get_reader():
    global _reader
    if _reader is None:
        try:
            import easyocr
            # gpu=False — Render free tier has no GPU
            _reader = easyocr.Reader(['en'], gpu=False, verbose=False)
            logger.info("[ocr_engine] EasyOCR reader initialised.")
        except Exception as e:
            logger.error("[ocr_engine] Failed to initialise EasyOCR: %s", e)
            raise OCRError(f"OCR engine failed to initialise: {e}", stage="ocr_init") from e
    return _reader


def extract_text(image_path: str) -> OCRResult:
    """
    Extract text and bounding boxes from an image file using EasyOCR.
    Returns OCRResult with words and full text.
    Raises OCRError on failure.
    """
    try:
        reader = _get_reader()

        # EasyOCR returns: [[bbox, text, confidence], ...]
        # bbox is [[x1,y1],[x2,y1],[x2,y2],[x1,y2]]
        results = reader.readtext(image_path, detail=1)

        words = []
        full_text_parts = []

        for (bbox, text, confidence) in results:
            text = text.strip()
            if not text:
                continue

            # Convert polygon bbox to x,y,width,height
            xs = [pt[0] for pt in bbox]
            ys = [pt[1] for pt in bbox]
            x = float(min(xs))
            y = float(min(ys))
            w = float(max(xs) - min(xs))
            h = float(max(ys) - min(ys))

            full_text_parts.append(text)
            words.append(OCRWord(
                text=text,
                confidence=float(confidence) * 100,  # normalise to 0-100
                bbox=BoundingBox(x=x, y=y, width=w, height=h),
            ))

        logger.info("[ocr_engine] Extracted %d words from %s", len(words), image_path)
        return OCRResult(text=" ".join(full_text_parts), words=words)

    except OCRError:
        raise
    except (FileNotFoundError, UnidentifiedImageError, OSError) as exc:
        raise OCRError(
            message=f"Failed to open image '{image_path}': {exc}",
            stage="ocr",
        ) from exc
    except Exception as exc:
        raise OCRError(
            message=f"Unexpected OCR failure for '{image_path}': {exc}",
            stage="ocr",
        ) from exc


def extract_text_from_bytes(image_bytes: bytes, filename: str = "upload.png") -> OCRResult:
    """
    Extract text from raw image bytes (for in-memory uploads).
    Writes to a temp file, runs OCR, cleans up.
    """
    import tempfile
    import os

    suffix = os.path.splitext(filename)[1] or ".png"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(image_bytes)
        tmp_path = tmp.name

    try:
        return extract_text(tmp_path)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
