"""
Tests for app.simulation.simulation_engine.run_simulation

Validates: Requirements 4.1, 4.8

Requirements covered:
  4.1 — run_simulation produces the four output categories (confusion_points,
          pressure_points, hidden_risk_areas, accidental_consent_zones) for
          every supported persona and every detected pattern.
  4.8 — When detected_patterns is empty run_simulation returns an explicit
          no-findings SimulationResult with all four output lists present
          (they may be empty but must exist).
"""

from __future__ import annotations

import pytest
from unittest.mock import patch

from hypothesis import given, settings
import hypothesis.strategies as st

from app.schemas.models import DetectedPattern, SimulationResult, SimulationFinding
from app.simulation.simulation_engine import (
    run_simulation,
    PERSONA_SENSITIVE_CATEGORIES,
    CATEGORY_TO_BUCKET,
    _resolve_severity,
    _bump_severity,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

ALL_PERSONAS = [
    "Elderly User",
    "Distracted User",
    "Impulsive User",
    "First-Time User",
]

ALL_CATEGORIES = [
    "Fake Urgency",
    "Confirm Shaming",
    "Forced Continuity",
    "Visual Coercion",
    "Roach Motel",
    "Sneak Into Basket",
    "Misdirection",
    "Hidden Costs",
]

SEVERITY_LEVELS = ["Low", "Medium", "High"]

# ---------------------------------------------------------------------------
# Hypothesis strategy
# ---------------------------------------------------------------------------


@st.composite
def detected_pattern_strategy(draw):
    return DetectedPattern(
        category=draw(
            st.sampled_from([
                "Fake Urgency",
                "Confirm Shaming",
                "Forced Continuity",
                "Visual Coercion",
                "Roach Motel",
                "Sneak Into Basket",
                "Misdirection",
                "Hidden Costs",
            ])
        ),
        element_identifier=draw(st.text(min_size=1, max_size=50)),
        confidence_level=draw(st.sampled_from(["Low", "Medium", "High"])),
        explanation="Test explanation.",
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_MOCK_SUMMARY = "Mocked behavioral summary."

# The patch target must match where the name is *looked up*, not where it's defined.
# simulation_engine.py does `from app.services.gemini_client import generate_behavioral_summary`
# inside run_simulation() at call time. conftest.py pre-stubs app.services.gemini_client in
# sys.modules, so patching that stub is sufficient and avoids importing the real gemini_client
# (which would crash on Python 3.14 due to protobuf C-extension incompatibility).
_PATCH_TARGET = "app.services.gemini_client.generate_behavioral_summary"


def _make_pattern(
    category: str,
    confidence: str = "Medium",
    element_id: str = "test-element",
) -> DetectedPattern:
    return DetectedPattern(
        category=category,
        element_identifier=element_id,
        confidence_level=confidence,
        explanation="Test explanation.",
    )


def _all_findings(result: SimulationResult) -> list[SimulationFinding]:
    return (
        result.confusion_points
        + result.pressure_points
        + result.hidden_risk_areas
        + result.accidental_consent_zones
    )


# ---------------------------------------------------------------------------
# Property 6 — Structural completeness across all personas
#
# Validates: Requirements 4.1
#
# For any non-empty list of detected patterns, every persona's SimulationResult
# must:
#   1. Expose all four output category lists.
#   2. Have every finding's severity drawn from {"Low", "Medium", "High"}.
# ---------------------------------------------------------------------------


@given(st.lists(detected_pattern_strategy(), min_size=1))
@settings(max_examples=50)
def test_property_6_all_four_output_categories_and_valid_severity(patterns):
    """**Validates: Requirements 4.1**

    Property 6: For any non-empty list of detected patterns, run_simulation
    must return a SimulationResult with all four output category lists, and
    every finding's severity must be in {"Low", "Medium", "High"}.
    """
    with patch(
        _PATCH_TARGET,
        return_value=_MOCK_SUMMARY,
    ):
        for persona in ALL_PERSONAS:
            result = run_simulation(persona, patterns)

            # 1. All four output categories must be present (list, not None)
            assert isinstance(result.confusion_points, list), (
                f"confusion_points must be a list for persona={persona}"
            )
            assert isinstance(result.pressure_points, list), (
                f"pressure_points must be a list for persona={persona}"
            )
            assert isinstance(result.hidden_risk_areas, list), (
                f"hidden_risk_areas must be a list for persona={persona}"
            )
            assert isinstance(result.accidental_consent_zones, list), (
                f"accidental_consent_zones must be a list for persona={persona}"
            )

            # 2. Every finding's severity must be valid
            for finding in _all_findings(result):
                assert finding.severity in SEVERITY_LEVELS, (
                    f"Invalid severity {finding.severity!r} for persona={persona}, "
                    f"finding={finding.element_identifier}"
                )


# ---------------------------------------------------------------------------
# Unit tests — empty detection path (Requirement 4.8)
# ---------------------------------------------------------------------------


class TestEmptyDetectionPath:
    """Validates: Requirements 4.8"""

    def test_empty_patterns_returns_simulation_result(self):
        with patch(
            _PATCH_TARGET,
            return_value=_MOCK_SUMMARY,
        ):
            result = run_simulation("Elderly User", [])

        assert isinstance(result, SimulationResult)

    def test_empty_patterns_has_correct_persona(self):
        with patch(
            _PATCH_TARGET,
            return_value=_MOCK_SUMMARY,
        ):
            result = run_simulation("Distracted User", [])

        assert result.persona == "Distracted User"

    def test_empty_patterns_all_four_lists_exist(self):
        with patch(
            _PATCH_TARGET,
            return_value=_MOCK_SUMMARY,
        ):
            result = run_simulation("Impulsive User", [])

        assert hasattr(result, "confusion_points")
        assert hasattr(result, "pressure_points")
        assert hasattr(result, "hidden_risk_areas")
        assert hasattr(result, "accidental_consent_zones")

    def test_empty_patterns_all_four_lists_are_empty(self):
        with patch(
            _PATCH_TARGET,
            return_value=_MOCK_SUMMARY,
        ):
            result = run_simulation("First-Time User", [])

        assert result.confusion_points == []
        assert result.pressure_points == []
        assert result.hidden_risk_areas == []
        assert result.accidental_consent_zones == []

    def test_empty_patterns_behavioral_summary_present(self):
        with patch(
            _PATCH_TARGET,
            return_value=_MOCK_SUMMARY,
        ) as mock_summary:
            result = run_simulation("Elderly User", [])

        assert isinstance(result.behavioral_summary, str)
        assert len(result.behavioral_summary) > 0
        # Must have called generate_behavioral_summary with empty findings list
        mock_summary.assert_called_once_with("Elderly User", [])

    @pytest.mark.parametrize("persona", ALL_PERSONAS)
    def test_empty_patterns_all_personas_return_no_findings(self, persona):
        with patch(
            _PATCH_TARGET,
            return_value=_MOCK_SUMMARY,
        ):
            result = run_simulation(persona, [])

        assert _all_findings(result) == [], (
            f"Expected no findings for empty patterns with persona={persona}"
        )


# ---------------------------------------------------------------------------
# Unit tests — persona sensitivity rules
# ---------------------------------------------------------------------------


class TestElderlyUserSensitivity:
    """Elderly User is sensitive to: Visual Coercion, Forced Continuity,
    Hidden Costs, Misdirection. Confidence 'Medium' → 'High' severity bump."""

    @pytest.mark.parametrize("category", [
        "Visual Coercion",
        "Forced Continuity",
        "Hidden Costs",
        "Misdirection",
    ])
    def test_sensitive_category_bumps_medium_to_high(self, category):
        patterns = [_make_pattern(category, confidence="Medium")]
        with patch(
            _PATCH_TARGET,
            return_value=_MOCK_SUMMARY,
        ):
            result = run_simulation("Elderly User", patterns)

        findings = _all_findings(result)
        assert len(findings) == 1
        assert findings[0].severity == "High", (
            f"Expected bumped severity 'High' for {category} on Elderly User"
        )

    def test_non_sensitive_category_no_bump(self):
        """Fake Urgency is not in Elderly User's sensitive set — no bump."""
        patterns = [_make_pattern("Fake Urgency", confidence="Medium")]
        with patch(
            _PATCH_TARGET,
            return_value=_MOCK_SUMMARY,
        ):
            result = run_simulation("Elderly User", patterns)

        findings = _all_findings(result)
        assert findings[0].severity == "Medium"


class TestDistractedUserSensitivity:
    """Distracted User is sensitive to: Fake Urgency, Visual Coercion,
    Hidden Costs, Sneak Into Basket."""

    @pytest.mark.parametrize("category", [
        "Fake Urgency",
        "Visual Coercion",
        "Hidden Costs",
        "Sneak Into Basket",
    ])
    def test_sensitive_category_bumps_low_to_medium(self, category):
        patterns = [_make_pattern(category, confidence="Low")]
        with patch(
            _PATCH_TARGET,
            return_value=_MOCK_SUMMARY,
        ):
            result = run_simulation("Distracted User", patterns)

        findings = _all_findings(result)
        assert findings[0].severity == "Medium"

    def test_non_sensitive_category_no_bump(self):
        """Confirm Shaming is not sensitive for Distracted User."""
        patterns = [_make_pattern("Confirm Shaming", confidence="Low")]
        with patch(
            _PATCH_TARGET,
            return_value=_MOCK_SUMMARY,
        ):
            result = run_simulation("Distracted User", patterns)

        findings = _all_findings(result)
        assert findings[0].severity == "Low"


class TestImpulsiveUserSensitivity:
    """Impulsive User is sensitive to: Fake Urgency, Confirm Shaming,
    Roach Motel, Sneak Into Basket."""

    @pytest.mark.parametrize("category", [
        "Fake Urgency",
        "Confirm Shaming",
        "Roach Motel",
        "Sneak Into Basket",
    ])
    def test_sensitive_category_bumps_medium_to_high(self, category):
        patterns = [_make_pattern(category, confidence="Medium")]
        with patch(
            _PATCH_TARGET,
            return_value=_MOCK_SUMMARY,
        ):
            result = run_simulation("Impulsive User", patterns)

        findings = _all_findings(result)
        assert findings[0].severity == "High"

    def test_non_sensitive_category_no_bump(self):
        """Hidden Costs is not sensitive for Impulsive User."""
        patterns = [_make_pattern("Hidden Costs", confidence="Medium")]
        with patch(
            _PATCH_TARGET,
            return_value=_MOCK_SUMMARY,
        ):
            result = run_simulation("Impulsive User", patterns)

        findings = _all_findings(result)
        assert findings[0].severity == "Medium"


class TestFirstTimeUserSensitivity:
    """First-Time User is sensitive to: Confirm Shaming, Misdirection,
    Roach Motel, Visual Coercion."""

    @pytest.mark.parametrize("category", [
        "Confirm Shaming",
        "Misdirection",
        "Roach Motel",
        "Visual Coercion",
    ])
    def test_sensitive_category_bumps_low_to_medium(self, category):
        patterns = [_make_pattern(category, confidence="Low")]
        with patch(
            _PATCH_TARGET,
            return_value=_MOCK_SUMMARY,
        ):
            result = run_simulation("First-Time User", patterns)

        findings = _all_findings(result)
        assert findings[0].severity == "Medium"

    def test_non_sensitive_category_no_bump(self):
        """Forced Continuity is not sensitive for First-Time User."""
        patterns = [_make_pattern("Forced Continuity", confidence="Low")]
        with patch(
            _PATCH_TARGET,
            return_value=_MOCK_SUMMARY,
        ):
            result = run_simulation("First-Time User", patterns)

        findings = _all_findings(result)
        assert findings[0].severity == "Low"


# ---------------------------------------------------------------------------
# Unit tests — bucket routing
# ---------------------------------------------------------------------------


class TestBucketRouting:
    """Each pattern category is routed to the correct output bucket."""

    @pytest.mark.parametrize("category,expected_bucket", [
        ("Fake Urgency",      "pressure_points"),
        ("Confirm Shaming",   "pressure_points"),
        ("Visual Coercion",   "pressure_points"),
        ("Forced Continuity", "confusion_points"),
        ("Misdirection",      "confusion_points"),
        ("Hidden Costs",      "hidden_risk_areas"),
        ("Roach Motel",       "hidden_risk_areas"),
        ("Sneak Into Basket", "accidental_consent_zones"),
    ])
    def test_pattern_lands_in_correct_bucket(self, category, expected_bucket):
        patterns = [_make_pattern(category, confidence="Medium")]
        with patch(
            _PATCH_TARGET,
            return_value=_MOCK_SUMMARY,
        ):
            result = run_simulation("First-Time User", patterns)

        bucket = getattr(result, expected_bucket)
        assert len(bucket) == 1, (
            f"{category} should land in {expected_bucket}, got empty bucket"
        )
        # All other buckets must be empty
        other_buckets = {
            "confusion_points",
            "pressure_points",
            "hidden_risk_areas",
            "accidental_consent_zones",
        } - {expected_bucket}
        for other in other_buckets:
            assert getattr(result, other) == [], (
                f"{category} should not appear in {other}"
            )


# ---------------------------------------------------------------------------
# Unit tests — severity helpers (_resolve_severity, _bump_severity)
# ---------------------------------------------------------------------------


class TestSeverityHelpers:
    """Internal severity helpers behave correctly."""

    def test_bump_severity_low_to_medium(self):
        assert _bump_severity("Low") == "Medium"

    def test_bump_severity_medium_to_high(self):
        assert _bump_severity("Medium") == "High"

    def test_bump_severity_high_stays_high(self):
        assert _bump_severity("High") == "High"

    @pytest.mark.parametrize("confidence,category,sensitive,expected", [
        ("Low",    "Fake Urgency", {"Fake Urgency"}, "Medium"),   # sensitive bump
        ("Medium", "Fake Urgency", {"Fake Urgency"}, "High"),     # sensitive bump
        ("High",   "Fake Urgency", {"Fake Urgency"}, "High"),     # capped at High
        ("Low",    "Fake Urgency", set(),            "Low"),      # not sensitive, no bump
        ("Medium", "Fake Urgency", set(),            "Medium"),   # not sensitive, no bump
        ("High",   "Fake Urgency", set(),            "High"),     # not sensitive, no bump
    ])
    def test_resolve_severity(self, confidence, category, sensitive, expected):
        result = _resolve_severity(confidence, category, sensitive)
        assert result == expected


# ---------------------------------------------------------------------------
# Unit tests — SimulationResult structure contract
# ---------------------------------------------------------------------------


class TestSimulationResultContract:
    """run_simulation always returns a properly-shaped SimulationResult."""

    @pytest.mark.parametrize("persona", ALL_PERSONAS)
    def test_result_has_correct_persona_field(self, persona):
        patterns = [_make_pattern("Fake Urgency")]
        with patch(
            _PATCH_TARGET,
            return_value=_MOCK_SUMMARY,
        ):
            result = run_simulation(persona, patterns)

        assert result.persona == persona

    def test_result_behavioral_summary_is_string(self):
        patterns = [_make_pattern("Fake Urgency")]
        with patch(
            _PATCH_TARGET,
            return_value=_MOCK_SUMMARY,
        ):
            result = run_simulation("Elderly User", patterns)

        assert isinstance(result.behavioral_summary, str)

    def test_multiple_patterns_all_routed(self):
        """All 8 pattern categories together populate at least one finding each."""
        patterns = [_make_pattern(c) for c in ALL_CATEGORIES]
        with patch(
            _PATCH_TARGET,
            return_value=_MOCK_SUMMARY,
        ):
            result = run_simulation("Distracted User", patterns)

        total = len(_all_findings(result))
        assert total == len(ALL_CATEGORIES), (
            f"Expected {len(ALL_CATEGORIES)} findings, got {total}"
        )

    def test_unrecognised_persona_returns_valid_result(self):
        """Unknown personas use an empty sensitive set — no crash, valid result."""
        patterns = [_make_pattern("Fake Urgency")]
        with patch(
            _PATCH_TARGET,
            return_value=_MOCK_SUMMARY,
        ):
            result = run_simulation("Unknown Persona", patterns)

        assert isinstance(result, SimulationResult)
        assert result.persona == "Unknown Persona"
        # No bump applied — severity stays at confidence level
        assert _all_findings(result)[0].severity == "Medium"
