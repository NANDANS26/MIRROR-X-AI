"""
analyzer.py — Merges rule flags with Gemini AI analysis.

QUOTA OPTIMIZATION:
- Before: 1 Gemini call per pattern flag (up to N calls per investigation)
- After:  1 Gemini call total for all patterns combined → max 1 call per investigation

Validates: Requirements 3.1, 3.2, 3.3, 3.5
"""

import logging

from app.schemas.models import (
    OCRResult,
    RuleFlag,
    DetectedPattern,
)

logger = logging.getLogger(__name__)


def map_confidence_level(signals: int) -> str:
    if signals == 1:
        return "Low"
    if signals <= 3:
        return "Medium"
    return "High"


def detect_patterns(
    ocr_result: OCRResult,
    rule_flags: list[RuleFlag],
) -> list[DetectedPattern]:
    """
    Produce DetectedPattern objects from rule flags.

    QUOTA FIX: Instead of calling Gemini once per flag (N calls), we now call
    Gemini ONCE with all flags and parse a combined explanation, OR fall back
    to heuristic explanations without any Gemini call when quota is exhausted.
    """
    if not rule_flags:
        logger.info("detect_patterns: no rule flags — returning empty result.")
        return []

    # Deduplicate by element_identifier first
    seen: set[str] = set()
    unique_flags: list[RuleFlag] = []
    for flag in rule_flags:
        if flag.element_identifier not in seen:
            seen.add(flag.element_identifier)
            unique_flags.append(flag)

    if not unique_flags:
        return []

    # --- ONE Gemini call for ALL patterns combined ---
    # Build a map of flag → explanation from a single batch prompt
    explanations: dict[str, str] = {}

    try:
        from app.services.gemini_client import generate_ai_analysis
        # Pass all flags at once — the prompt_builder handles them together
        combined_explanation = generate_ai_analysis(ocr_result, unique_flags)

        # The combined explanation is a single string. Assign it to the first
        # (highest-confidence) flag and use heuristic text for the rest.
        # This is intentional: quota optimization means we get one AI explanation
        # and use heuristic fallbacks for additional patterns.
        if unique_flags:
            explanations[unique_flags[0].element_identifier] = combined_explanation

    except Exception as exc:
        logger.warning(
            "detect_patterns: Gemini batch call failed: %s. Using heuristic explanations.",
            exc,
        )

    # Build DetectedPattern objects
    patterns: list[DetectedPattern] = []
    for flag in unique_flags:
        confidence = map_confidence_level(flag.confidence_signals)
        identifier = flag.element_identifier

        # Use Gemini explanation if available, otherwise heuristic
        explanation = explanations.get(
            identifier,
            f"This element may exhibit {flag.pattern_category.lower()} "
            f"techniques that could influence user decision-making. "
            f"Matched rule: {flag.matched_rule_name}. "
            f"Note: These findings represent AI-assisted pattern analysis "
            f"and do not constitute legal advice."
        )

        patterns.append(DetectedPattern(
            category=flag.pattern_category,
            element_identifier=identifier,
            confidence_level=confidence,
            explanation=explanation,
            bounding_box=flag.bounding_box,
        ))

    logger.info(
        "detect_patterns: produced %d patterns from %d rule flags (1 Gemini call total).",
        len(patterns),
        len(rule_flags),
    )
    return patterns
