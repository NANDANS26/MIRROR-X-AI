"""
report_generator.py
-------------------
Generates a PDF forensic report for a MIRROR X AI analysis session.

Returns the PDF as raw bytes so the caller (API layer) can stream it
directly to the client without touching the filesystem.

Raises ReportGenerationError on any unrecoverable failure.
"""

import io
import os
from datetime import datetime, timezone

from reportlab.platypus import (
    BaseDocTemplate,
    PageTemplate,
    Frame,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Image,
    HRFlowable,
    KeepTogether,
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.pdfgen import canvas as pdfgen_canvas


# ---------------------------------------------------------------------------
# Custom exception
# ---------------------------------------------------------------------------

class ReportGenerationError(Exception):
    """Raised when PDF report generation fails for any reason."""

    def __init__(self, message: str, cause: Exception | None = None):
        super().__init__(message)
        self.message = message
        self.cause = cause

    def __repr__(self) -> str:
        return (
            f"ReportGenerationError(message={self.message!r}, "
            f"cause={self.cause!r})"
        )


# ---------------------------------------------------------------------------
# Page-number canvas maker
# ---------------------------------------------------------------------------

PLATFORM_NAME = "MIRROR X AI v1.0"
FOOTER_COLOR = colors.HexColor("#94A3B8")
HEADER_COLOR = colors.HexColor("#06B6D4")
ACCENT_COLOR = colors.HexColor("#2563EB")
DANGER_COLOR = colors.HexColor("#EF4444")
SUCCESS_COLOR = colors.HexColor("#10B981")
WARNING_COLOR = colors.HexColor("#F59E0B")
SURFACE_COLOR = colors.HexColor("#0F172A")
TEXT_COLOR = colors.HexColor("#1E293B")


def _make_page_canvas_class(header_left: str, header_right: str):
    """Return a canvas class that draws a header and footer on every page."""

    class _NumberedCanvas(pdfgen_canvas.Canvas):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self._saved_page_states: list[dict] = []

        def showPage(self):
            self._saved_page_states.append(dict(self.__dict__))
            self._startPage()

        def save(self):
            """Add page numbers across all pages after building is done."""
            total = len(self._saved_page_states)
            for state in self._saved_page_states:
                self.__dict__.update(state)
                self._draw_header_footer(self._pageNumber, total)
                super().showPage()
            super().save()

        def _draw_header_footer(self, page_num: int, total: int):
            width, height = letter
            self.saveState()

            # ---- header bar ----
            self.setFillColor(SURFACE_COLOR)
            self.rect(0, height - 0.55 * inch, width, 0.55 * inch, fill=1, stroke=0)

            self.setFont("Helvetica-Bold", 8)
            self.setFillColor(HEADER_COLOR)
            self.drawString(0.5 * inch, height - 0.35 * inch, header_left)

            self.setFont("Helvetica", 7)
            self.setFillColor(FOOTER_COLOR)
            self.drawRightString(
                width - 0.5 * inch, height - 0.35 * inch, header_right
            )

            # ---- footer bar ----
            self.setFillColor(SURFACE_COLOR)
            self.rect(0, 0, width, 0.45 * inch, fill=1, stroke=0)

            self.setFont("Helvetica", 7)
            self.setFillColor(FOOTER_COLOR)
            self.drawString(
                0.5 * inch,
                0.18 * inch,
                f"{PLATFORM_NAME}  |  Forensic Analysis Report",
            )
            self.drawRightString(
                width - 0.5 * inch,
                0.18 * inch,
                f"Page {page_num} of {total}",
            )

            self.restoreState()

    return _NumberedCanvas


# ---------------------------------------------------------------------------
# Style helpers
# ---------------------------------------------------------------------------

def _build_styles():
    base = getSampleStyleSheet()

    custom: dict[str, ParagraphStyle] = {}

    custom["ReportTitle"] = ParagraphStyle(
        "ReportTitle",
        parent=base["Title"],
        fontSize=22,
        leading=28,
        textColor=ACCENT_COLOR,
        alignment=TA_CENTER,
        spaceAfter=6,
    )
    custom["ReportSubtitle"] = ParagraphStyle(
        "ReportSubtitle",
        parent=base["Normal"],
        fontSize=10,
        leading=14,
        textColor=FOOTER_COLOR,
        alignment=TA_CENTER,
        spaceAfter=4,
    )
    custom["SectionHeading"] = ParagraphStyle(
        "SectionHeading",
        parent=base["Heading1"],
        fontSize=13,
        leading=18,
        textColor=ACCENT_COLOR,
        spaceBefore=18,
        spaceAfter=6,
        borderPad=4,
    )
    custom["SubHeading"] = ParagraphStyle(
        "SubHeading",
        parent=base["Heading2"],
        fontSize=11,
        leading=14,
        textColor=HEADER_COLOR,
        spaceBefore=10,
        spaceAfter=4,
    )
    custom["Body"] = ParagraphStyle(
        "Body",
        parent=base["BodyText"],
        fontSize=9,
        leading=13,
        textColor=TEXT_COLOR,
        spaceAfter=4,
    )
    custom["SmallMeta"] = ParagraphStyle(
        "SmallMeta",
        parent=base["Normal"],
        fontSize=8,
        leading=11,
        textColor=FOOTER_COLOR,
    )
    custom["TOCEntry"] = ParagraphStyle(
        "TOCEntry",
        parent=base["Normal"],
        fontSize=9,
        leading=13,
        textColor=TEXT_COLOR,
        leftIndent=12,
    )
    custom["BulletItem"] = ParagraphStyle(
        "BulletItem",
        parent=base["Normal"],
        fontSize=9,
        leading=13,
        textColor=TEXT_COLOR,
        leftIndent=18,
        bulletIndent=6,
        spaceAfter=2,
    )
    custom["PatternHeading"] = ParagraphStyle(
        "PatternHeading",
        parent=base["Normal"],
        fontSize=10,
        leading=14,
        textColor=DANGER_COLOR,
        fontName="Helvetica-Bold",
        spaceBefore=8,
        spaceAfter=2,
    )
    custom["PersonaHeading"] = ParagraphStyle(
        "PersonaHeading",
        parent=base["Normal"],
        fontSize=10,
        leading=14,
        textColor=WARNING_COLOR,
        fontName="Helvetica-Bold",
        spaceBefore=8,
        spaceAfter=2,
    )

    return custom


# ---------------------------------------------------------------------------
# Section builders
# ---------------------------------------------------------------------------

def _hr(styles):
    return HRFlowable(
        width="100%",
        thickness=0.5,
        color=colors.HexColor("#CBD5E1"),
        spaceAfter=6,
        spaceBefore=2,
    )


def _section_heading(title: str, styles: dict):
    return Paragraph(title, styles["SectionHeading"])


def _build_cover_and_toc(session_data: dict, styles: dict):
    """Cover block: platform name, timestamp, source, session ID."""
    source = session_data.get("source_url") or session_data.get(
        "source_filename", "Unknown source"
    )
    session_id = session_data.get("session_id", "N/A")
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    elements = []

    elements.append(Spacer(1, 0.3 * inch))
    elements.append(Paragraph(PLATFORM_NAME, styles["ReportTitle"]))
    elements.append(Paragraph("Forensic Dark Pattern Analysis Report", styles["ReportSubtitle"]))
    elements.append(Spacer(1, 0.1 * inch))

    meta_data = [
        ["Timestamp (ISO 8601)", ts],
        ["Analyzed Source", source],
        ["Session ID", session_id],
        ["Platform", PLATFORM_NAME],
    ]
    meta_table = Table(
        meta_data,
        colWidths=[2.2 * inch, 4.3 * inch],
        hAlign="CENTER",
    )
    meta_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F1F5F9")),
                ("TEXTCOLOR", (0, 0), (0, -1), ACCENT_COLOR),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("LEADING", (0, 0), (-1, -1), 12),
                ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    elements.append(meta_table)
    elements.append(Spacer(1, 0.25 * inch))
    elements.append(_hr(styles))

    # --- Table of Contents (simple manual list) ---
    elements.append(_section_heading("Table of Contents", styles))
    toc_sections = [
        "1. Executive Summary",
        "2. Detected Dark Patterns",
        "3. Risk Scores",
        "4. Behavioral Simulation Summaries",
        "5. Ethical Redesign Recommendations",
        "6. Annotated Screenshot",
    ]
    for entry in toc_sections:
        elements.append(Paragraph(f"• {entry}", styles["TOCEntry"]))
    elements.append(Spacer(1, 0.15 * inch))
    elements.append(_hr(styles))

    return elements, ts


def _build_executive_summary(session_data: dict, styles: dict):
    elements = [_section_heading("1. Executive Summary", styles)]

    patterns = session_data.get("detected_patterns", [])
    scores = session_data.get("scores", {})
    source = session_data.get("source_url") or session_data.get(
        "source_filename", "the analyzed interface"
    )

    manipulation = _score_value(scores.get("manipulation_score"))
    trust = _score_value(scores.get("trust_score"))
    friction = _score_value(scores.get("friction_score"))
    ux_fairness = scores.get("ux_fairness_index", "N/A")

    summary_lines = [
        f"This report presents the findings of an automated dark pattern forensic "
        f"analysis conducted on <b>{source}</b> using {PLATFORM_NAME}.",
        "",
        f"A total of <b>{len(patterns)} dark pattern(s)</b> were detected across the "
        f"analyzed interface. The overall risk profile is summarized below:",
        "",
        f"• <b>Manipulation Score:</b> {manipulation} / 100",
        f"• <b>Trust Score:</b> {trust} / 100",
        f"• <b>Friction Score:</b> {friction} / 100",
        f"• <b>UX Fairness Index:</b> {ux_fairness}",
        "",
        "Behavioral simulations were run across four user personas: Elderly User, "
        "Distracted User, Impulsive User, and First-Time User. Detailed findings are "
        "presented in subsequent sections.",
        "",
        "<i>Disclaimer: Findings in this report represent AI-assisted pattern analysis "
        "and do not constitute legal advice. All assessments use hedged language and "
        "reflect probabilistic observations about UI design patterns.</i>",
    ]

    for line in summary_lines:
        if line == "":
            elements.append(Spacer(1, 6))
        else:
            elements.append(Paragraph(line, styles["Body"]))

    elements.append(_hr(styles))
    return elements


def _score_value(score_field) -> str:
    """Extract numeric score from either a dict (ScoreBreakdown) or a scalar."""
    if score_field is None:
        return "N/A"
    if isinstance(score_field, dict):
        val = score_field.get("score")
        return f"{val:.1f}" if val is not None else "N/A"
    try:
        return f"{float(score_field):.1f}"
    except (TypeError, ValueError):
        return str(score_field)


def _build_detected_patterns(session_data: dict, styles: dict):
    elements = [_section_heading("2. Detected Dark Patterns", styles)]

    patterns = session_data.get("detected_patterns", [])
    if not patterns:
        elements.append(
            Paragraph(
                "No dark patterns were detected in the analyzed interface.",
                styles["Body"],
            )
        )
        elements.append(_hr(styles))
        return elements

    for i, pattern in enumerate(patterns, start=1):
        category = pattern.get("category", "Unknown")
        confidence = pattern.get("confidence_level", "N/A")
        explanation = pattern.get("explanation", "No explanation available.")
        element_id = pattern.get("element_identifier", "N/A")

        confidence_color = {
            "High": DANGER_COLOR,
            "Medium": WARNING_COLOR,
            "Low": colors.HexColor("#EAB308"),
        }.get(confidence, TEXT_COLOR)

        block = [
            Paragraph(
                f"Pattern {i}: {category}",
                styles["PatternHeading"],
            ),
            Paragraph(
                f'<font color="#94A3B8"><b>Confidence:</b></font> '
                f'<font color="{confidence_color.hexval() if hasattr(confidence_color, "hexval") else "#000"}">'
                f"{confidence}</font>   "
                f'<font color="#94A3B8"><b>Element:</b></font> {element_id}',
                styles["SmallMeta"],
            ),
            Paragraph(explanation, styles["Body"]),
            Spacer(1, 6),
        ]
        elements.extend(block)

    elements.append(_hr(styles))
    return elements


def _build_risk_scores(session_data: dict, styles: dict):
    elements = [_section_heading("3. Risk Scores", styles)]

    scores = session_data.get("scores", {})

    manipulation = scores.get("manipulation_score", {})
    trust = scores.get("trust_score", {})
    friction = scores.get("friction_score", {})
    ux_fairness = scores.get("ux_fairness_index", "N/A")

    score_rows = [
        ["Score Metric", "Value", "UX Fairness Index"],
        [
            "Manipulation Score",
            f"{_score_value(manipulation)} / 100",
            ux_fairness,
        ],
        ["Trust Score", f"{_score_value(trust)} / 100", ""],
        ["Friction Score", f"{_score_value(friction)} / 100", ""],
    ]

    score_table = Table(
        score_rows,
        colWidths=[2.5 * inch, 1.8 * inch, 2.2 * inch],
        hAlign="LEFT",
    )
    score_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), ACCENT_COLOR),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("LEADING", (0, 0), (-1, -1), 12),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("SPAN", (2, 1), (2, 3)),
                ("VALIGN", (2, 1), (2, 3), "MIDDLE"),
                ("ALIGN", (1, 0), (2, -1), "CENTER"),
            ]
        )
    )
    elements.append(score_table)
    elements.append(Spacer(1, 0.1 * inch))

    # Contribution breakdowns
    for label, score_field in [
        ("Manipulation Score Contributions", manipulation),
        ("Trust Score Contributions", trust),
        ("Friction Score Contributions", friction),
    ]:
        if isinstance(score_field, dict):
            contributions = score_field.get("contributions", [])
            if contributions:
                elements.append(Paragraph(label, styles["SubHeading"]))
                for contrib in contributions:
                    pattern_name = contrib.get("pattern_name", "Unknown")
                    points = contrib.get("points", 0)
                    elements.append(
                        Paragraph(
                            f"• {pattern_name}: <b>{points:.1f} pts</b>",
                            styles["BulletItem"],
                        )
                    )

    elements.append(_hr(styles))
    return elements


