import os

import google.generativeai as genai

from dotenv import load_dotenv

from app.schemas.models import (
    OCRResult,
    RuleFlag,
)

from app.prompts.prompt_builder import (
    build_analysis_prompt
)

load_dotenv()

genai.configure(
    api_key=os.getenv(
        "GEMINI_API_KEY"
    )
)

model = genai.GenerativeModel(
    "gemini-1.5-flash"
)


def generate_ai_analysis(
    ocr_result: OCRResult,
    rule_flags: list[RuleFlag]
):
    prompt = build_analysis_prompt(
        ocr_result,
        rule_flags
    )

    response = model.generate_content(
        prompt
    )

    return response.text