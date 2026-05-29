from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
)

from reportlab.lib.styles import (
    getSampleStyleSheet,
)

from reportlab.lib.pagesizes import letter

import os


def generate_report(
    session_id: str,
    analysis_result: dict
):
    reports_dir = "generated_reports"

    os.makedirs(
        reports_dir,
        exist_ok=True
    )

    file_path = (
        f"{reports_dir}/"
        f"{session_id}.pdf"
    )

    doc = SimpleDocTemplate(
        file_path,
        pagesize=letter
    )

    styles = (
        getSampleStyleSheet()
    )

    elements = []

    title = Paragraph(
        "MIRROR X AI Analysis Report",
        styles["Title"]
    )

    elements.append(title)

    elements.append(
        Spacer(1, 20)
    )

    scores = analysis_result.get(
        "scores",
        {}
    )

    score_section = Paragraph(
        f"""
        <b>Manipulation Score:</b>
        {scores.get('manipulation_score', 0)}
        <br/>

        <b>Trust Score:</b>
        {scores.get('trust_score', 0)}
        <br/>

        <b>Friction Score:</b>
        {scores.get('friction_score', 0)}
        <br/>

        <b>UX Fairness:</b>
        {scores.get('ux_fairness_index', 'Unknown')}
        """,
        styles["BodyText"]
    )

    elements.append(
        score_section
    )

    elements.append(
        Spacer(1, 20)
    )

    patterns = (
        analysis_result.get(
            "detected_patterns",
            []
        )
    )

    pattern_title = Paragraph(
        "Detected Patterns",
        styles["Heading2"]
    )

    elements.append(
        pattern_title
    )

    for pattern in patterns:
        paragraph = Paragraph(
            f"""
            <b>Category:</b>
            {pattern['category']}
            <br/>

            <b>Confidence:</b>
            {pattern['confidence_level']}
            <br/>

            <b>Explanation:</b>
            {pattern['explanation']}
            """,
            styles["BodyText"]
        )

        elements.append(
            paragraph
        )

        elements.append(
            Spacer(1, 12)
        )

    ai_section = Paragraph(
        f"""
        <b>AI Analysis:</b>
        <br/><br/>
        {
            analysis_result.get(
                'ai_analysis',
                'No analysis'
            )
        }
        """,
        styles["BodyText"]
    )

    elements.append(
        ai_section
    )

    doc.build(elements)

    return file_path