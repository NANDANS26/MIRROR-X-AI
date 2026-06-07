from app.schemas.models import (
    AnalysisScores,
    DetectedPattern,
    ScoreBreakdown,
)


# Per-pattern weights for each score dimension.
# Keys match the category names from DetectedPattern.
PATTERN_WEIGHTS = {
    "Fake Urgency": {
        "manipulation": 20,
        "trust": 20,
        "friction": 0,
    },
    "Confirm Shaming": {
        "manipulation": 15,
        "trust": 15,
        "friction": 5,
    },
    "Forced Continuity": {
        "manipulation": 10,
        "trust": 15,
        "friction": 25,
    },
    "Visual Coercion": {
        "manipulation": 20,
        "trust": 20,
        "friction": 10,
    },
    "Roach Motel": {
        "manipulation": 15,
        "trust": 20,
        "friction": 30,
    },
    "Sneak Into Basket": {
        "manipulation": 25,
        "trust": 25,
        "friction": 15,
    },
    "Misdirection": {
        "manipulation": 20,
        "trust": 20,
        "friction": 10,
    },
    "Hidden Costs": {
        "manipulation": 15,
        "trust": 20,
        "friction": 5,
    },
}


def _clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    """Clamp a value to [lo, hi]."""
    return max(lo, min(hi, value))


def compute_scores(
    detected_patterns: list[DetectedPattern],
) -> AnalysisScores:
    """
    Compute manipulation, trust, friction scores and UX fairness index
    from a list of detected dark patterns.

    Each detected pattern contributes its flat category weight directly
    (no confidence multiplier — confidence is already factored into whether
    the pattern is detected at all by the rule engine).

    Returns an AnalysisScores Pydantic model with ScoreBreakdown for each
    score, including per-pattern contribution details.
    """
    manipulation_total: float = 0.0
    trust_deduction_total: float = 0.0
    friction_total: float = 0.0

    manipulation_contributions: list[dict] = []
    trust_contributions: list[dict] = []
    friction_contributions: list[dict] = []

    for pattern in detected_patterns:
        weights = PATTERN_WEIGHTS.get(pattern.category)

        if weights is None:
            # Unknown category — use safe fallback weights
            weights = {"manipulation": 10, "trust": 10, "friction": 0}

        # Manipulation: accumulate (capped at 100)
        m_points = float(weights["manipulation"])
        manipulation_total += m_points
        manipulation_contributions.append(
            {"pattern_name": pattern.category, "points": m_points}
        )

        # Trust: deduct from 100 (clamped to 0)
        t_points = float(weights["trust"])
        trust_deduction_total += t_points
        trust_contributions.append(
            {"pattern_name": pattern.category, "points": t_points}
        )

        # Friction: only patterns with friction weight > 0 contribute
        f_points = float(weights["friction"])
        if f_points > 0:
            friction_total += f_points
            friction_contributions.append(
                {"pattern_name": pattern.category, "points": f_points}
            )

    manipulation_score = _clamp(manipulation_total)
    trust_score = _clamp(100.0 - trust_deduction_total)
    friction_score = _clamp(friction_total)

    # UX fairness classification
    if manipulation_score < 40 and trust_score > 60:
        ux_fairness: str = "Fair"
    elif manipulation_score > 70 or trust_score < 30:
        ux_fairness = "High Risk"
    else:
        ux_fairness = "Moderate Risk"

    return AnalysisScores(
        manipulation_score=ScoreBreakdown(
            score=manipulation_score,
            contributions=manipulation_contributions,
        ),
        trust_score=ScoreBreakdown(
            score=trust_score,
            contributions=trust_contributions,
        ),
        friction_score=ScoreBreakdown(
            score=friction_score,
            contributions=friction_contributions,
        ),
        ux_fairness_index=ux_fairness,
    )
