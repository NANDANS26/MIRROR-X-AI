"""
gemini_client.py — Gemini AI client for MIRROR X AI.

Error handling policy:
- NEVER raise exceptions to callers.
- ALL Gemini failures return structured GeminiResult objects.
- FastAPI endpoints always return HTTP 200 — error info is in the payload.
- Callers decide how to surface failures to the user.

Error types handled:
  authentication   — 401 / Unauthenticated / ACCOUNT_STATE_INVALID
  quota            — 429 / ResourceExhausted
  rate_limit       — 429 with retry-after
  timeout          — DeadlineExceeded / RequestTimeout
  network          — generic connectivity failure
  unknown          — anything else

Validates: Requirements 3.3, 4.7, 7.1-7.8
"""

import os
import time
import logging
from dataclasses import dataclass
from typing import Optional

import google.generativeai as genai
from google.api_core.exceptions import (
    GoogleAPIError,
    ResourceExhausted,
    Unauthenticated,
    DeadlineExceeded,
    ServiceUnavailable,
)

from dotenv import load_dotenv

from app.schemas.models import (
    OCRResult,
    RuleFlag,
    SimulationFinding,
)

from app.prompts.prompt_builder import build_analysis_prompt
from app.utils.output_filter import filter_output

load_dotenv()

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Model initialisation
# ---------------------------------------------------------------------------

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-2.5-flash")

# ---------------------------------------------------------------------------
# Structured result type
# ---------------------------------------------------------------------------

@dataclass
class GeminiResult:
    """Always returned — never raises."""
    success: bool
    text: str                     # the generated text, or fallback message
    error_type: Optional[str]     # None on success
    provider: str = "gemini"

    def to_dict(self) -> dict:
        return {
            "success": self.success,
            "provider": self.provider,
            "error_type": self.error_type,
            "response": self.text,
            # Human-readable fallback for the frontend
            "fallback_answer": self.text if not self.success else None,
        }


# ---------------------------------------------------------------------------
# Fallback messages — human-readable, specific to each failure mode
# ---------------------------------------------------------------------------

_FALLBACKS = {
    "authentication": (
        "The AI explanation service is temporarily unavailable due to an authentication issue. "
        "Your investigation results — detected patterns, scores, and evidence — remain fully intact. "
        "AI-generated commentary is unavailable until the service is restored."
    ),
    "quota": (
        "AI reasoning is temporarily unavailable because the API usage limit has been reached. "
        "Your investigation results remain available. AI commentary will resume automatically "
        "once the quota resets (typically within a minute or after the current period ends)."
    ),
    "rate_limit": (
        "The AI service is receiving too many requests right now. "
        "Your investigation results are intact. Please try again in a few seconds."
    ),
    "timeout": (
        "The AI explanation request timed out. This can happen when the service is under load. "
        "Your investigation results are intact. Please try again."
    ),
    "network": (
        "Could not reach the AI explanation service due to a network error. "
        "Your investigation results are intact. Please check connectivity and try again."
    ),
    "unknown": (
        "The AI explanation service encountered an unexpected error. "
        "Your investigation results are intact. Please try again shortly."
    ),
}

_RETRY_DELAY = 0.5


# ---------------------------------------------------------------------------
# Error classifier
# ---------------------------------------------------------------------------

def _classify_error(exc: Exception) -> str:
    """Map a caught exception to one of the defined error_type keys."""
    if isinstance(exc, Unauthenticated):
        return "authentication"
    if isinstance(exc, ResourceExhausted):
        # ResourceExhausted covers both quota and rate-limit
        msg = str(exc).lower()
        return "rate_limit" if "rate" in msg else "quota"
    if isinstance(exc, DeadlineExceeded):
        return "timeout"
    if isinstance(exc, ServiceUnavailable):
        return "network"
    if isinstance(exc, GoogleAPIError):
        msg = str(exc).lower()
        if "unauthenticated" in msg or "account_state_invalid" in msg or "401" in msg:
            return "authentication"
        if "quota" in msg or "exhausted" in msg or "429" in msg:
            return "quota"
        if "timeout" in msg or "deadline" in msg:
            return "timeout"
        if "unavailable" in msg or "network" in msg:
            return "network"
    return "unknown"


# ---------------------------------------------------------------------------
# Core generator — NEVER raises
# ---------------------------------------------------------------------------

