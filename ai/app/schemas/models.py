from pydantic import BaseModel

from typing import (
    List,
    Optional,
    Literal,
)


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