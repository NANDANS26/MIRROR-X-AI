import os

from fastapi import (
    APIRouter,
    UploadFile,
    File,
)

from app.analyzers.ocr_engine import (
    extract_text
)

from app.analyzers.rule_engine import (
    analyze_content
)

from app.analyzers.analyzer import (
    detect_patterns
)

from app.services.gemini_client import (
    generate_ai_analysis
)

from app.scoring.scoring_engine import (
    compute_scores
)

router = APIRouter()

UPLOAD_DIR = "temp_uploads"

os.makedirs(
    UPLOAD_DIR,
    exist_ok=True
)


@router.post("/analyze/upload")
async def analyze_upload(
    file: UploadFile = File(...)
):
    file_path = os.path.join(
        UPLOAD_DIR,
        file.filename
    )

    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())

    ocr_result = extract_text(file_path)

    rule_flags = analyze_content(
        ocr_result
    )

    detected_patterns = detect_patterns(
        rule_flags
    )

    ai_analysis = generate_ai_analysis(
        ocr_result,
        rule_flags
    )

    scores = compute_scores(
        detected_patterns
    )

    return {
        "success": True,

        "ocr_result": (
            ocr_result.model_dump()
        ),

        "rule_flags": [
            flag.model_dump()
            for flag in rule_flags
        ],

        "detected_patterns": [
            pattern.model_dump()
            for pattern in detected_patterns
        ],

        "scores": scores,

        "ai_analysis": ai_analysis
        
    }