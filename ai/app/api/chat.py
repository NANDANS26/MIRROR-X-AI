from fastapi import APIRouter

from pydantic import BaseModel

import google.generativeai as genai


router = APIRouter()


class ChatRequest(BaseModel):
    session_context: dict

    user_message: str


@router.post("/chat/explain")
async def chat_explain(
    body: ChatRequest
):
    prompt = f"""
You are MIRROR X AI.

You are an AI-powered UX manipulation intelligence assistant.

You must answer ONLY using the provided session context.

SESSION CONTEXT:
{body.session_context}

USER QUESTION:
{body.user_message}

Rules:
1. Be concise.
2. Explain manipulative UX patterns clearly.
3. Use cautious language.
4. Do not hallucinate.
5. If unsure, say you do not know.
"""

    model = genai.GenerativeModel(
        "gemini-1.5-flash"
    )

    response = model.generate_content(
        prompt
    )

    return {
        "success": True,
        "response": response.text
    }