def _build_simulation_summaries(session_data: dict, styles: dict):
    elements = [_section_heading("4. Behavioral Simulation Summaries", styles)]

    simulations = session_data.get("simulation_results", [])
    if not simulations:
        elements.append(
            Paragraph(
                "No behavioral simulation results are available for this session.",
                styles["Body"],
            )
        )
        elements.append(_hr(styles))
        return elements

    persona_order = [
        "Elderly User",
        "Distracted User",
        "Impulsive User",
        "First-Time User",
    ]

    # Index simulations by persona for ordered output
    sim_map: dict[str, dict] = {}
    for sim in simulations:
        persona = sim.get("persona", "Unknown")
        sim_map[persona] = sim

    # Emit in canonical order, then any remaining
    ordered_personas = [p for p in persona_order if p in sim_map]
    for extra in sim_map:
        if extra not in ordered_personas:
            ordered_personas.append(extra)

    for persona in ordered_personas:
        sim = sim_map[persona]
        elements.append(Paragraph(f"Persona: {persona}", styles["PersonaHeading"]))

        behavioral_summary = sim.get("behavioral_summary", "")
        if behavioral_summary:
            elements.append(Paragraph(behavioral_summary, styles["Body"]))
            elements.append(Spacer(1, 4))

        # Finding categories
        finding_sections = [
            ("Confusion Points", sim.get("confusion_points", [])),
            ("Pressure Points", sim.get("pressure_points", [])),
            ("Hidden Risk Areas", sim.get("hidden_risk_areas", [])),
            ("Accidental Consent Zones", sim.get("accidental_consent_zones", [])),
        ]
        for section_title, findings in finding_sections:
            if findings:
                elements.append(Paragraph(section_title, styles["SubHeading"]))
                for finding in findings:
                    severity = finding.get("severity", "Low")
                    description = finding.get("description", "")
                    element_id = finding.get("element_identifier", "")
                    sev_color = {
                        "High": "#EF4444",
                        "Medium": "#F59E0B",
                        "Low": "#EAB308",
                    }.get(severity, "#64748B")
                    elements.append(
                        Paragraph(
                            f'<font color="{sev_color}"><b>[{severity}]</b></font> '
                            f"{element_id} — {description}",
                            styles["BulletItem"],
                        )
                    )

        elements.append(Spacer(1, 8))

    elements.append(_hr(styles))
    return elements