def _generate(prompt: str) -> GeminiResult:
    """
    Call Gemini with one retry on retryable errors.

    Returns GeminiResult(success=True, ...) on success.
    Returns GeminiResult(success=False, error_type=..., text=<fallback>) on any failure.
    NEVER raises.
    """
    def _attempt() -> str:
        response = model.generate_content(prompt)
        return response.text

    # First attempt
    try:
        text = _attempt()
        logger.debug("[Gemini] Success on first attempt.")
        return GeminiResult(success=True, text=text, error_type=None)
    except (ResourceExhausted, Unauthenticated) as non_retryable:
        # These will not be resolved by retrying
        error_type = _classify_error(non_retryable)
        logger.error(
            "[Gemini] %s failure (non-retryable): %s",
            error_type.upper(),
            non_retryable,
        )
        return GeminiResult(
            success=False,
            text=_FALLBACKS[error_type],
            error_type=error_type,
        )
    except GoogleAPIError as first_err:
        error_type = _classify_error(first_err)
        logger.warning(
            "[Gemini] %s on first attempt — retrying once. Error: %s",
            error_type.upper(),
            first_err,
        )

    # Single retry
    time.sleep(_RETRY_DELAY)
    try:
        text = _attempt()
        logger.info("[Gemini] Success on retry.")
        return GeminiResult(success=True, text=text, error_type=None)
    except Exception as retry_err:
        error_type = _classify_error(retry_err)
        logger.error(
            "[Gemini] %s on retry — activating fallback. Error: %s",
            error_type.upper(),
            retry_err,
        )
        logger.info("[Gemini] Fallback Activated — error_type=%s", error_type)
        return GeminiResult(
            success=False,
            text=_FALLBACKS.get(error_type, _FALLBACKS["unknown"]),
            error_type=error_type,
        )


# ---------------------------------------------------------------------------
# Public API — all return plain strings (backward compatible)
# ---------------------------------------------------------------------------

def generate_ai_analysis(
    ocr_result: OCRResult,
    rule_flags: list[RuleFlag],
) -> str:
    """
    Analyze OCR text and rule flags for dark patterns.
    Returns the filtered AI analysis string, or a graceful fallback on error.
    """
    prompt = build_analysis_prompt(ocr_result, rule_flags)
    result = _generate(prompt)
    if not result.success:
        logger.warning(
            "[Gemini] generate_ai_analysis returning fallback. error_type=%s",
            result.error_type,
        )
    return filter_output(result.text)


def generate_behavioral_summary(
    persona: str,
    findings: list[SimulationFinding],
) -> str:
    """
    Generate a narrative behavioral summary for a persona's simulation findings.
    Returns filtered summary string, or graceful fallback on error.
    """
    try:
        from app.prompts.prompt_builder import build_simulation_prompt
        prompt = build_simulation_prompt(persona, findings)
    except ImportError:
        findings_text = "\n".join(
            f"- [{f.severity}] {f.element_identifier}: {f.description}"
            for f in findings
        ) or "No specific findings."
        prompt = f"""
You are AI_Investigator, an expert in UX manipulation and digital ethics.

Summarize the behavioral impact of the following findings for a simulated {persona}.

FINDINGS:
{findings_text}

Your task:
1. Narrate how this persona would experience the interface.
2. Highlight the most critical confusion or pressure points.
3. Use hedged, evidence-grounded language — avoid absolute legal claims.
4. Be concise: 2-3 sentences.
"""

    result = _generate(prompt)
    if not result.success:
        logger.warning(
            "[Gemini] generate_behavioral_summary returning fallback for persona=%s error_type=%s",
            persona,
            result.error_type,
        )
    return filter_output(result.text)


def chat_with_assistant(
    session_context: dict,
    history: list[dict],
    user_message: str,
) -> GeminiResult:
    """
    Respond to a user message within the context of an investigation session.

    IMPORTANT: Returns a GeminiResult, not a plain string.
    This allows the chat endpoint to return structured error info to the frontend.
    """
    try:
        from app.prompts.prompt_builder import build_chat_prompt
        prompt = build_chat_prompt(session_context, history, user_message)
    except ImportError:
        history_text = "\n".join(
            f"{msg.get('role', 'user').capitalize()}: {msg.get('content', '')}"
            for msg in history[-10:]
        ) or "No prior conversation."

        context_patterns = session_context.get("detected_patterns", [])
        context_scores = session_context.get("scores", {})
        source = session_context.get(
            "source_url_or_filename",
            session_context.get("source_type", "unknown source"),
        )

        prompt = f"""
You are AI_Investigator, MIRROR X AI's investigative assistant specializing in dark UX patterns.

SYSTEM POLICY:
- Use hedged, evidence-grounded language. Never make absolute legal claims.
- Respond concisely and helpfully. Stay focused on the investigation context.

SESSION CONTEXT:
- Source: {source}
- Detected patterns: {context_patterns}
- Scores: {context_scores}

CONVERSATION HISTORY:
{history_text}

User: {user_message}

Respond as AI_Investigator:"""

    result = _generate(prompt)
    if not result.success:
        logger.warning(
            "[Gemini] chat_with_assistant fallback activated. error_type=%s",
            result.error_type,
        )
    # Apply output filter to the text (works on both success and fallback)
    result.text = filter_output(result.text)
    return result
