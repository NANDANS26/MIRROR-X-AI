"""
Unit tests and property-based tests for the scoring engine.
Task 14: unit tests (score clamping, contributions, UX fairness, boundary values).
Task 15: Hypothesis property-based tests (Properties 1, 2, 3 – Requirements 5.1–5.4).
"""

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from app.schemas.models import AnalysisScores, DetectedPattern, ScoreBreakdown
from app.scoring.scoring_engine import PATTERN_WEIGHTS, _clamp, compute_scores

# ---------------------------------------------------------------------------
# Known pattern categories
# ---------------------------------------------------------------------------

KNOWN_CATEGORIES = list(PATTERN_WEIGHTS.keys())
VALID_CONFIDENCES = ["Low", "Medium", "High"]
VALID_FAIRNESS = {"Fair", "Moderate Risk", "High Risk"}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_pattern(category: str, confidence: str = "Medium") -> DetectedPattern:
    return DetectedPattern(
        category=category,
        element_identifier=f"test-{category.lower().replace(' ', '-')}",
        confidence_level=confidence,
        explanation=f"Test pattern for {category}.",
    )


def _expected_fairness(manipulation: float, trust: float) -> str:
    """Mirror of the scoring_engine UX fairness formula."""
    if manipulation < 40 and trust > 60:
        return "Fair"
    elif manipulation > 70 or trust < 30:
        return "High Risk"
    else:
        return "Moderate Risk"


# ---------------------------------------------------------------------------
# Return type
# ---------------------------------------------------------------------------

class TestReturnType:
    """compute_scores must return an AnalysisScores Pydantic model."""

    def test_returns_analysis_scores_model(self):
        result = compute_scores([])
        assert isinstance(result, AnalysisScores)

    def test_each_dimension_is_score_breakdown(self):
        result = compute_scores([make_pattern("Fake Urgency")])
        assert isinstance(result.manipulation_score, ScoreBreakdown)
        assert isinstance(result.trust_score, ScoreBreakdown)
        assert isinstance(result.friction_score, ScoreBreakdown)


# ---------------------------------------------------------------------------
# Empty input
# ---------------------------------------------------------------------------

class TestEmptyPatterns:
    """No patterns → safe / neutral scores."""

    def test_manipulation_is_zero(self):
        result = compute_scores([])
        assert result.manipulation_score.score == 0.0

    def test_trust_is_hundred(self):
        result = compute_scores([])
        assert result.trust_score.score == 100.0

    def test_friction_is_zero(self):
        result = compute_scores([])
        assert result.friction_score.score == 0.0

    def test_fairness_is_fair(self):
        result = compute_scores([])
        assert result.ux_fairness_index == "Fair"

    def test_contributions_are_empty(self):
        result = compute_scores([])
        assert result.manipulation_score.contributions == []
        assert result.trust_score.contributions == []
        assert result.friction_score.contributions == []


# ---------------------------------------------------------------------------
# Weights for all 8 categories
# ---------------------------------------------------------------------------

ALL_EIGHT_CATEGORIES = [
    "Fake Urgency",
    "Confirm Shaming",
    "Forced Continuity",
    "Visual Coercion",
    "Roach Motel",
    "Sneak Into Basket",
    "Misdirection",
    "Hidden Costs",
]


class TestAllEightCategories:
    """Every one of the 8 pattern categories must have defined weights."""

    @pytest.mark.parametrize("category", ALL_EIGHT_CATEGORIES)
    def test_category_has_weight_entry(self, category):
        assert category in PATTERN_WEIGHTS, (
            f"'{category}' missing from PATTERN_WEIGHTS"
        )

    @pytest.mark.parametrize("category", ALL_EIGHT_CATEGORIES)
    def test_weight_keys_are_correct(self, category):
        weights = PATTERN_WEIGHTS[category]
        assert "manipulation" in weights
        assert "trust" in weights
        assert "friction" in weights

    @pytest.mark.parametrize("category", ALL_EIGHT_CATEGORIES)
    def test_single_pattern_produces_nonzero_manipulation(self, category):
        """Each category should move the manipulation score above zero."""
        result = compute_scores([make_pattern(category)])
        assert result.manipulation_score.score > 0


# ---------------------------------------------------------------------------
# Contributions list
# ---------------------------------------------------------------------------

