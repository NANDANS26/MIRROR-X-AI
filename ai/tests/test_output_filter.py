"""
Tests for app.utils.output_filter.filter_output

Validates: Requirements 3.4, 12.1, 12.2, 12.3

Covers:
- Absolute-claim verb replacement (all four phrases)
- Case-insensitive matching
- All-occurrences replacement (not just the first)
- Disclaimer injection when absent
- No duplicate disclaimer when already present
- Warning logged on any modification
- Clean strings: only disclaimer injected, warning still fires
- Empty string edge case
- Property 5: Hypothesis property-based tests for forbidden verb removal and disclaimer injection
"""
import logging

import pytest
from hypothesis import given, settings, strategies as st

from app.utils.output_filter import DISCLAIMER, filter_output


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _contains_disclaimer(text: str) -> bool:
    return DISCLAIMER in text


# ---------------------------------------------------------------------------
# Verb replacement — one phrase at a time
# ---------------------------------------------------------------------------

class TestVerbReplacement:
    """Validates: Requirements 12.1 — absolute-claim verbs are hedged."""

    def test_is_malicious_replaced(self):
        result = filter_output("This website is malicious and dangerous.")
        assert "is malicious" not in result
        assert "may exhibit patterns associated with malicious behavior" in result

    def test_is_fraudulent_replaced(self):
        result = filter_output("The checkout flow is fraudulent.")
        assert "is fraudulent" not in result
        assert "suggests characteristics of fraudulent design" in result

    def test_is_illegal_replaced(self):
        result = filter_output("The dark pattern is illegal under GDPR.")
        assert "is illegal" not in result
        assert "indicates potential legal concerns" in result

    def test_is_criminal_replaced(self):
        result = filter_output("This tactic is criminal.")
        assert "is criminal" not in result
        assert "appears to use techniques commonly associated with criminal deception" in result


# ---------------------------------------------------------------------------
# Case-insensitivity
# ---------------------------------------------------------------------------

class TestCaseInsensitivity:
    """Validates: Requirements 12.1 — matching is case-insensitive."""

    def test_uppercase_IS_MALICIOUS_replaced(self):
        result = filter_output("This IS MALICIOUS behavior.")
        assert "IS MALICIOUS" not in result
        assert "may exhibit patterns associated with malicious behavior" in result

    def test_mixed_case_Is_Fraudulent_replaced(self):
        result = filter_output("The site Is Fraudulent by design.")
        assert "Is Fraudulent" not in result
        assert "suggests characteristics of fraudulent design" in result

    def test_all_caps_IS_ILLEGAL_replaced(self):
        result = filter_output("This IS ILLEGAL.")
        assert "IS ILLEGAL" not in result
        assert "indicates potential legal concerns" in result

    def test_mixed_case_Is_Criminal_replaced(self):
        result = filter_output("The tactic Is Criminal.")
        assert "Is Criminal" not in result
        assert "appears to use techniques commonly associated with criminal deception" in result


# ---------------------------------------------------------------------------
# All occurrences replaced
# ---------------------------------------------------------------------------

class TestAllOccurrencesReplaced:
    """Validates: Requirements 12.1 — all occurrences are replaced, not just the first."""

    def test_multiple_is_malicious_all_replaced(self):
        text = "The popup is malicious. The redirect is malicious too."
        result = filter_output(text)
        assert result.count("is malicious") == 0
        assert result.count("may exhibit patterns associated with malicious behavior") == 2

    def test_multiple_is_illegal_all_replaced(self):
        text = "Pattern A is illegal. Pattern B is illegal."
        result = filter_output(text)
        assert result.count("is illegal") == 0
        assert result.count("indicates potential legal concerns") == 2

    def test_mixed_phrases_all_replaced(self):
        text = "This is malicious and is fraudulent."
        result = filter_output(text)
        assert "is malicious" not in result
        assert "is fraudulent" not in result
        assert "may exhibit patterns associated with malicious behavior" in result
        assert "suggests characteristics of fraudulent design" in result


# ---------------------------------------------------------------------------
# Disclaimer injection
# ---------------------------------------------------------------------------

class TestDisclaimerInjection:
    """Validates: Requirements 12.2 — disclaimer injected when absent."""

    def test_disclaimer_injected_on_clean_text(self):
        result = filter_output("No dark patterns detected.")
        assert _contains_disclaimer(result)

    def test_disclaimer_injected_on_filtered_text(self):
        result = filter_output("The ad is malicious.")
        assert _contains_disclaimer(result)

    def test_disclaimer_not_duplicated_when_present(self):
        text = f"Analysis complete.\n\n{DISCLAIMER}"
        result = filter_output(text)
        assert result.count(DISCLAIMER) == 1

    def test_disclaimer_not_duplicated_after_multiple_calls(self):
        result_first = filter_output("Some output.")
        result_second = filter_output(result_first)
        assert result_second.count(DISCLAIMER) == 1

    def test_disclaimer_appended_at_end(self):
        result = filter_output("Some analysis text.")
        assert result.endswith(DISCLAIMER)


# ---------------------------------------------------------------------------
# Logging warnings
# ---------------------------------------------------------------------------

