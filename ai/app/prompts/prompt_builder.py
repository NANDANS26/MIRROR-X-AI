from app.schemas.models import (
    OCRResult,
    RuleFlag,
    SimulationFinding,
)


def build_analysis_prompt(
    ocr_result: OCRResult,
    rule_flags: list[RuleFlag]
):
    return f"""
You are an AI system specialized in detecting manipulative UX patterns.

Analyze the following OCR text and heuristic rule flags.

OCR TEXT:
{ocr_result.text}

RULE FLAGS:
{[flag.model_dump() for flag in rule_flags]}

Your task:
1. Identify possible dark patterns.
2. Explain why they may be manipulative.
3. Use cautious and hedged language.
4. Do NOT make legal claims.
5. Return concise explanations.
"""


def build_simulation_prompt(
    persona: str,
    findings: list[SimulationFinding]
) -> str:
    findings_text = "\n".join(
        f"  - [{f.severity}] {f.element_identifier}: {f.description}"
        for f in findings
    )
    return f"""
You are an AI forensic analyst specializing in UX manipulation and behavioral impact assessment.

A UX investigation has identified the following findings for a digital interface:

FINDINGS:
{findings_text}

Your task:
Produce a behavioral impact summary for the following user persona: "{persona}"

Focus on the most significant findings (High and Medium severity first) and explain how each one may affect this specific persona's decision-making, trust, and consent.

Guidelines:
1. Use hedged, evidence-grounded language — say "may", "suggests", "is consistent with", "could indicate".
2. Do NOT make absolute claims or legal determinations.
3. Explain the likely psychological or behavioral effect on this persona.
4. Keep the summary concise, clear, and persona-specific.
5. Address the top findings only; do not enumerate every low-severity item.
"""


def build_chat_prompt(
    session_context: dict,
    history: list[dict],
    user_message: str
) -> str:
    # Extract minimal session context fields
    detected_patterns = session_context.get("detected_patterns", [])
    scores = session_context.get("scores", {})
    source_type = session_context.get("source_type", "unknown")
    source_url = session_context.get("source_url", "")

    # Format detected patterns summary
    if detected_patterns:
        patterns_text = "\n".join(
            f"  - [{p.get('confidence_level', 'Unknown')}] {p.get('category', 'Unknown')}: {p.get('element_identifier', '')}"
            for p in detected_patterns
        )
    else:
        patterns_text = "  No patterns detected."

    # Format scores summary
    manipulation = scores.get("manipulation_score", {}).get("score", "N/A")
    friction = scores.get("friction_score", {}).get("score", "N/A")
    ux_fairness = scores.get("ux_fairness_index", "N/A")

    # Format last 10 history items
    recent_history = history[-10:]
    history_text = "\n".join(
        f"{'User' if entry.get('role') == 'user' else 'AI_Investigator'}: {entry.get('content', '')}"
        for entry in recent_history
    )

    return f"""SYSTEM ROLE:
You are AI_Investigator, an expert AI forensic analyst specializing in detecting manipulative UX patterns and dark design practices. You assist users in understanding the findings from a UX investigation.

HEDGED-LANGUAGE POLICY:
You must never make absolute claims. Always use qualified language such as "may", "suggests", "appears to", "is consistent with", "could indicate", or "based on available evidence". Do not make legal determinations or definitive diagnoses.

SESSION CONTEXT:
Source: {source_type}{" — " + source_url if source_url else ""}
Detected Patterns:
{patterns_text}
Scores:
  - Manipulation Score: {manipulation}
  - Friction Score: {friction}
  - UX Fairness Index: {ux_fairness}

CONVERSATION HISTORY:
{history_text}

User: {user_message}
AI_Investigator:"""
