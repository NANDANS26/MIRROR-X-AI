import re

from app.schemas.models import (
    OCRResult,
    RuleFlag,
)

# ---------------------------------------------------------------------------
# Existing pattern sets (4 original categories)
# ---------------------------------------------------------------------------

FAKE_URGENCY_PATTERNS = [
    r"only\s+\d+\s+left",
    r"limited\s+time",
    r"expires\s+in",
    r"hurry",
    r"sale\s+ends",
]

CONFIRM_SHAMING_PATTERNS = [
    r"no[,\s]+thanks",
    r"i\s+hate\s+saving",
    r"i\s+don'?t\s+want",
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

# ---------------------------------------------------------------------------
# New pattern sets (4 additional categories)
# ---------------------------------------------------------------------------

# Visual Coercion: pre-checked checkboxes and contrast-ratio violation markers
# These are HTML-level signals, so they apply to `dom_html`.
VISUAL_COERCION_HTML_PATTERNS = [
    # Pre-checked checkbox (bare 'checked' attribute in an input tag)
    r"<input[^>]+type=['\"]checkbox['\"][^>]+checked",
    r"<input[^>]+checked[^>]+type=['\"]checkbox['\"]",
    # Contrast-ratio violation markers (common accessibility audit output)
    r"contrast.ratio.violation",
    r"low.contrast",
    r"contrast\s+fail",
]

# Visual Coercion: text-level signals (e.g. aria/label descriptions)
VISUAL_COERCION_TEXT_PATTERNS = [
    r"pre.?selected",
    r"pre.?checked",
    r"automatically\s+selected",
]

# Roach Motel: easy sign-up present but no cancellation path
ROACH_MOTEL_SIGNUP_PATTERNS = [
    r"join\s+free",
    r"start\s+(free\s+)?trial",
    r"sign\s+up\s+free",
    r"get\s+started\s+free",
    r"create\s+(a\s+)?free\s+account",
]

ROACH_MOTEL_CANCEL_PATTERNS = [
    r"cancel",
    r"unsubscribe",
    r"close\s+account",
    r"delete\s+account",
    r"opt.out",
]

# Sneak Into Basket: auto-added items (text and HTML signals)
SNEAK_INTO_BASKET_HTML_PATTERNS = [
    r"added\s+automatically",
    r"included\s+by\s+default",
    r"auto.?add",
]

SNEAK_INTO_BASKET_TEXT_PATTERNS = [
    r"added\s+automatically",
    r"included\s+by\s+default",
    r"automatically\s+added",
    r"added\s+to\s+(your\s+)?cart",
    r"added\s+to\s+(your\s+)?basket",
]

# Misdirection: declining phrase is the visually primary / prominent action
MISDIRECTION_PATTERNS = [
    # Phrases that decline/reject but are presented as the primary action label
    r"no,?\s+i\s+don'?t\s+want",
    r"skip\s+(this\s+)?(offer|deal|upgrade|step)",
    r"i\s+prefer\s+(to\s+pay\s+)?full\s+price",
    r"decline\s+offer",
    r"remind\s+me\s+later",
    # Secondary styled "yes" while primary decline is present
    r"yes[,.]?\s+remind\s+me",
    r"continue\s+without",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def find_pattern_matches(
    text: str,
    patterns: list[str]
) -> int:
    """Return the number of patterns that match in `text` (case-insensitive)."""
    matches = 0
    for pattern in patterns:
        if re.search(pattern, text, re.IGNORECASE):
            matches += 1
    return matches


def _flag(
    category: str,
    identifier: str,
    rule_name: str,
    signals: int,
    bbox=None
) -> RuleFlag:
    return RuleFlag(
        pattern_category=category,
        element_identifier=identifier,
        matched_rule_name=rule_name,
        confidence_signals=signals,
        bounding_box=bbox,
    )


# ---------------------------------------------------------------------------
# HTML-level detectors (operate on `dom_html`)
# ---------------------------------------------------------------------------

def _detect_visual_coercion_html(dom_html: str) -> list[RuleFlag]:
    """Detect pre-checked checkboxes and contrast violation markers in raw HTML."""
    flags: list[RuleFlag] = []
    matches = find_pattern_matches(dom_html, VISUAL_COERCION_HTML_PATTERNS)
    if matches > 0:
        flags.append(_flag(
            "Visual Coercion",
            "dom_html",
            "visual_coercion_html_rule",
            matches,
        ))
    return flags


def _detect_roach_motel_html(dom_html: str) -> list[RuleFlag]:
    """
    Detect easy sign-up language in HTML with no corresponding cancellation path.
    Signal is raised only when sign-up patterns exist AND cancel patterns are absent.
    """
    flags: list[RuleFlag] = []
    signup_hits = find_pattern_matches(dom_html, ROACH_MOTEL_SIGNUP_PATTERNS)
    cancel_hits = find_pattern_matches(dom_html, ROACH_MOTEL_CANCEL_PATTERNS)
    if signup_hits > 0 and cancel_hits == 0:
        flags.append(_flag(
            "Roach Motel",
            "dom_html",
            "roach_motel_rule",
            signup_hits,
        ))
    return flags


def _detect_sneak_into_basket_html(dom_html: str) -> list[RuleFlag]:
    """Detect auto-added item signals in HTML."""
    flags: list[RuleFlag] = []
    matches = find_pattern_matches(dom_html, SNEAK_INTO_BASKET_HTML_PATTERNS)
    if matches > 0:
        flags.append(_flag(
            "Sneak Into Basket",
            "dom_html",
            "sneak_into_basket_html_rule",
            matches,
        ))
    return flags


# ---------------------------------------------------------------------------
# Text-level detectors (operate on individual OCR word text)
# ---------------------------------------------------------------------------

def _check_word_for_new_patterns(
    text: str,
    bbox=None
) -> list[RuleFlag]:
    """
    Apply the 4 new pattern detectors to a single OCR word/phrase.
    Returns any RuleFlags triggered.
    """
    flags: list[RuleFlag] = []

    # Visual Coercion (text signals)
    vc_matches = find_pattern_matches(text, VISUAL_COERCION_TEXT_PATTERNS)
    if vc_matches > 0:
        flags.append(_flag(
            "Visual Coercion",
            text,
            "visual_coercion_text_rule",
            vc_matches,
            bbox,
        ))

    # Roach Motel (sign-up keywords, no cancel context at word level)
    rm_signup = find_pattern_matches(text, ROACH_MOTEL_SIGNUP_PATTERNS)
    rm_cancel = find_pattern_matches(text, ROACH_MOTEL_CANCEL_PATTERNS)
    if rm_signup > 0 and rm_cancel == 0:
        flags.append(_flag(
            "Roach Motel",
            text,
            "roach_motel_rule",
            rm_signup,
            bbox,
        ))

    # Sneak Into Basket (text signals)
    sib_matches = find_pattern_matches(text, SNEAK_INTO_BASKET_TEXT_PATTERNS)
    if sib_matches > 0:
        flags.append(_flag(
            "Sneak Into Basket",
            text,
            "sneak_into_basket_text_rule",
            sib_matches,
            bbox,
        ))

    # Misdirection
    md_matches = find_pattern_matches(text, MISDIRECTION_PATTERNS)
    if md_matches > 0:
        flags.append(_flag(
            "Misdirection",
            text,
            "misdirection_rule",
            md_matches,
            bbox,
        ))

    return flags


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def analyze_content(
    ocr_result: OCRResult,
    dom_html: str = "",
) -> list[RuleFlag]:
    """
    Analyze OCR text and optional DOM HTML for all 8 dark pattern categories.

    Parameters
    ----------
    ocr_result:
        Structured OCR output containing extracted words with bounding boxes.
    dom_html:
        Optional raw HTML string from a URL scrape.  When provided, the
        HTML-level detectors for Visual Coercion, Roach Motel, and Sneak Into
        Basket are also applied.

    Returns
    -------
    List of RuleFlag objects, one per detected pattern instance.
    """
    detected_flags: list[RuleFlag] = []

    # ------------------------------------------------------------------
    # 1. Per-word OCR text analysis (all 8 categories at word level)
    # ------------------------------------------------------------------
    for word in ocr_result.words:
        text = word.text
        bbox = word.bbox

        # --- Original 4 categories ---

        urgency_matches = find_pattern_matches(text, FAKE_URGENCY_PATTERNS)
        if urgency_matches > 0:
            detected_flags.append(_flag(
                "Fake Urgency",
                text,
                "urgency_text_rule",
                urgency_matches,
                bbox,
            ))

        confirm_matches = find_pattern_matches(text, CONFIRM_SHAMING_PATTERNS)
        if confirm_matches > 0:
            detected_flags.append(_flag(
                "Confirm Shaming",
                text,
                "confirm_shaming_rule",
                confirm_matches,
                bbox,
            ))

        continuity_matches = find_pattern_matches(text, FORCED_CONTINUITY_PATTERNS)
        if continuity_matches > 0:
            detected_flags.append(_flag(
                "Forced Continuity",
                text,
                "forced_continuity_rule",
                continuity_matches,
                bbox,
            ))

        hidden_cost_matches = find_pattern_matches(text, HIDDEN_COST_PATTERNS)
        if hidden_cost_matches > 0:
            detected_flags.append(_flag(
                "Hidden Costs",
                text,
                "hidden_cost_rule",
                hidden_cost_matches,
                bbox,
            ))

        # --- New 4 categories (text-level) ---
        detected_flags.extend(_check_word_for_new_patterns(text, bbox))

    # ------------------------------------------------------------------
    # 2. Full-document HTML analysis (new categories only)
    # ------------------------------------------------------------------
    if dom_html:
        detected_flags.extend(_detect_visual_coercion_html(dom_html))
        detected_flags.extend(_detect_roach_motel_html(dom_html))
        detected_flags.extend(_detect_sneak_into_basket_html(dom_html))
        # Misdirection is text-only (no dedicated HTML regex needed)

    return detected_flags
