"""
simulation_engine.py — Behavioral simulation engine for MIRROR X AI.

Responsibilities:
- run_simulation(): simulate how a given persona experiences detected dark patterns.
- Four personas: Elderly User, Distracted User, Impulsive User, First-Time User.
- Each persona has sensitivity to specific dark pattern categories that amplify severity.
- Maps patterns to four output categories: confusion_points, pressure_points,
  hidden_risk_areas, accidental_consent_zones.
- Calls gemini_client.generate_behavioral_summary() for the behavioral_summary field.
- Returns an explicit no-findings result when detected_patterns is empty.

Validates: Requirements 4.1–4.8
"""

from app.schemas.models import (
    DetectedPattern,
    SimulationFinding,
    SimulationResult,
)

# ---------------------------------------------------------------------------
# Persona configuration
# ---------------------------------------------------------------------------

# Patterns each persona is sensitive to — matching these bumps severity one level up.
PERSONA_SENSITIVE_CATEGORIES: dict[str, set[str]] = {
    "Elderly User": {
        "Visual Coercion",
        "Forced Continuity",
        "Hidden Costs",
        "Misdirection",
    },
    "Distracted User": {
        "Fake Urgency",
        "Visual Coercion",
        "Hidden Costs",
        "Sneak Into Basket",
    },
    "Impulsive User": {
        "Fake Urgency",
        "Confirm Shaming",
        "Roach Motel",
        "Sneak Into Basket",
    },
    "First-Time User": {
        "Confirm Shaming",
        "Misdirection",
        "Roach Motel",
        "Visual Coercion",
    },
}

# ---------------------------------------------------------------------------
# Output category mapping
#
# Each pattern category is mapped to one output bucket based on the nature of
# the manipulation it represents:
#
#   pressure_points         — urgency, scarcity, social pressure patterns
#   confusion_points        — navigation, flow, labelling patterns
#   hidden_risk_areas       — hidden cost / disclosure patterns
#   accidental_consent_zones — auto-consent / one-click checkout patterns
#
# ---------------------------------------------------------------------------

CATEGORY_TO_BUCKET: dict[str, str] = {
    "Fake Urgency":       "pressure_points",
    "Confirm Shaming":    "pressure_points",
    "Visual Coercion":    "pressure_points",
    "Forced Continuity":  "confusion_points",
    "Misdirection":       "confusion_points",
    "Hidden Costs":       "hidden_risk_areas",
    "Roach Motel":        "hidden_risk_areas",
    "Sneak Into Basket":  "accidental_consent_zones",
}

# Fallback bucket for any pattern category not listed above.
_DEFAULT_BUCKET = "confusion_points"

# ---------------------------------------------------------------------------
# Severity helpers
# ---------------------------------------------------------------------------

_SEVERITY_ORDER = ["Low", "Medium", "High"]


def _bump_severity(severity: str) -> str:
    """Raise severity by one level, capped at High."""
    idx = _SEVERITY_ORDER.index(severity)
    return _SEVERITY_ORDER[min(idx + 1, len(_SEVERITY_ORDER) - 1)]


