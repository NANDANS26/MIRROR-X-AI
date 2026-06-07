"""
visual_heuristics.py — Visual dark pattern detection from OCR text + layout signals.

Detects manipulation patterns that are primarily visual rather than textual:

1. Countdown Timers       — urgency through time pressure
2. Pre-selected Checkboxes — coercion through assumed consent
3. Dominant Primary CTA   — visual steering through button asymmetry
4. Tiny Decline Links     — hidden opt-out, low-visibility alternatives
5. Price Anchoring        — reference pricing, crossed-out prices
6. Scarcity Messaging     — limited time / exclusive offer pressure
7. Visual Steering        — CTA prominence, color asymmetry signals

Each detector returns a list of DetectedPattern objects with:
  - category: the dark pattern type
  - element_identifier: what triggered the detection
  - confidence_level: Low / Medium / High
  - explanation: plain-English evidence description

These patterns are detected entirely from OCR text + layout — no Gemini call needed.
"""

import re
import logging
from typing import Optional

from app.schemas.models import (
    OCRResult,
    OCRWord,
    BoundingBox,
    DetectedPattern,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _confidence(score: int) -> str:
    if score >= 3:
        return "High"
    if score >= 2:
        return "Medium"
    return "Low"


def _pattern(
    category: str,
    identifier: str,
    confidence: str,
    explanation: str,
    bbox: Optional[BoundingBox] = None,
) -> DetectedPattern:
    return DetectedPattern(
        category=category,
        element_identifier=identifier,
        confidence_level=confidence,
        explanation=explanation,
        bounding_box=bbox,
    )


def _words_matching(ocr: OCRResult, patterns: list[str]) -> list[OCRWord]:
    """Return OCR words whose text matches any of the given regex patterns."""
    matches = []
    for word in ocr.words:
        for p in patterns:
            if re.search(p, word.text, re.IGNORECASE):
                matches.append(word)
                break
    return matches


def _full_text_matches(text: str, patterns: list[str]) -> int:
    """Count how many patterns match in the full OCR text."""
    return sum(1 for p in patterns if re.search(p, text, re.IGNORECASE))


# ---------------------------------------------------------------------------
# 1. Countdown Timer Detection
# ---------------------------------------------------------------------------

_COUNTDOWN_TIMER_PATTERNS = [
    r"\b(expires?\s+in|expiring\s+soon)\b",
    r"\bhurry\b",
    r"\bonly\s+\d+\s+(min|minute|sec|second|hour|hr)s?\b",
    r"\bcountdown\b",
    r"\btime\s+is\s+running\s+out\b",
    r"\blimited\s+time\s+offer\b",
    r"\b\d{1,2}\s*:\s*\d{2}\s*:\s*\d{2}\b",   # HH:MM:SS format
    r"\bminutes?\s+left\b",
    r"\bseconds?\s+left\b",
    r"\bends?\s+(today|tonight|soon)\b",
    r"\bdeal\s+ends?\b",
    r"\boffer\s+expires?\b",
]

def detect_countdown_timers(ocr: OCRResult) -> list[DetectedPattern]:
    """Detect countdown timer and artificial deadline language."""
    hits = _full_text_matches(ocr.text, _COUNTDOWN_TIMER_PATTERNS)
    if hits == 0:
        return []

    matching_words = _words_matching(ocr, _COUNTDOWN_TIMER_PATTERNS)
    triggers = list({w.text for w in matching_words})[:5]
    first_bbox = matching_words[0].bbox if matching_words else None

    explanation = (
        f"Countdown timer or artificial deadline detected. "
        f"Triggered by: {', '.join(repr(t) for t in triggers)}. "
        f"Urgency signals artificially constrain decision-making time, "
        f"pressuring users to act before they can fully evaluate their options. "
        f"This is a textbook fake urgency dark pattern."
    )

    logger.info("[VisualHeuristics] Countdown timer detected. hits=%d triggers=%s", hits, triggers)
    return [_pattern("Fake Urgency", "countdown_timer", _confidence(hits), explanation, first_bbox)]


# ---------------------------------------------------------------------------
# 2. Pre-selected Checkbox Detection
# ---------------------------------------------------------------------------

_PRECHECKED_TEXT_PATTERNS = [
    r"\byes[!,.]?\s+(add|include|protect|sign\s+me\s+up)\b",
    r"\badd\s+(to|premium|protection|plan)\b",
    r"\binclude\s+(protection|insurance|coverage)\b",
    r"\bmost\s+popular\b",
    r"\brecommended\b",
    r"\bpre.?selected\b",
    r"\bauto.?select\b",
    r"\bdefault\s+option\b",
]

def detect_prechecked_checkboxes(ocr: OCRResult) -> list[DetectedPattern]:
    """
    Detect pre-selected checkbox patterns.
    These appear as 'YES! Add...' or 'Include... (most popular)' options that are
    visually highlighted as if already chosen.
    """
    hits = _full_text_matches(ocr.text, _PRECHECKED_TEXT_PATTERNS)
    if hits == 0:
        return []

    matching_words = _words_matching(ocr, _PRECHECKED_TEXT_PATTERNS)
    triggers = list({w.text for w in matching_words})[:5]
    first_bbox = matching_words[0].bbox if matching_words else None

    explanation = (
        f"Pre-selected or auto-included option detected. "
        f"Triggered by: {', '.join(repr(t) for t in triggers)}. "
        f"Options framed as already selected or as the 'recommended' choice "
        f"exploit the default effect — users accept rather than actively choose. "
        f"This creates assumed consent without explicit user action."
    )

    logger.info("[VisualHeuristics] Pre-selected checkbox detected. hits=%d triggers=%s", hits, triggers)
    return [_pattern("Visual Coercion", "prechecked_checkbox", _confidence(hits), explanation, first_bbox)]


# ---------------------------------------------------------------------------
# 3. Price Anchoring Detection
# ---------------------------------------------------------------------------

_PRICE_ANCHOR_PATTERNS = [
    r"\$\s*\d+[\.,]\d{2}\s+\$\s*\d+[\.,]\d{2}",   # $89.99 $26.99 side by side
    r"\b(was|original|reg|regular|list)\s+price\b",
    r"\bsave\s+\$?\s*\d+",
    r"\b\d+%\s+off\b",
    r"\bdown\s+from\b",
    r"\bslashed\s+price\b",
    r"\bcrossed?.?out\s+price\b",
    r"\byou\s+save\b",
    r"\bdiscount\s+applied\b",
]

def detect_price_anchoring(ocr: OCRResult) -> list[DetectedPattern]:
    """Detect reference pricing and price anchoring manipulation."""
    hits = _full_text_matches(ocr.text, _PRICE_ANCHOR_PATTERNS)
    if hits == 0:
        return []

    matching_words = _words_matching(ocr, _PRICE_ANCHOR_PATTERNS)
    triggers = list({w.text for w in matching_words})[:5]
    first_bbox = matching_words[0].bbox if matching_words else None

    explanation = (
        f"Price anchoring detected. "
        f"Triggered by: {', '.join(repr(t) for t in triggers)}. "
        f"Displaying a high 'original' price alongside a discounted price "
        f"inflates perceived value and creates artificial loss aversion. "
        f"The anchor price is often set arbitrarily to make the 'deal' appear more valuable."
    )

    logger.info("[VisualHeuristics] Price anchoring detected. hits=%d triggers=%s", hits, triggers)
    return [_pattern("Price Anchoring", "price_anchor", _confidence(hits), explanation, first_bbox)]


# ---------------------------------------------------------------------------
# 4. Scarcity Messaging Detection
# ---------------------------------------------------------------------------

_SCARCITY_PATTERNS = [
    r"\bonly\s+\d+\s+left\b",
    r"\blimited\s+(availability|stock|supply|quantity|spots?)\b",
    r"\bexclusive\s+(offer|deal|access)\b",
    r"\b(selling|going)\s+fast\b",
    r"\b(almost|nearly)\s+(gone|sold\s+out)\b",
    r"\blast\s+(chance|call|few)\b",
    r"\bdon'?t\s+miss\s+(out|this)\b",
    r"\bact\s+now\b",
    r"\btoday\s+only\b",
    r"\bone.?time\s+offer\b",
    r"\b\d+\s+(people?|others?)\s+(are\s+)?(viewing|watching|looking)\b",
]

def detect_scarcity_messaging(ocr: OCRResult) -> list[DetectedPattern]:
    """Detect artificial scarcity and social proof pressure tactics."""
    hits = _full_text_matches(ocr.text, _SCARCITY_PATTERNS)
    if hits == 0:
        return []

    matching_words = _words_matching(ocr, _SCARCITY_PATTERNS)
    triggers = list({w.text for w in matching_words})[:5]
    first_bbox = matching_words[0].bbox if matching_words else None

    explanation = (
        f"Scarcity messaging detected. "
        f"Triggered by: {', '.join(repr(t) for t in triggers)}. "
        f"Artificial scarcity claims create fear of missing out (FOMO), "
        f"pressuring users to act quickly without adequate consideration. "
        f"Scarcity is often fabricated or greatly exaggerated."
    )

    logger.info("[VisualHeuristics] Scarcity messaging detected. hits=%d triggers=%s", hits, triggers)
    return [_pattern("Fake Urgency", "scarcity_message", _confidence(hits), explanation, first_bbox)]


# ---------------------------------------------------------------------------
# 5. Dominant CTA / Visual Steering Detection
# ---------------------------------------------------------------------------

_DOMINANT_CTA_PATTERNS = [
    r"\byes[!]?\s+claim\b",
    r"\byes[!]?\s+(get|take|grab|add|start|join|buy|order)\b",
    r"\bclaim\s+my\s+(discount|offer|deal|reward|gift)\b",
    r"\bget\s+my\s+\d+%\s+off\b",
    r"\bunlock\s+(my|this|your)\b",
    r"\byes[!,]?\s+i\s+want\b",
]

_DECLINE_LINK_PATTERNS = [
    r"\bno[,\s]+thanks\b",
    r"\bno[,\s]+thank\s+you\b",
    r"\bi'?ll?\s+pass\b",
    r"\bnot\s+now\b",
    r"\bskip\s+(this|the\s+offer)\b",
    r"\bi\s+(prefer\s+to\s+pay|want\s+to\s+pay)\s+full\s+price\b",
    r"\bcontinue\s+without\b",
    r"\bno[,]?\s+i\s+don'?t\s+want\b",
]

def detect_visual_steering(ocr: OCRResult) -> list[DetectedPattern]:
    """
    Detect visual steering — dominant accept CTA paired with shamed/tiny decline option.
    The pattern is: a large, prominent, affirming CTA alongside a small, guilt-inducing
    opt-out link.
    """
    cta_hits = _full_text_matches(ocr.text, _DOMINANT_CTA_PATTERNS)
    decline_hits = _full_text_matches(ocr.text, _DECLINE_LINK_PATTERNS)

    patterns: list[DetectedPattern] = []

    if cta_hits > 0 and decline_hits > 0:
        # Both present — classic visual steering pattern
        cta_words = _words_matching(ocr, _DOMINANT_CTA_PATTERNS)
        decline_words = _words_matching(ocr, _DECLINE_LINK_PATTERNS)

        cta_triggers = list({w.text for w in cta_words})[:3]
        decline_triggers = list({w.text for w in decline_words})[:3]

        explanation = (
            f"Visual steering detected: dominant accept CTA paired with shamed decline link. "
            f"Accept CTA triggers: {', '.join(repr(t) for t in cta_triggers)}. "
            f"Decline link triggers: {', '.join(repr(t) for t in decline_triggers)}. "
            f"The primary CTA is designed to be visually dominant while the opt-out is "
            f"styled as a secondary, guilt-inducing text link — creating an asymmetric choice architecture."
        )
        first_bbox = cta_words[0].bbox if cta_words else None

        logger.info("[VisualHeuristics] Visual steering detected. cta=%d decline=%d", cta_hits, decline_hits)
        patterns.append(_pattern(
            "Misdirection", "visual_steering_cta", _confidence(cta_hits + decline_hits),
            explanation, first_bbox
        ))

    elif decline_hits > 0:
        # Decline link present without obvious CTA — could be confirm shaming alone
        decline_words = _words_matching(ocr, _DECLINE_LINK_PATTERNS)
        triggers = list({w.text for w in decline_words})[:3]
        first_bbox = decline_words[0].bbox if decline_words else None

        explanation = (
            f"Confirm shaming detected. "
            f"Triggered by: {', '.join(repr(t) for t in triggers)}. "
            f"Opt-out language is framed to make users feel guilty or foolish "
            f"for declining, coercing acceptance through shame rather than genuine choice."
        )
        logger.info("[VisualHeuristics] Confirm shaming detected. triggers=%s", triggers)
        patterns.append(_pattern(
            "Confirm Shaming", "shame_decline_link", _confidence(decline_hits),
            explanation, first_bbox
        ))

    return patterns


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def run_visual_heuristics(ocr: OCRResult) -> list[DetectedPattern]:
    """
    Run all visual heuristic detectors against OCR results.

    Returns a combined list of DetectedPattern objects.
    All detectors are independent and always run — no Gemini call required.
    """
    results: list[DetectedPattern] = []

    detectors = [
        detect_countdown_timers,
        detect_prechecked_checkboxes,
        detect_price_anchoring,
        detect_scarcity_messaging,
        detect_visual_steering,
    ]

    for detector in detectors:
        try:
            found = detector(ocr)
            results.extend(found)
        except Exception as exc:
            logger.error(
                "[VisualHeuristics] Detector %s failed (non-fatal): %s",
                detector.__name__,
                exc,
            )

    logger.info(
        "[VisualHeuristics] Completed. %d visual patterns detected.",
        len(results),
    )
    return results