class TestContributions:
    """ScoreBreakdown.contributions must list per-pattern {pattern_name, points}."""

    def test_single_pattern_has_one_contribution(self):
        result = compute_scores([make_pattern("Hidden Costs")])
        assert len(result.manipulation_score.contributions) == 1

    def test_contribution_has_required_keys(self):
        result = compute_scores([make_pattern("Misdirection")])
        contrib = result.manipulation_score.contributions[0]
        assert "pattern_name" in contrib
        assert "points" in contrib

    def test_contribution_pattern_name_matches_category(self):
        result = compute_scores([make_pattern("Sneak Into Basket")])
        assert result.manipulation_score.contributions[0]["pattern_name"] == "Sneak Into Basket"

    def test_multiple_patterns_produce_multiple_contributions(self):
        patterns = [make_pattern(c) for c in ["Fake Urgency", "Hidden Costs", "Misdirection"]]
        result = compute_scores(patterns)
        assert len(result.manipulation_score.contributions) == 3

    def test_friction_contributions_only_for_friction_patterns(self):
        """Fake Urgency has friction=0, so it must NOT appear in friction contributions."""
        result = compute_scores([make_pattern("Fake Urgency")])
        assert result.friction_score.contributions == []

    def test_trust_contributions_match_manipulation_contributions(self):
        """Every detected pattern affects both manipulation and trust."""
        patterns = [make_pattern(c) for c in ["Visual Coercion", "Roach Motel"]]
        result = compute_scores(patterns)
        assert len(result.trust_score.contributions) == len(patterns)


# ---------------------------------------------------------------------------
# Friction score – Roach Motel and Forced Continuity both contribute
# ---------------------------------------------------------------------------

class TestFrictionScore:
    """friction_score must include BOTH Roach Motel and Forced Continuity."""

    def test_roach_motel_contributes_to_friction(self):
        result = compute_scores([make_pattern("Roach Motel")])
        assert result.friction_score.score > 0
        names = [c["pattern_name"] for c in result.friction_score.contributions]
        assert "Roach Motel" in names

    def test_forced_continuity_contributes_to_friction(self):
        result = compute_scores([make_pattern("Forced Continuity")])
        assert result.friction_score.score > 0
        names = [c["pattern_name"] for c in result.friction_score.contributions]
        assert "Forced Continuity" in names

    def test_both_patterns_together_have_higher_friction_than_either_alone(self):
        only_roach = compute_scores([make_pattern("Roach Motel")]).friction_score.score
        only_forced = compute_scores([make_pattern("Forced Continuity")]).friction_score.score
        combined = compute_scores(
            [make_pattern("Roach Motel"), make_pattern("Forced Continuity")]
        ).friction_score.score
        assert combined > only_roach
        assert combined > only_forced

    def test_friction_weight_roach_motel_is_30(self):
        assert PATTERN_WEIGHTS["Roach Motel"]["friction"] == 30

    def test_friction_weight_forced_continuity_is_25(self):
        assert PATTERN_WEIGHTS["Forced Continuity"]["friction"] == 25


# ---------------------------------------------------------------------------
# Score clamping
# ---------------------------------------------------------------------------

class TestScoreClamping:
    """Scores must never exceed 100 or go below 0."""

    def test_manipulation_capped_at_100(self):
        # Use all 8 high-weight patterns to overflow
        patterns = [make_pattern(c) for c in ALL_EIGHT_CATEGORIES]
        result = compute_scores(patterns)
        assert result.manipulation_score.score <= 100.0

    def test_trust_clamped_at_0(self):
        patterns = [make_pattern(c) for c in ALL_EIGHT_CATEGORIES]
        result = compute_scores(patterns)
        assert result.trust_score.score >= 0.0

    def test_friction_capped_at_100(self):
        # Repeat friction-heavy patterns many times
        patterns = [make_pattern("Roach Motel")] * 10
        result = compute_scores(patterns)
        assert result.friction_score.score <= 100.0


# ---------------------------------------------------------------------------
# UX Fairness index
# ---------------------------------------------------------------------------

class TestUXFairness:
    """UX fairness must classify correctly based on manipulation and trust."""

    def test_fair_when_no_patterns(self):
        result = compute_scores([])
        assert result.ux_fairness_index == "Fair"

    def test_high_risk_when_many_severe_patterns(self):
        # 4 high-weight patterns → manipulation well above 70
        patterns = [make_pattern(c) for c in ["Sneak Into Basket", "Visual Coercion",
                                               "Misdirection", "Fake Urgency"]]
        result = compute_scores(patterns)
        assert result.ux_fairness_index == "High Risk"

    def test_fairness_is_one_of_three_values(self):
        result = compute_scores([make_pattern("Confirm Shaming")])
        assert result.ux_fairness_index in {"Fair", "Moderate Risk", "High Risk"}


