from pydantic import BaseModel

from typing import (
    List,
    Optional,
    Literal,
)


class OCRError(Exception):
    """Raised when the OCR engine fails to process an image."""

    def __init__(self, message: str, stage: str = "ocr"):
        super().__init__(message)
        self.stage = stage
        self.message = message

    def __repr__(self) -> str:
        return f"OCRError(message={self.message!r}, stage={self.stage!r})"


class BoundingBox(BaseModel):
    x: float
    y: float
    width: float
    height: float


class OCRWord(BaseModel):
    text: str
    confidence: float
    bbox: BoundingBox


class OCRResult(BaseModel):
    text: str
    words: List[OCRWord]


class RuleFlag(BaseModel):
    pattern_category: str
    element_identifier: str
    matched_rule_name: str
    confidence_signals: int
    bounding_box: Optional[
        BoundingBox
    ] = None


class DetectedPattern(BaseModel):
    category: str

    element_identifier: str

    confidence_level: Literal[
        "Low",
        "Medium",
        "High"
    ]

    explanation: str

    bounding_box: Optional[
        BoundingBox
    ] = None


class SimulationFinding(BaseModel):
    element_identifier: str
    severity: Literal["Low", "Medium", "High"]
    description: str


class SimulationResult(BaseModel):
    persona: str
    confusion_points: List[SimulationFinding]
    pressure_points: List[SimulationFinding]
    hidden_risk_areas: List[SimulationFinding]
    accidental_consent_zones: List[SimulationFinding]
    behavioral_summary: str  # Gemini-generated, narrated by AI_Investigator


class ScoreBreakdown(BaseModel):
    score: float  # 0–100, clamped
    contributions: List[dict]  # [{pattern_name: str, points: float}]


class AnalysisScores(BaseModel):
    manipulation_score: ScoreBreakdown
    trust_score: ScoreBreakdown
    ux_fairness_index: Literal["Fair", "Moderate Risk", "High Risk"]
    friction_score: ScoreBreakdown


class ChatRequest(BaseModel):
    session_context: dict
    history: List[dict]  # last 10 messages [{role, content}]
    user_message: str


class SimulateRequest(BaseModel):
    detected_patterns: List[DetectedPattern]
    personas: List[str]  # all four by default


class ScoreRequest(BaseModel):
    detected_patterns: List[DetectedPattern]


class ReportRequest(BaseModel):
    session_id: str
    analysis_result: dict  # full session data
