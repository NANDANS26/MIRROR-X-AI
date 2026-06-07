"""
Tests for app.analyzers.rule_engine.analyze_content

Validates Requirements 3.1, 3.6:
  WHEN content is analyzed, THE Rule_Engine SHALL detect all 8 dark pattern
  categories and return structured RuleFlag objects.

All 8 categories are tested:
  1. Fake Urgency
  2. Confirm Shaming
  3. Forced Continuity
  4. Hidden Costs
  5. Visual Coercion
  6. Roach Motel
  7. Sneak Into Basket
  8. Misdirection
"""
import pytest

from app.analyzers.rule_engine import analyze_content
from app.schemas.models import BoundingBox, OCRResult, OCRWord, RuleFlag


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_DUMMY_BBOX = BoundingBox(x=0.0, y=0.0, width=10.0, height=10.0)


def _ocr(phrases: list[str]) -> OCRResult:
    """Build a minimal OCRResult from a list of trigger phrases."""
    words = [
        OCRWord(text=phrase, confidence=0.99, bbox=_DUMMY_BBOX)
        for phrase in phrases
    ]
    return OCRResult(text=" ".join(phrases), words=words)


def _categories(flags: list[RuleFlag]) -> set[str]:
    return {f.pattern_category for f in flags}


# ---------------------------------------------------------------------------
# Original 4 categories — text-level triggers
# ---------------------------------------------------------------------------

class TestFakeUrgency:
    """Validates: Requirements 3.1"""

    def test_only_X_left_triggers_flag(self):
        flags = analyze_content(_ocr(["only 3 left"]))
        assert "Fake Urgency" in _categories(flags)

    def test_limited_time_triggers_flag(self):
        flags = analyze_content(_ocr(["limited time offer"]))
        assert "Fake Urgency" in _categories(flags)

    def test_sale_ends_triggers_flag(self):
        flags = analyze_content(_ocr(["sale ends soon"]))
        assert "Fake Urgency" in _categories(flags)

    def test_no_urgency_language_returns_no_flag(self):
        flags = analyze_content(_ocr(["buy our product today"]))
        assert "Fake Urgency" not in _categories(flags)


class TestConfirmShaming:
    """Validates: Requirements 3.1"""

    def test_no_thanks_triggers_flag(self):
        flags = analyze_content(_ocr(["No, thanks"]))
        assert "Confirm Shaming" in _categories(flags)

    def test_i_hate_saving_triggers_flag(self):
        flags = analyze_content(_ocr(["I hate saving money"]))
        assert "Confirm Shaming" in _categories(flags)

    def test_clean_text_no_flag(self):
        flags = analyze_content(_ocr(["Continue to checkout"]))
        assert "Confirm Shaming" not in _categories(flags)


class TestForcedContinuity:
    """Validates: Requirements 3.1"""

    def test_auto_renew_triggers_flag(self):
        flags = analyze_content(_ocr(["auto renew enabled"]))
        assert "Forced Continuity" in _categories(flags)

    def test_free_trial_triggers_flag(self):
        flags = analyze_content(_ocr(["start your free trial"]))
        assert "Forced Continuity" in _categories(flags)

    def test_subscription_triggers_flag(self):
        flags = analyze_content(_ocr(["monthly subscription"]))
        assert "Forced Continuity" in _categories(flags)

    def test_clean_text_no_flag(self):
        flags = analyze_content(_ocr(["purchase a single item"]))
        assert "Forced Continuity" not in _categories(flags)


class TestHiddenCosts:
    """Validates: Requirements 3.1"""

    def test_extra_fee_triggers_flag(self):
        flags = analyze_content(_ocr(["extra fee applies"]))
        assert "Hidden Costs" in _categories(flags)

    def test_service_charge_triggers_flag(self):
        flags = analyze_content(_ocr(["service charge: $2.99"]))
        assert "Hidden Costs" in _categories(flags)

    def test_taxes_excluded_triggers_flag(self):
        flags = analyze_content(_ocr(["taxes excluded"]))
        assert "Hidden Costs" in _categories(flags)

    def test_clean_price_no_flag(self):
        flags = analyze_content(_ocr(["total: $19.99"]))
        assert "Hidden Costs" not in _categories(flags)


# ---------------------------------------------------------------------------
# New 4 categories — text-level triggers
# ---------------------------------------------------------------------------