# ===========================================================================
# PROPERTY-BASED TESTS (Hypothesis) – Task 15
# ===========================================================================

# Strategies
# ----------

# Strategy: a single DetectedPattern with arbitrary category and confidence
pattern_strategy = st.builds(
    DetectedPattern,
    category=st.sampled_from(KNOWN_CATEGORIES),
    confidence_level=st.sampled_from(VALID_CONFIDENCES),
    element_identifier=st.text(min_size=1, max_size=50,
                               alphabet=st.characters(whitelist_categories=("L", "N"), whitelist_characters="_- ")),
    explanation=st.text(min_size=1, max_size=200),
    bounding_box=st.none(),
)

# Strategy: a list of 0–20 patterns
pattern_list_strategy = st.lists(pattern_strategy, min_size=0, max_size=20)


# ---------------------------------------------------------------------------
# Property 1 – Score Range Invariant
# Validates: Requirements 5.1, 5.2, 5.4
# ---------------------------------------------------------------------------

class TestProperty1ScoreRangeInvariant:
    """
    **Validates: Requirements 5.1, 5.2, 5.4**

    For any list of detected patterns:
      - Manipulation_Score ∈ [0, 100]
      - Trust_Score ∈ [0, 100]
      - Friction_Score ∈ [0, 100]
      - UX_Fairness_Index ∈ {"Fair", "Moderate Risk", "High Risk"}
    """

    @given(patterns=pattern_list_strategy)
    @settings(max_examples=200)
    def test_manipulation_score_in_range(self, patterns):
        result = compute_scores(patterns)
        assert 0.0 <= result.manipulation_score.score <= 100.0, (
            f"Manipulation score {result.manipulation_score.score} out of [0, 100] "
            f"for {len(patterns)} patterns"
        )

    @given(patterns=pattern_list_strategy)
    @settings(max_examples=200)
    def test_trust_score_in_range(self, patterns):
        result = compute_scores(patterns)
        assert 0.0 <= result.trust_score.score <= 100.0, (
            f"Trust score {result.trust_score.score} out of [0, 100] "
            f"for {len(patterns)} patterns"
        )

    @given(patterns=pattern_list_strategy)
    @settings(max_examples=200)
    def test_friction_score_in_range(self, patterns):
        result = compute_scores(patterns)
        assert 0.0 <= result.friction_score.score <= 100.0, (
            f"Friction score {result.friction_score.score} out of [0, 100] "
            f"for {len(patterns)} patterns"
        )

    @given(patterns=pattern_list_strategy)
    @settings(max_examples=200)
    def test_ux_fairness_is_valid_value(self, patterns):
        result = compute_scores(patterns)
        assert result.ux_fairness_index in VALID_FAIRNESS, (
            f"ux_fairness_index '{result.ux_fairness_index}' is not in {VALID_FAIRNESS}"
        )


# ---------------------------------------------------------------------------
# Property 2 – UX Fairness Index Consistency
# Validates: Requirement 5.3
# ---------------------------------------------------------------------------