class TestLoggingWarning:
    """Validates: Requirements 12.3 — a warning is logged when modifications occur."""

    def test_warning_logged_when_verb_replaced(self, caplog):
        with caplog.at_level(logging.WARNING, logger="app.utils.output_filter"):
            filter_output("This site is malicious.")
        assert len(caplog.records) > 0
        assert caplog.records[0].levelno == logging.WARNING

    def test_warning_logged_when_only_disclaimer_injected(self, caplog):
        with caplog.at_level(logging.WARNING, logger="app.utils.output_filter"):
            filter_output("Clean output with no forbidden verbs.")
        assert len(caplog.records) > 0
        assert caplog.records[0].levelno == logging.WARNING

    def test_no_warning_when_nothing_changes(self, caplog):
        """If disclaimer is already present AND no verbs need replacing, no warning."""
        text = f"All clear.\n\n{DISCLAIMER}"
        with caplog.at_level(logging.WARNING, logger="app.utils.output_filter"):
            filter_output(text)
        warning_records = [r for r in caplog.records if r.levelno == logging.WARNING]
        assert len(warning_records) == 0


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------

class TestEdgeCases:
    """Edge cases: empty string, disclaimer-only input."""

    def test_empty_string_gets_disclaimer(self):
        result = filter_output("")
        assert _contains_disclaimer(result)

    def test_whitespace_only_string_gets_disclaimer(self):
        result = filter_output("   ")
        assert _contains_disclaimer(result)

    def test_disclaimer_only_input_unchanged_aside_from_no_duplicate(self):
        result = filter_output(DISCLAIMER)
        assert result.count(DISCLAIMER) == 1

    def test_return_type_is_str(self):
        assert isinstance(filter_output("hello"), str)

    def test_partial_phrase_not_replaced(self):
        """'malicious' alone (without 'is ') should not be replaced."""
        text = f"Malicious intent detected.\n\n{DISCLAIMER}"
        result = filter_output(text)
        # 'malicious' by itself should remain, as the pattern requires 'is malicious'
        assert "Malicious intent detected" in result


# ---------------------------------------------------------------------------
# Property 5 — Hypothesis property-based tests
# ---------------------------------------------------------------------------

_FORBIDDEN_VERBS = [
    "is malicious",
    "is fraudulent",
    "is illegal",
    "is criminal",
]


class TestPropertyFilterRemovesForbiddenVerbsAndAddsDisclaimer:
    """
    Property 5: For any arbitrary text, injecting a forbidden verb must result
    in that verb being removed and the disclaimer being present.

    Validates: Requirements 3.4, 12.1, 12.2, 12.3
    """

    @given(st.text())
    @settings(max_examples=100)
    def test_property_filter_removes_forbidden_verbs_and_adds_disclaimer(self, text):
        """**Validates: Requirements 3.4, 12.1, 12.2, 12.3**

        Property 5: For every forbidden verb injected into arbitrary text,
        filter_output must:
        - Remove the forbidden verb (case-insensitive)
        - Ensure the DISCLAIMER is present in the result
        """
        for verb in _FORBIDDEN_VERBS:
            injected = text + " " + verb + " definitely."
            result = filter_output(injected)
            assert verb.lower() not in result.lower(), (
                f"Forbidden verb '{verb}' was not removed from output: {result!r}"
            )
            assert DISCLAIMER in result, (
                f"DISCLAIMER missing from output after filtering '{verb}': {result!r}"
            )

    @given(st.text())
    @settings(max_examples=100)
    def test_property_clean_text_always_gets_disclaimer(self, text):
        """**Validates: Requirements 12.2**

        Property: Any arbitrary text that contains no forbidden verbs always
        receives the disclaimer in the output.
        """
        # Ensure the text doesn't accidentally contain any forbidden verb
        assume_clean = all(verb.lower() not in text.lower() for verb in _FORBIDDEN_VERBS)
        if not assume_clean:
            # Skip texts that already contain a forbidden verb — covered by the other property
            return
        result = filter_output(text)
        assert DISCLAIMER in result, (
            f"DISCLAIMER missing from clean output: {result!r}"
        )

    @given(st.text(), st.sampled_from(_FORBIDDEN_VERBS))
    @settings(max_examples=100)
    def test_property_single_verb_injected_is_removed(self, text, verb):
        """**Validates: Requirements 12.1**

        Property: For any text and any single forbidden verb, injecting the
        verb and filtering must remove all occurrences of that verb.
        """
        injected = text + " " + verb
        result = filter_output(injected)
        assert verb.lower() not in result.lower(), (
            f"Forbidden verb '{verb}' still present after filtering: {result!r}"
        )

    @given(st.text())
    @settings(max_examples=50)
    def test_property_disclaimer_never_duplicated(self, text):
        """**Validates: Requirements 12.2**

        Property: Calling filter_output twice never introduces a duplicate
        disclaimer.
        """
        result_once = filter_output(text)
        result_twice = filter_output(result_once)
        assert result_twice.count(DISCLAIMER) == 1, (
            f"DISCLAIMER duplicated after two calls: {result_twice!r}"
        )