def _resolve_severity(
    confidence_level: str,
    category: str,
    sensitive_categories: set[str],
) -> str:
    """Map confidence_level to a severity, bumping if category is sensitive.

    Args:
        confidence_level: The DetectedPattern confidence ("Low", "Medium", "High").
        category: The dark pattern category.
        sensitive_categories: Set of categories this persona is sensitive to.

    Returns:
        Resolved severity string: "Low", "Medium", or "High".
    """
    # Base mapping: confidence directly maps to severity of the same name.
    severity = confidence_level  # "Low" → "Low", "Medium" → "Medium", "High" → "High"

    if category in sensitive_categories:
        severity = _bump_severity(severity)

    return severity


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def run_simulation(
    persona: str,
    detected_patterns: list[DetectedPattern],
) -> SimulationResult:
    """Simulate the behavioral impact of detected dark patterns on a given persona.

    Args:
        persona: One of "Elderly User", "Distracted User", "Impulsive User",
                 "First-Time User". Unrecognised personas are handled gracefully
                 using an empty sensitive-categories set.
        detected_patterns: List of DetectedPattern instances from the analyzer.

    Returns:
        SimulationResult with confusion_points, pressure_points, hidden_risk_areas,
        accidental_consent_zones, and a Gemini-generated behavioral_summary.
    """
    sensitive_categories = PERSONA_SENSITIVE_CATEGORIES.get(persona, set())

    # --- Empty patterns case (Requirement 4.8) ---
    if not detected_patterns:
        # QUOTA FIX: Use heuristic summary instead of Gemini call
        return SimulationResult(
            persona=persona,
            confusion_points=[],
            pressure_points=[],
            hidden_risk_areas=[],
            accidental_consent_zones=[],
            behavioral_summary=f"No manipulation patterns were detected that would specifically affect a {persona}.",
        )

    # --- Classify patterns into output buckets ---
    confusion_points: list[SimulationFinding] = []
    pressure_points: list[SimulationFinding] = []
    hidden_risk_areas: list[SimulationFinding] = []
    accidental_consent_zones: list[SimulationFinding] = []

    bucket_map: dict[str, list[SimulationFinding]] = {
        "confusion_points": confusion_points,
        "pressure_points": pressure_points,
        "hidden_risk_areas": hidden_risk_areas,
        "accidental_consent_zones": accidental_consent_zones,
    }

    for pattern in detected_patterns:
        severity = _resolve_severity(
            pattern.confidence_level,
            pattern.category,
            sensitive_categories,
        )

        bucket_name = CATEGORY_TO_BUCKET.get(pattern.category, _DEFAULT_BUCKET)
        bucket = bucket_map[bucket_name]

        finding = SimulationFinding(
            element_identifier=pattern.element_identifier,
            severity=severity,
            description=_build_description(pattern, persona, severity),
        )
        bucket.append(finding)

    # --- Select top-3 findings by severity for the behavioral summary (Requirement 4.7) ---
    all_findings = (
        confusion_points
        + pressure_points
        + hidden_risk_areas
        + accidental_consent_zones
    )
    top_3 = _select_top_findings(all_findings, n=3)

    # QUOTA FIX: Use heuristic behavioral summary instead of Gemini call
    # This eliminates 4 Gemini calls per investigation (one per persona)
    sensitive_count = sum(
        1 for p in detected_patterns
        if p.category in sensitive_categories
    )
    high_severity = sum(
        1 for f in top_3
        if f.severity == "High"
    )
    severity_desc = "significant" if high_severity > 0 else "moderate" if top_3 else "minimal"

    behavioral_summary = (
        f"For a {persona}, this interface presents {severity_desc} risk. "
        f"{sensitive_count} of the detected patterns align with known sensitivity areas for this persona. "
        f"Key concerns include: "
        + ", ".join(f"{f.element_identifier} ({f.severity} severity)" for f in top_3[:2])
        + ". Note: These findings represent AI-assisted pattern analysis and do not constitute legal advice."
    )

    return SimulationResult(
        persona=persona,
        confusion_points=confusion_points,
        pressure_points=pressure_points,
        hidden_risk_areas=hidden_risk_areas,
        accidental_consent_zones=accidental_consent_zones,
        behavioral_summary=behavioral_summary,
    )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _build_description(
    pattern: DetectedPattern,
    persona: str,
    severity: str,
) -> str:
    """Build a description string for a SimulationFinding.

    Args:
        pattern: The source DetectedPattern.
        persona: Name of the simulated persona.
        severity: Resolved severity for this finding.

    Returns:
        Description string suitable for SimulationFinding.description.
    """
    return (
        f"[{severity}] {pattern.category} pattern detected for '{persona}'. "
        f"{pattern.explanation}"
    )


def _select_top_findings(
    findings: list[SimulationFinding],
    n: int,
) -> list[SimulationFinding]:
    """Return the top-N findings ranked by severity (High > Medium > Low).

    Args:
        findings: All SimulationFinding instances across all buckets.
        n: Maximum number of findings to return.

    Returns:
        List of up to N SimulationFinding instances, highest severity first.
    """
    sorted_findings = sorted(
        findings,
        key=lambda f: _SEVERITY_ORDER.index(f.severity),
        reverse=True,
    )
    return sorted_findings[:n]
