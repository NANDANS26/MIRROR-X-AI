"""
Pytest configuration and shared fixtures for the AI service test suite.
"""
import sys
import os
from types import ModuleType
from unittest.mock import MagicMock

# Ensure the `ai/app` package is importable when running pytest from the
# `ai/tests` directory or from the repo root.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# ---------------------------------------------------------------------------
# Stub out app.services.gemini_client BEFORE any test imports it.
#
# gemini_client.py imports google.generativeai which transitively imports
# google.protobuf C extensions that are incompatible with Python 3.14+.
# By pre-populating sys.modules with a lightweight mock, we prevent the real
# module from ever being loaded during the test session.
# ---------------------------------------------------------------------------

_gemini_stub = ModuleType("app.services.gemini_client")
_gemini_stub.generate_behavioral_summary = MagicMock(return_value="stub summary")
_gemini_stub.generate_ai_analysis = MagicMock(return_value="stub analysis")
_gemini_stub.chat_with_assistant = MagicMock(return_value="stub chat")
sys.modules.setdefault("app.services.gemini_client", _gemini_stub)

# Also stub the google.generativeai namespace so any module that imports it
# at module-level won't crash during collection.
for _mod_name in (
    "google",
    "google.generativeai",
    "google.api_core",
    "google.api_core.exceptions",
):
    if _mod_name not in sys.modules:
        _stub = ModuleType(_mod_name)
        sys.modules[_mod_name] = _stub
