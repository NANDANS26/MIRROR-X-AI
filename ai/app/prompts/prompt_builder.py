from app.schemas.models import (
    OCRResult,
    RuleFlag,
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