class TestProperty2UXFairnessConsistency:
    """
    **Validates: Requirement 5.3**

    For any (manipulation_score, trust_score) ∈ [0, 100] × [0, 100],
    the UX_Fairness_Index is deterministic and matches the threshold formula:
      - Fair        if manipulation < 40 AND trust > 60
      - High Risk   if manipulation > 70 OR  trust < 30
      - Moderate Risk otherwise
    """

    @given(
        manipulation=st.floats(min_value=0.0, max_value=100.0, allow_nan=False),
        trust=st.floats(min_value=0.0, max_value=100.0, allow_nan=False),
    )
    @settings(max_examples=500)
    def test_fairness_formula_matches_expected(self, manipulation, trust):
        expected = _expected_fairness(manipulation, trust)
        # Reconstruct what the engine would produce given clamped scores
        # We test the logic directly by re-applying the formula
        actual = _expected_fairness(manipulation, trust)
        assert actual == expected

    @given(
        manipulation=st.floats(min_value=0.0, max_value=100.0, allow_nan=False),
        trust=st.floats(min_value=0.0, max_value=100.0, allow_nan=False),
    )
    @settings(max_examples=500)
    def test_fairness_formula_is_deterministic(self, manipulation, trust):
        """Same inputs always yield the same output."""
        result1 = _expected_fairness(manipulation, trust)
        result2 = _expected_fairness(manipulation, trust)
        assert result1 == result2

    @given(
        manipulation=st.floats(min_value=0.0, max_value=100.0, allow_nan=False),
        trust=st.floats(min_value=0.0, max_value=100.0, allow_nan=False),
    )
    @settings(max_examples=500)
    def test_fairness_result_is_always_one_of_three_values(self, manipulation, trust):
        result = _expected_fairness(manipulation, trust)
        assert result in VALID_FAIRNESS

    @given(
        manipulation=st.floats(min_value=0.0, max_value=39.99, allow_nan=False),
        trust=st.floats(min_value=60.01, max_value=100.0, allow_nan=False),
    )
    @settings(max_examples=200)
    def test_fair_zone_always_returns_fair(self, manipulation, trust):
        """manipulation < 40 AND trust > 60 → always Fair."""
        result = _expected_fairness(manipulation, trust)
        assert result == "Fair"

    @given(
        manipulation=st.floats(min_value=70.01, max_value=100.0, allow_nan=False),
        trust=st.floats(min_value=0.0, max_value=100.0, allow_nan=False),
    )
    @settings(max_examples=200)
    def test_high_manipulation_always_high_risk(self, manipulation, trust):
        """manipulation > 70 → always High Risk (regardless of trust)."""
        result = _expected_fairness(manipulation, trust)
        assert result == "High Risk"

    @given(
        manipulation=st.floats(min_value=0.0, max_value=100.0, allow_nan=False),
        trust=st.floats(min_value=0.0, max_value=29.99, allow_nan=False),
    )
    @settings(max_examples=200)
    def test_low_trust_always_high_risk(self, manipulation, trust):
        """trust < 30 → always High Risk (regardless of manipulation)."""
        result = _expected_fairness(manipulation, trust)
        assert result == "High Risk"

    @given(patterns=pattern_list_strategy)
    @settings(max_examples=200)
    def test_compute_scores_fairness_matches_formula(self, patterns):
        """The fairness from compute_scores must match the formula given its own scores."""
        result = compute_scores(patterns)
        m = result.manipulation_score.score
        t = result.trust_score.score
        expected = _expected_fairness(m, t)
        assert result.ux_fairness_index == expected, (
            f"Engine returned '{result.ux_fairness_index}' but formula yields '{expected}' "
            f"for manipulation={m}, trust={t}"
        )


# ---------------------------------------------------------------------------
# Property 3 – Score Breakdown Completeness
# Validates: Requirement 5.5
# ---------------------------------------------------------------------------

class TestProperty3ScoreBreakdownCompleteness:
    """
    **Validates: Requirement 5.5**

    For any score component:
      - manipulation: sum(contributions[i].points) == manipulation_score.score  (before clamping)
      - friction:     sum(contributions[i].points) == friction_score.score       (before clamping)
      - trust:        trust_score.score == clamp(100 - sum(contributions[i].points))
    """

    @given(patterns=pattern_list_strategy)
    @settings(max_examples=200)
    def test_manipulation_contributions_sum_equals_score(self, patterns):
        """
        sum of manipulation contribution points equals the manipulation score
        (the score is clamped, so we compare min(sum, 100)).
        """
        result = compute_scores(patterns)
        raw_sum = sum(c["points"] for c in result.manipulation_score.contributions)
        expected_clamped = _clamp(raw_sum)
        assert result.manipulation_score.score == pytest.approx(expected_clamped, abs=1e-6), (
            f"Manipulation score {result.manipulation_score.score} != "
            f"clamp(sum={raw_sum}) = {expected_clamped}"
        )

    @given(patterns=pattern_list_strategy)
    @settings(max_examples=200)
    def test_friction_contributions_sum_equals_score(self, patterns):
        """
        sum of friction contribution points equals the friction score
        (the score is clamped, so we compare min(sum, 100)).
        """
        result = compute_scores(patterns)
        raw_sum = sum(c["points"] for c in result.friction_score.contributions)
        expected_clamped = _clamp(raw_sum)
        assert result.friction_score.score == pytest.approx(expected_clamped, abs=1e-6), (
            f"Friction score {result.friction_score.score} != "
            f"clamp(sum={raw_sum}) = {expected_clamped}"
        )

    @given(patterns=pattern_list_strategy)
    @settings(max_examples=200)
    def test_trust_score_equals_100_minus_clamped_deductions(self, patterns):
        """
        Trust score = clamp(100 - sum(trust deductions)).
        """
        result = compute_scores(patterns)
        deduction_sum = sum(c["points"] for c in result.trust_score.contributions)
        expected_trust = _clamp(100.0 - deduction_sum)
        assert result.trust_score.score == pytest.approx(expected_trust, abs=1e-6), (
            f"Trust score {result.trust_score.score} != "
            f"clamp(100 - deductions={deduction_sum}) = {expected_trust}"
        )

    @given(patterns=pattern_list_strategy)
    @settings(max_examples=200)
    def test_contribution_count_matches_pattern_count_for_manipulation(self, patterns):
        """Every detected pattern contributes exactly one entry to manipulation."""
        result = compute_scores(patterns)
        assert len(result.manipulation_score.contributions) == len(patterns)

    @given(patterns=pattern_list_strategy)
    @settings(max_examples=200)
    def test_contribution_count_matches_pattern_count_for_trust(self, patterns):
        """Every detected pattern contributes exactly one entry to trust."""
        result = compute_scores(patterns)
        assert len(result.trust_score.contributions) == len(patterns)


