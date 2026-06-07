"""
Tests for app.analyzers.analyzer

Validates Requirements 3.2, 3.5:
  - map_confidence_level() maps signal counts to "Low" / "Medium" / "High"
  - detect_patterns() returns an empty list when no rule flags are provided

**Validates: Requirements 3.2, 3.5**
"""
import pytest
from unittest.mock import patch

from hypothesis import given, settings
import hypothesis.strategies as st

from app.analyzers.analyzer import map_confidence_level, detect_patterns
from app.schemas.models import BoundingBox, OCRResult, OCRWord, RuleFlag


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_DUMMY_BBOX = BoundingBox(x=0.0, y=0.0, width=10.0, height=10.0)


def _empty_ocr() -> OCRResult:
    """Return an OCRResult with no words."""
    return OCRResult(text="", words=[])


def _ocr_with_words(phrases: list[str]) -> OCRResult:
    """Build a minimal OCRResult from a list of text phrases."""
    words = [
        OCRWord(text=phrase, confidence=0.99, bbox=_DUMMY_BBOX)
        for phrase in phrases
    ]
    return OCRResult(text=" ".join(phrases), words=words)


def _make_rule_flag(signals: int, identifier: str = "element-1") -> RuleFlag:
    return RuleFlag(
        pattern_category="Fake Urgency",
        element_identifier=identifier,
        matched_rule_name="only_X_left",
        confidence_signals=signals,
        bounding_box=_DUMMY_BBOX,
    )


# ---------------------------------------------------------------------------
# Unit tests — map_confidence_level boundary values
# ---------------------------------------------------------------------------

class TestMapConfidenceLevel:
    """Validates: Requirements 3.2 — confidence level mapping"""

    def test_1_signal_returns_low(self):
        assert map_confidence_level(1) == "Low"

    def test_2_signals_returns_medium(self):
        assert map_confidence_level(2) == "Medium"

    def test_3_signals_returns_medium(self):
        assert map_confidence_level(3) == "Medium"

    def test_4_signals_returns_high(self):
        assert map_confidence_level(4) == "High"

    def test_5_signals_returns_high(self):
        assert map_confidence_level(5) == "High"


# ---------------------------------------------------------------------------
# Property-based test — map_confidence_level (Property 4)
# ---------------------------------------------------------------------------

class TestMapConfidenceLevelProperty:
    """
    Property 4: For any integer 1–20, confidence level follows the mapping:
      1       → "Low"
      2 or 3  → "Medium"
      4+      → "High"

    **Validates: Requirements 3.2**
    """

    @given(st.integers(min_value=1, max_value=20))
    @settings(max_examples=100)
    def test_confidence_mapping_formula(self, signals: int):
        result = map_confidence_level(signals)

        if signals == 1:
            assert result == "Low", (
                f"Expected 'Low' for signals=1, got {result!r}"
            )
        elif signals <= 3:
            assert result == "Medium", (
                f"Expected 'Medium' for signals={signals}, got {result!r}"
            )
        else:
            assert result == "High", (
                f"Expected 'High' for signals={signals} (>=4), got {result!r}"
            )

    @given(st.integers(min_value=1, max_value=20))
    @settings(max_examples=100)
    def test_result_is_always_a_valid_level(self, signals: int):
        """The return value is always one of the three valid strings."""
        result = map_confidence_level(signals)
        assert result in {"Low", "Medium", "High"}, (
            f"Unexpected confidence level {result!r} for signals={signals}"
        )


# ---------------------------------------------------------------------------
# Unit tests — detect_patterns empty detection result
# ---------------------------------------------------------------------------

class TestDetectPatternsEmptyResult:
    """Validates: Requirements 3.5 — empty detection result format"""

    def test_empty_rule_flags_returns_empty_list(self):
        """detect_patterns with no rule flags returns an empty list."""
        ocr = _empty_ocr()
        result = detect_patterns(ocr, [])
        assert result == [], f"Expected [] but got {result!r}"

    def test_empty_result_is_a_list(self):
        """The return value must be a list (not None or another type)."""
        ocr = _empty_ocr()
        result = detect_patterns(ocr, [])
        assert isinstance(result, list)

    def test_ocr_with_words_and_no_flags_returns_empty(self):
        """Even when OCR contains words, an empty rule_flags list gives []."""
        ocr = _ocr_with_words(["only 3 left", "limited time offer"])
        result = detect_patterns(ocr, [])
        assert result == []

    @patch("app.analyzers.analyzer.generate_ai_analysis")
    def test_single_flag_returns_one_pattern(self, mock_gemini):
        """When one rule flag is supplied, one DetectedPattern is returned."""
        mock_gemini.return_value = "This element uses urgency techniques."
        ocr = _ocr_with_words(["only 3 left"])
        flag = _make_rule_flag(signals=2)
        result = detect_patterns(ocr, [flag])
        assert len(result) == 1
        assert result[0].element_identifier == "element-1"
        assert result[0].confidence_level == "Medium"

    @patch("app.analyzers.analyzer.generate_ai_analysis")
    def test_duplicate_identifiers_are_deduplicated(self, mock_gemini):
        """Multiple flags with the same element_identifier collapse to one pattern."""
        mock_gemini.return_value = "Urgency pattern detected."
        ocr = _ocr_with_words(["only 3 left"])
        flags = [
            _make_rule_flag(signals=1, identifier="btn-cta"),
            _make_rule_flag(signals=3, identifier="btn-cta"),
        ]
        result = detect_patterns(ocr, flags)
        assert len(result) == 1
        assert result[0].element_identifier == "btn-cta"
