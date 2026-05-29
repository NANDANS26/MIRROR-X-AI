from fastapi import APIRouter

from pydantic import BaseModel

from app.reports.report_generator import (
    generate_report
)

router = APIRouter()


class ReportRequest(BaseModel):
    session_id: str

    analysis_result: dict


@router.post("/report/generate")
async def create_report(
    body: ReportRequest
):
    file_path = generate_report(
        body.session_id,
        body.analysis_result
    )

    return {
        "success": True,
        "file_path": file_path
    }