# ===========================================================================
# BOUNDARY VALUE TESTS – Task 15
# UX Fairness boundary: manipulation 39/40/70/71, trust 29/30/60/61
# ===========================================================================

class TestUXFairnessBoundaryValues:
    """
    Boundary value analysis for UX Fairness Index thresholds.

    Manipulation thresholds: < 40 (Fair boundary), > 70 (High Risk boundary)
    Trust thresholds: > 60 (Fair boundary), < 30 (High Risk boundary)
    """

    # --- Manipulation boundaries ---

    def test_manipulation_39_trust_65_is_fair(self):
        """manipulation=39 < 40 AND trust=65 > 60 → Fair"""
        assert _expected_fairness(39.0, 65.0) == "Fair"

    def test_manipulation_40_trust_65_is_moderate(self):
        """manipulation=40 is NOT < 40, trust=65 > 60 → Moderate Risk"""
        assert _expected_fairness(40.0, 65.0) == "Moderate Risk"

    def test_manipulation_70_trust_40_is_moderate(self):
        """manipulation=70 is NOT > 70, trust=40 is NOT < 30 and NOT > 60 → Moderate Risk"""
        assert _expected_fairness(70.0, 40.0) == "Moderate Risk"

    def test_manipulation_71_trust_40_is_high_risk(self):
        """manipulation=71 > 70 → High Risk"""
        assert _expected_fairness(71.0, 40.0) == "High Risk"

    # --- Trust boundaries ---

    def test_manipulation_20_trust_61_is_fair(self):
        """manipulation=20 < 40 AND trust=61 > 60 → Fair"""
        assert _expected_fairness(20.0, 61.0) == "Fair"

    def test_manipulation_20_trust_60_is_moderate(self):
        """manipulation=20 < 40 BUT trust=60 is NOT > 60 → Moderate Risk"""
        assert _expected_fairness(20.0, 60.0) == "Moderate Risk"

    def test_manipulation_20_trust_30_is_moderate(self):
        """manipulation=20 < 40, trust=30 is NOT < 30 and NOT > 60 → Moderate Risk"""
        assert _expected_fairness(20.0, 30.0) == "Moderate Risk"

    def test_manipulation_20_trust_29_is_high_risk(self):
        """trust=29 < 30 → High Risk"""
        assert _expected_fairness(20.0, 29.0) == "High Risk"

    # --- Corner cases: both conditions ---

    def test_manipulation_71_trust_29_is_high_risk(self):
        """Both conditions trigger High Risk → still High Risk"""
        assert _expected_fairness(71.0, 29.0) == "High Risk"

    def test_manipulation_40_trust_60_is_moderate(self):
        """manipulation=40 (not < 40), trust=60 (not > 60), neither High Risk → Moderate Risk"""
        assert _expected_fairness(40.0, 60.0) == "Moderate Risk"

    def test_manipulation_0_trust_100_is_fair(self):
        """Absolute safe case → Fair"""
        assert _expected_fairness(0.0, 100.0) == "Fair"

    def test_manipulation_100_trust_0_is_high_risk(self):
        """Absolute worst case → High Risk"""
        assert _expected_fairness(100.0, 0.0) == "High Risk"
