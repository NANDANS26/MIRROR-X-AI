"""
chat.py — Conversational AI endpoint for MIRROR X AI service.

POST /chat/explain — AI_Investigator response grounded in session context.

Error policy:
  - NEVER return HTTP 500 for Gemini failures.
  - Always return HTTP 200 with structured payload.
  - On Gemini failure: success=False, error_type set, fallback_answer provided.
  - Frontend reads error_type and displays specific human-readable message.

Validates: Requirements 7.1-7.8
"""

import logging

from fastapi import APIRouter

from app.schemas.models import ChatRequest
from app.services.gemini_client import chat_with_assistant

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/chat/explain")
async def chat_explain(body: ChatRequest):
    """
    Generate an AI_Investigator response grounded in the session context.

    Always returns HTTP 200. Error information is in the response body.

    Success response:
      { "success": true, "response": "<text>", "error_type": null }

    Graceful failure response:
      { "success": false, "response": "<fallback text>",
        "error_type": "authentication|quota|rate_limit|timeout|network|unknown",
        "fallback_answer": "<same fallback text>" }
    """
    result = chat_with_assistant(
        session_context=body.session_context,
        history=body.history,
        user_message=body.user_message,
    )

    if not result.success:
        logger.warning(
            "[chat/explain] Gemini failure — returning graceful fallback. "
            "provider=%s error_type=%s",
            result.provider,
            result.error_type,
        )

    return {
        "success": result.success,
        "provider": result.provider,
        "error_type": result.error_type,
        "response": result.text,
        "fallback_answer": result.text if not result.success else None,
    }
