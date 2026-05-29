from app.schemas.models import (
    DetectedPattern,
)


PATTERN_WEIGHTS = {
    "Fake Urgency": 15,

    "Confirm Shaming": 18,

    "Forced Continuity": 25,

    "Hidden Costs": 20,
}


CONFIDENCE_MULTIPLIERS = {
    "Low": 1,

    "Medium": 1.5,

    "High": 2,
}


def clamp_score(value):
    return max(
        0,
        min(100, value)
    )


def compute_scores(
    patterns: list[DetectedPattern]
):
    manipulation_score = 0

    friction_score = 0

    for pattern in patterns:
        base_weight = (
            PATTERN_WEIGHTS.get(
                pattern.category,
                10
            )
        )

        multiplier = (
            CONFIDENCE_MULTIPLIERS.get(
                pattern.confidence_level,
                1
            )
        )

        score =
            base_weight * multiplier

        manipulation_score += score

        if pattern.category in [
            "Forced Continuity"
        ]:
            friction_score += score

    manipulation_score = (
        clamp_score(
            manipulation_score
        )
    )

    friction_score = (
        clamp_score(
            friction_score
        )
    )

    trust_score = clamp_score(
        100 - manipulation_score
    )

    if (
        manipulation_score < 40
        and trust_score > 60
    ):
        fairness =
            "Fair"

    elif (
        manipulation_score > 70
        or trust_score < 30
    ):
        fairness =
            "High Risk"

    else:
        fairness =
            "Moderate Risk"

    return {
        "manipulation_score":
            manipulation_score,

        "trust_score":
            trust_score,

        "friction_score":
            friction_score,

        "ux_fairness_index":
            fairness,
    }