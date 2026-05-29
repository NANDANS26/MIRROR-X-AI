from app.schemas.models import (
    RuleFlag,
    DetectedPattern,
)


def map_confidence_level(
    signals: int
):
    if signals == 1:
        return "Low"

    if signals <= 3:
        return "Medium"

    return "High"


def detect_patterns(
    rule_flags: list[RuleFlag]
):
    patterns = []

    for flag in rule_flags:
        confidence = map_confidence_level(
            flag.confidence_signals
        )

        patterns.append(
            DetectedPattern(
                category=flag.pattern_category,
                element_identifier=flag.element_identifier,
                confidence_level=confidence,
                explanation=(
                    f"This interface element may use "
                    f"{flag.pattern_category.lower()} "
                    f"techniques that could influence "
                    f"user behavior."
                ),
                bounding_box=flag.bounding_box
            )
        )

    return patterns