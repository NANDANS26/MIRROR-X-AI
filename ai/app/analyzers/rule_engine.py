import re

from app.schemas.models import (
    OCRResult,
    RuleFlag,
)


FAKE_URGENCY_PATTERNS = [
    r"only\s+\d+\s+left",
    r"limited\s+time",
    r"expires\s+in",
    r"hurry",
    r"sale\s+ends",
]

CONFIRM_SHAMING_PATTERNS = [
    r"no\s+thanks",
    r"i\s+hate\s+saving",
    r"i\s+don't\s+want",
]

FORCED_CONTINUITY_PATTERNS = [
    r"free\s+trial",
    r"auto\s+renew",
    r"subscription",
]

HIDDEN_COST_PATTERNS = [
    r"extra\s+fee",
    r"service\s+charge",
    r"taxes\s+excluded",
]


def find_pattern_matches(
    text: str,
    patterns: list[str]
):
    matches = 0

    for pattern in patterns:
        if re.search(pattern, text, re.IGNORECASE):
            matches += 1

    return matches


def analyze_content(
    ocr_result: OCRResult
):
    detected_flags = []

    for word in ocr_result.words:
        text = word.text

        urgency_matches = find_pattern_matches(
            text,
            FAKE_URGENCY_PATTERNS
        )

        if urgency_matches > 0:
            detected_flags.append(
                RuleFlag(
                    pattern_category="Fake Urgency",
                    element_identifier=text,
                    matched_rule_name="urgency_text_rule",
                    confidence_signals=urgency_matches,
                    bounding_box=word.bbox
                )
            )

        confirm_matches = find_pattern_matches(
            text,
            CONFIRM_SHAMING_PATTERNS
        )

        if confirm_matches > 0:
            detected_flags.append(
                RuleFlag(
                    pattern_category="Confirm Shaming",
                    element_identifier=text,
                    matched_rule_name="confirm_shaming_rule",
                    confidence_signals=confirm_matches,
                    bounding_box=word.bbox
                )
            )

        continuity_matches = find_pattern_matches(
            text,
            FORCED_CONTINUITY_PATTERNS
        )

        if continuity_matches > 0:
            detected_flags.append(
                RuleFlag(
                    pattern_category="Forced Continuity",
                    element_identifier=text,
                    matched_rule_name="forced_continuity_rule",
                    confidence_signals=continuity_matches,
                    bounding_box=word.bbox
                )
            )

        hidden_cost_matches = find_pattern_matches(
            text,
            HIDDEN_COST_PATTERNS
        )

        if hidden_cost_matches > 0:
            detected_flags.append(
                RuleFlag(
                    pattern_category="Hidden Costs",
                    element_identifier=text,
                    matched_rule_name="hidden_cost_rule",
                    confidence_signals=hidden_cost_matches,
                    bounding_box=word.bbox
                )
            )

    return detected_flags