def _build_recommendations(session_data: dict, styles: dict):
    elements = [_section_heading("5. Ethical Redesign Recommendations", styles)]

    patterns = session_data.get("detected_patterns", [])
    if not patterns:
        elements.append(
            Paragraph(
                "No dark patterns detected; no redesign recommendations are required.",
                styles["Body"],
            )
        )
        elements.append(_hr(styles))
        return elements

    _redesign_map = {
        "Fake Urgency": (
            "Replace countdown timers and scarcity indicators with honest, "
            "factual availability information. Avoid language such as 'Only 2 left!' "
            "unless inventory data is real-time and verifiable."
        ),
        "Confirm Shaming": (
            "Rewrite opt-out labels using neutral, factual language. Both accept and "
            "decline options should be presented with equal visual weight and no "
            "emotional coercion (e.g., 'No thanks' instead of 'No, I don't want to save money')."
        ),
        "Forced Continuity": (
            "Surface cancellation and subscription-end options clearly in the account "
            "settings. Send a plain-language reminder before any trial converts to a "
            "paid subscription, allowing users to cancel without friction."
        ),
        "Visual Coercion": (
            "Apply consistent visual hierarchy that does not artificially demote "
            "user-beneficial choices. Primary actions and secondary actions should be "
            "differentiated by function, not by coercive contrast."
        ),
        "Roach Motel": (
            "Ensure the path to cancel, unsubscribe, or delete an account is as "
            "prominent and simple as the path to sign up. Implement a direct "
            "one-step cancellation flow."
        ),
        "Sneak Into Basket": (
            "Remove all pre-selected add-ons or optional items from user carts. "
            "Present supplementary items as opt-in choices with explicit, unchecked "
            "checkboxes and clear pricing."
        ),
        "Misdirection": (
            "Align button labels with their actual function. Avoid placing "
            "destructive-action buttons where users expect confirmatory actions. "
            "Use standard UI conventions for primary and secondary actions."
        ),
        "Hidden Costs": (
            "Display the total price — including fees, taxes, and subscriptions — "
            "at the earliest appropriate stage of the user journey. Do not reveal "
            "mandatory charges only at the final checkout step."
        ),
    }

    elements.append(
        Paragraph(
            "The following recommendations address each detected dark pattern with "
            "an ethical redesign approach consistent with GDPR transparency principles "
            "and consumer protection standards.",
            styles["Body"],
        )
    )
    elements.append(Spacer(1, 8))

    seen_categories: set[str] = set()
    for pattern in patterns:
        category = pattern.get("category", "Unknown")
        if category in seen_categories:
            continue
        seen_categories.add(category)

        recommendation = _redesign_map.get(
            category,
            (
                f"Review the '{category}' pattern and redesign the relevant UI element "
                "to prioritize user autonomy, informed consent, and transparent "
                "communication of choices and consequences."
            ),
        )
        elements.append(Paragraph(f"Pattern: {category}", styles["PatternHeading"]))
        elements.append(Paragraph(recommendation, styles["Body"]))
        elements.append(Spacer(1, 6))

    elements.append(_hr(styles))
    return elements