class TestVisualCoercion:
    """Validates: Requirements 2.7, 3.6"""

    def test_pre_selected_text_triggers_flag(self):
        flags = analyze_content(_ocr(["pre-selected option"]))
        assert "Visual Coercion" in _categories(flags)

    def test_pre_checked_text_triggers_flag(self):
        flags = analyze_content(_ocr(["pre-checked by default"]))
        assert "Visual Coercion" in _categories(flags)

    def test_automatically_selected_triggers_flag(self):
        flags = analyze_content(_ocr(["automatically selected"]))
        assert "Visual Coercion" in _categories(flags)

    def test_clean_text_no_flag(self):
        flags = analyze_content(_ocr(["choose your plan"]))
        assert "Visual Coercion" not in _categories(flags)

    def test_prechecked_checkbox_html_triggers_flag(self):
        """Validates: Requirements 2.7"""
        html = '<input type="checkbox" checked name="newsletter">'
        flags = analyze_content(_ocr([""]), dom_html=html)
        assert "Visual Coercion" in _categories(flags)

    def test_contrast_violation_in_html_triggers_flag(self):
        html = "<!-- contrast ratio violation detected on button -->"
        flags = analyze_content(_ocr([""]), dom_html=html)
        assert "Visual Coercion" in _categories(flags)

    def test_clean_html_no_visual_coercion_flag(self):
        html = '<input type="text" name="email">'
        flags = analyze_content(_ocr([""]), dom_html=html)
        assert "Visual Coercion" not in _categories(flags)


class TestRoachMotel:
    """Validates: Requirements 3.6"""

    def test_join_free_no_cancel_triggers_flag(self):
        flags = analyze_content(_ocr(["join free today"]))
        assert "Roach Motel" in _categories(flags)

    def test_start_trial_no_cancel_triggers_flag(self):
        flags = analyze_content(_ocr(["start free trial"]))
        assert "Roach Motel" in _categories(flags)

    def test_sign_up_free_triggers_flag(self):
        flags = analyze_content(_ocr(["sign up free"]))
        assert "Roach Motel" in _categories(flags)

    def test_signup_with_cancel_option_suppresses_flag(self):
        """When a cancel path exists in the same word, no Roach Motel flag."""
        # Both signup and cancel in same text token → cancel present, no flag
        flags = analyze_content(_ocr(["join free, cancel anytime"]))
        assert "Roach Motel" not in _categories(flags)

    def test_html_signup_without_cancel_triggers_flag(self):
        html = '<a href="/signup">Join Free</a><p>Upgrade your plan</p>'
        flags = analyze_content(_ocr([""]), dom_html=html)
        assert "Roach Motel" in _categories(flags)

    def test_html_signup_with_cancel_link_suppresses_flag(self):
        html = '<a href="/signup">Join Free</a><a href="/cancel">Cancel subscription</a>'
        flags = analyze_content(_ocr([""]), dom_html=html)
        assert "Roach Motel" not in _categories(flags)

    def test_clean_text_no_flag(self):
        flags = analyze_content(_ocr(["browse our products"]))
        assert "Roach Motel" not in _categories(flags)


class TestSneakIntoBasket:
    """Validates: Requirements 3.6"""

    def test_added_automatically_text_triggers_flag(self):
        flags = analyze_content(_ocr(["added automatically"]))
        assert "Sneak Into Basket" in _categories(flags)

    def test_included_by_default_text_triggers_flag(self):
        flags = analyze_content(_ocr(["included by default"]))
        assert "Sneak Into Basket" in _categories(flags)

    def test_added_to_cart_text_triggers_flag(self):
        flags = analyze_content(_ocr(["added to your cart"]))
        assert "Sneak Into Basket" in _categories(flags)

    def test_html_auto_add_triggers_flag(self):
        html = '<div class="cart">Item auto-added to your order</div>'
        flags = analyze_content(_ocr([""]), dom_html=html)
        assert "Sneak Into Basket" in _categories(flags)

    def test_html_added_automatically_triggers_flag(self):
        html = '<p>Protection plan added automatically.</p>'
        flags = analyze_content(_ocr([""]), dom_html=html)
        assert "Sneak Into Basket" in _categories(flags)

    def test_clean_text_no_flag(self):
        flags = analyze_content(_ocr(["view your cart"]))
        assert "Sneak Into Basket" not in _categories(flags)


