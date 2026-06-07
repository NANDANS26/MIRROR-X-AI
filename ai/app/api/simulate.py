"""
simulate.py — Behavioral simulation endpoint for MIRROR X AI service.

POST /simulate — Run behavioral simulation for one or more personas.

Validates: Requirements 4.1–4.8
"""

from fastapi import APIRouter
from typing import List

from app.schemas.models import SimulateRequest, SimulationResult
from app.simulation.simulation_engine import run_simulation

router = APIRouter()

_DEFAULT_PERSONAS = [
    "Elderly User",
    "Distracted User",
    "Impulsive User",
    "First-Time User",
]


@router.post("/simulate", response_model=List[SimulationResult])
async def simulate(body: SimulateRequest):
    """
    Run behavioral simulation for the requested personas.

    If `personas` is empty in the request body, all four default personas
    are simulated.
    """
    personas = body.personas if body.personas else _DEFAULT_PERSONAS

    results: List[SimulationResult] = []
    for persona in personas:
        result = run_simulation(persona, body.detected_patterns)
        results.append(result)

    return results
