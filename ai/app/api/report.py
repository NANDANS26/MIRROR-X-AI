from fastapi import APIRouter
from fastapi.responses import Response

from pydantic import BaseModel

from app.reports.report_generator import (
    generate_report,
    ReportGenerationError,
)

router = APIRouter()


class ReportRequest(BaseModel):
    session_id: str
    analysis_result: dict


@router.post("/report/generate")
async def create_report(body: ReportRequest):
    """
    Generate a PDF forensic report and return it as an application/pdf response.

    The session_id is merged into analysis_result so report_generator has a
    single, self-contained session_data dict to work with.
    """
    session_data = dict(body.analysis_result)
    session_data.setdefault("session_id", body.session_id)

    try:
        pdf_bytes = generate_report(session_data)
    except ReportGenerationError as exc:
        return Response(
            content=str(exc),
            status_code=500,
            media_type="text/plain",
        )

    filename = f"mirror-x-report-{body.session_id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(pdf_bytes)),
        },
    )