class TestMisdirection:
    """Validates: Requirements 3.6"""

    def test_no_i_dont_want_triggers_flag(self):
        flags = analyze_content(_ocr(["No, I don't want savings"]))
        assert "Misdirection" in _categories(flags)

    def test_skip_offer_triggers_flag(self):
        flags = analyze_content(_ocr(["skip this offer"]))
        assert "Misdirection" in _categories(flags)

    def test_decline_offer_triggers_flag(self):
        flags = analyze_content(_ocr(["Decline offer"]))
        assert "Misdirection" in _categories(flags)

    def test_continue_without_triggers_flag(self):
        flags = analyze_content(_ocr(["continue without upgrade"]))
        assert "Misdirection" in _categories(flags)

    def test_clean_cta_no_flag(self):
        flags = analyze_content(_ocr(["Get started", "Learn more"]))
        assert "Misdirection" not in _categories(flags)


# ---------------------------------------------------------------------------
# Clean fixture — empty flags for neutral content
# ---------------------------------------------------------------------------

class TestCleanContent:
    """Validates: Requirements 3.1 — clean inputs must return no flags."""

    def test_neutral_ocr_text_returns_empty(self):
        neutral = _ocr([
            "Welcome to our store",
            "Browse categories",
            "Contact us",
            "About us",
            "Privacy policy",
        ])
        flags = analyze_content(neutral)
        assert flags == [], f"Expected no flags for neutral text, got: {flags}"

    def test_empty_ocr_and_no_html_returns_empty(self):
        flags = analyze_content(_ocr([]))
        assert flags == []

    def test_neutral_html_returns_empty(self):
        html = '<div><p>Hello World</p><a href="/home">Home</a></div>'
        flags = analyze_content(_ocr([""]), dom_html=html)
        assert flags == []


# ---------------------------------------------------------------------------
# Structural / API contract
# ---------------------------------------------------------------------------

class TestAnalyzeContentSignature:
    """analyze_content must accept both positional and keyword dom_html."""

    def test_positional_dom_html_accepted(self):
        html = '<input type="checkbox" checked>'
        # Call with dom_html as positional argument (2nd param)
        flags = analyze_content(_ocr([""]), html)
        assert isinstance(flags, list)

    def test_keyword_dom_html_accepted(self):
        html = '<input type="checkbox" checked>'
        flags = analyze_content(_ocr([""]), dom_html=html)
        assert isinstance(flags, list)

    def test_default_dom_html_omitted(self):
        flags = analyze_content(_ocr(["only 1 left"]))
        assert isinstance(flags, list)

    def test_returns_list_of_rule_flags(self):
        flags = analyze_content(_ocr(["only 3 left", "extra fee"]))
        assert all(isinstance(f, RuleFlag) for f in flags)

    def test_rule_flag_fields_populated(self):
        flags = analyze_content(_ocr(["only 3 left"]))
        urgency_flags = [f for f in flags if f.pattern_category == "Fake Urgency"]
        assert len(urgency_flags) > 0
        f = urgency_flags[0]
        assert f.matched_rule_name
        assert f.confidence_signals > 0
        assert f.element_identifier


# ---------------------------------------------------------------------------
# All 8 categories covered in a single combined fixture
# ---------------------------------------------------------------------------

class TestAllEightCategories:
    """Validates: Requirements 1.3, 3.1, 3.6 — all 8 categories fire together."""

    def test_all_8_categories_detected(self):
        ocr = _ocr([
            "only 5 left",               # Fake Urgency
            "no thanks",                 # Confirm Shaming
            "auto renew",                # Forced Continuity
            "extra fee",                 # Hidden Costs
            "pre-selected",              # Visual Coercion (text)
            "join free",                 # Roach Motel (text, no cancel)
            "added automatically",       # Sneak Into Basket (text)
            "skip this offer",           # Misdirection
        ])
        html = (
            '<input type="checkbox" checked>'          # Visual Coercion (HTML)
            '<a href="/signup">Start Trial</a>'        # Roach Motel sign-up
            '<p>Protection plan added automatically</p>'  # Sneak Into Basket (HTML)
        )
        flags = analyze_content(ocr, dom_html=html)
        found = _categories(flags)
        expected = {
            "Fake Urgency",
            "Confirm Shaming",
            "Forced Continuity",
            "Hidden Costs",
            "Visual Coercion",
            "Roach Motel",
            "Sneak Into Basket",
            "Misdirection",
        }
        assert expected.issubset(found), (
            f"Missing categories: {expected - found}"
        )