def _build_screenshot_section(session_data: dict, styles: dict):
    elements = [_section_heading("6. Annotated Screenshot", styles)]

    image_url = session_data.get("image_url") or session_data.get("screenshot_path")

    if image_url and image_url.startswith("http"):
        elements.append(
            Paragraph(
                "The screenshot below was captured during the investigation.",
                styles["Body"],
            )
        )
        elements.append(Spacer(1, 8))

        try:
            import urllib.request
            import tempfile
            # Download from Cloudinary URL to a temp file for embedding
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
                urllib.request.urlretrieve(image_url, tmp.name)
                tmp_path = tmp.name

            max_width  = 6.0 * inch
            max_height = 4.5 * inch
            img        = Image(tmp_path, width=max_width, height=max_height)
            img.hAlign = "CENTER"
            elements.append(img)
            elements.append(Spacer(1, 6))
            elements.append(
                Paragraph(
                    "<i>Figure 1: Analyzed screenshot.</i>",
                    styles["SmallMeta"],
                )
            )

            import os
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

        except Exception as img_err:
            elements.append(
                Paragraph(
                    f"Screenshot could not be embedded: {img_err}. "
                    "Pattern overlay annotations remain available in the interactive platform.",
                    styles["Body"],
                )
            )
    elif image_url and os.path.isfile(image_url):
        # Local path fallback (local dev only)
        try:
            img        = Image(image_url, width=6.0 * inch, height=4.5 * inch)
            img.hAlign = "CENTER"
            elements.append(img)
        except Exception as img_err:
            elements.append(Paragraph(f"Screenshot could not be embedded: {img_err}", styles["Body"]))
    else:
        elements.append(
            Paragraph(
                "No screenshot was available for this session. "
                "Pattern overlay annotations are available in the MIRROR X AI interactive platform.",
                styles["Body"],
            )
        )

    return elements


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def generate_report(session_data: dict) -> bytes:
    """
    Generate a PDF forensic report from session_data and return it as bytes.

    Parameters
    ----------
    session_data : dict
        Expected keys:
          - session_id (str)
          - source_url (str) OR source_filename (str)
          - detected_patterns (list[dict])
          - scores (dict)  — manipulation_score, trust_score, friction_score,
                             ux_fairness_index
          - simulation_results (list[dict])
          - screenshot_path (str, optional)

    Returns
    -------
    bytes
        Raw PDF binary.

    Raises
    ------
    ReportGenerationError
        On any failure during PDF construction.
    """
    try:
        buffer = io.BytesIO()

        source = session_data.get("source_url") or session_data.get(
            "source_filename", "Unknown source"
        )
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        header_left = f"{PLATFORM_NAME}  |  {source[:60]}"
        header_right = ts

        NumberedCanvas = _make_page_canvas_class(header_left, header_right)

        doc = BaseDocTemplate(
            buffer,
            pagesize=letter,
            leftMargin=0.75 * inch,
            rightMargin=0.75 * inch,
            topMargin=0.75 * inch,
            bottomMargin=0.65 * inch,
            title=f"{PLATFORM_NAME} Forensic Report",
            author=PLATFORM_NAME,
        )

        # Single page template filling the content frame between margins/header/footer
        content_frame = Frame(
            doc.leftMargin,
            doc.bottomMargin,
            doc.width,
            doc.height,
            id="main",
        )
        doc.addPageTemplates(
            [PageTemplate(id="main", frames=content_frame)]
        )

        styles = _build_styles()

        elements = []

        # Cover + TOC
        cover_elements, _ = _build_cover_and_toc(session_data, styles)
        elements.extend(cover_elements)

        # 1. Executive Summary
        elements.extend(_build_executive_summary(session_data, styles))

        # 2. Detected Dark Patterns
        elements.extend(_build_detected_patterns(session_data, styles))

        # 3. Risk Scores
        elements.extend(_build_risk_scores(session_data, styles))

        # 4. Behavioral Simulation Summaries
        elements.extend(_build_simulation_summaries(session_data, styles))

        # 5. Ethical Redesign Recommendations
        elements.extend(_build_recommendations(session_data, styles))

        # 6. Annotated Screenshot
        elements.extend(_build_screenshot_section(session_data, styles))

        doc.build(elements, canvasmaker=NumberedCanvas)

        return buffer.getvalue()

    except ReportGenerationError:
        raise
    except Exception as exc:
        raise ReportGenerationError(
            f"Failed to generate PDF report: {exc}", cause=exc
        ) from exc
