"""
output_filter.py — Output safety filter for AI-generated analysis text.

Validates: Requirements 3.4, 12.1, 12.2, 12.3

Responsibilities:
- Replace absolute-claim verbs with appropriately hedged equivalents.
- Inject a legal disclaimer into every response that doesn't already have one.
- Log a warning whenever any modification is made to the output.
"""

import logging
import re

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Disclaimer
# ---------------------------------------------------------------------------

DISCLAIMER = (
    "Note: These findings represent AI-assisted pattern analysis "
    "and do not constitute legal advice."
)

# ---------------------------------------------------------------------------
# Replacement map  (search phrase → hedged replacement)
# Keys are matched case-insensitively; replacements preserve the case-folded
# form used in the original text (surrounding words are untouched).
# ---------------------------------------------------------------------------

_REPLACEMENTS: list[tuple[str, str]] = [
    (
        "is malicious",
        "may exhibit patterns associated with malicious behavior",
    ),
    (
        "is fraudulent",
        "suggests characteristics of fraudulent design",
    ),
    (
        "is illegal",
        "indicates potential legal concerns",
    ),
    (
        "is criminal",
        "appears to use techniques commonly associated with criminal deception",
    ),
]

# Pre-compile patterns once at module load for efficiency.
# re.IGNORECASE makes matching case-insensitive; re.escape ensures literal
# matching of any special regex characters in the search phrases.
_COMPILED: list[tuple[re.Pattern, str]] = [
    (re.compile(re.escape(phrase), re.IGNORECASE), replacement)
    for phrase, replacement in _REPLACEMENTS
]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def filter_output(text: str) -> str:
    """Filter AI output text for absolute claims and inject a legal disclaimer.

    Applies the following transformations:

    1. Replaces all absolute-claim verbs (case-insensitive, all occurrences)
       with hedged equivalents.
    2. Appends the legal disclaimer if it is not already present in the text.
    3. Logs a ``logging.WARNING`` if *any* modification was made.

    Args:
        text: Raw AI-generated output string.

    Returns:
        The filtered (and possibly disclaimer-appended) string.
    """
    modified = False
    result = text

    # Step 1: Replace absolute-claim verbs.
    for pattern, replacement in _COMPILED:
        new_result = pattern.sub(replacement, result)
        if new_result != result:
            modified = True
            result = new_result

    # Step 2: Inject disclaimer if absent (case-sensitive check — the
    # disclaimer is a fixed, well-known string so an exact check is correct).
    if DISCLAIMER not in result:
        separator = "\n\n" if result.strip() else ""
        result = result + separator + DISCLAIMER
        modified = True

    # Step 3: Warn if anything changed.
    if modified:
        logger.warning(
            "output_filter modified AI output: absolute claims replaced "
            "and/or disclaimer injected."
        )

    return result
