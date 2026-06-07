/**
 * reportController.ts — PDF report generation using PDFKit (local, no AI service call).
 *
 * Generates the forensic report entirely on the backend from session data.
 * This eliminates the cross-service cold-start 502 problem.
 *
 * The report includes:
 *  - Cover page with session metadata
 *  - Executive summary with scores
 *  - Detected dark patterns (one section per pattern)
 *  - Simulation results per persona
 *  - Ethical redesign recommendations
 */

import { Response } from "express";
import PDFDocument from "pdfkit";

import { asyncHandler }  from "../utils/asyncHandler";
import { AuthRequest }   from "../middleware/authMiddleware";
import { getSession, updateSessionReport } from "../database/sessionRepository";

// ── Colour palette ────────────────────────────────────────────────────────────
const C = {
  bg:      "#030610",
  accent:  "#00E5FF",
  purple:  "#7C3AED",
  danger:  "#EF4444",
  success: "#10B981",
  warn:    "#F59E0B",
  text:    "#E2E8F0",
  muted:   "#94A3B8",
  white:   "#FFFFFF",
};

function extractScore(val: unknown, fallback = 0): number {
  if (!val) return fallback;
  if (typeof val === "number") return isNaN(val) ? fallback : Math.round(val);
  if (typeof val === "object" && "score" in (val as object)) {
    return Math.round(Number((val as { score: unknown }).score) || fallback);
  }
  return Math.round(Number(val) || fallback);
}

const REDESIGN: Record<string, string> = {
  "Fake Urgency":       "Remove artificial deadlines. State real deadlines plainly without alarm styling.",
  "Confirm Shaming":    "Replace guilt-framing opt-out text with neutral language. Use equal visual weight for accept/decline.",
  "Forced Continuity":  "Surface cancellation paths clearly. Send plain-language reminders before trial conversions.",
  "Visual Coercion":    "Default all checkboxes to unchecked. Use equal visual prominence for all options.",
  "Roach Motel":        "Make cancellation as easy as sign-up. Implement a one-step cancellation flow.",
  "Sneak Into Basket":  "Never pre-add items. Present supplementary offers as explicit opt-in choices.",
  "Misdirection":       "Use equal visual weight for accept and decline. Follow standard UI conventions for button hierarchy.",
  "Hidden Costs":       "Show the complete price — fees, taxes, add-ons — before the final checkout step.",
  "Price Anchoring":    "Only display genuine, verifiable reference prices. Fabricated 'original' prices are deceptive.",
  "Visual Steering":    "Ensure accept and decline options have equivalent visual prominence.",
};

export const createAnalysisReport = asyncHandler(async (req: AuthRequest, res: Response) => {
  const raw       = req.params.id ?? req.params.sessionId;
  const sessionId = Array.isArray(raw) ? raw[0] : (raw as string);

  const session = await getSession(sessionId);
  if (!session)                            return res.status(404).json({ success: false, message: "Session not found" });
  if (session.userId !== req.user!.userId) return res.status(403).json({ success: false, message: "Forbidden" });

  const s = session as any;

  const patterns:    any[] = s.detectedPatternsJson  ?? [];
  const scores:      any   = s.scoresJson            ?? {};
  const simResults:  any[] = s.simulationResultsJson ?? [];
  const source = s.sourceUrl || s.sourceFilename || "Unknown source";
  const imageUrl: string = s.imageUrl ?? "";

  const manipulation = extractScore(scores.manipulation_score, 0);
  const trust        = extractScore(scores.trust_score, 100);
  const friction     = extractScore(scores.friction_score, 0);
  const fairness     = scores.ux_fairness_index ?? "Unknown";
  const timestamp    = new Date().toISOString();

  // ── Build PDF in memory ─────────────────────────────────────────────────────
  const chunks: Buffer[] = [];
  const doc = new PDFDocument({ margin: 50, size: "A4", autoFirstPage: true });

  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const pdfReady = new Promise<Buffer>((resolve, reject) => {
    doc.on("end",   () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  // ── Cover page ──────────────────────────────────────────────────────────────
  doc.rect(0, 0, doc.page.width, doc.page.height).fill("#030610");

  // Title
  doc.fontSize(28).fillColor(C.accent).font("Helvetica-Bold")
     .text("MIRROR X AI", 50, 120, { align: "center" });
  doc.fontSize(14).fillColor(C.muted).font("Helvetica")
     .text("Forensic Dark Pattern Analysis Report", 50, 160, { align: "center" });

  // Divider
  doc.moveTo(50, 190).lineTo(doc.page.width - 50, 190).strokeColor(C.purple).lineWidth(1).stroke();

  // Metadata table
  const meta = [
    ["Timestamp",  timestamp],
    ["Source",     source.length > 60 ? source.slice(0, 60) + "…" : source],
    ["Session ID", sessionId],
    ["Patterns",   String(patterns.length) + " detected"],
    ["Fairness",   fairness],
  ];
  let my = 210;
  for (const [k, v] of meta) {
    doc.fontSize(9).fillColor(C.muted).font("Helvetica-Bold").text(k, 60, my);
    doc.fontSize(9).fillColor(C.text).font("Helvetica").text(v as string, 200, my);
    my += 18;
  }

  doc.addPage();

  // ── Score summary ───────────────────────────────────────────────────────────
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(C.bg);

  doc.fontSize(16).fillColor(C.accent).font("Helvetica-Bold").text("Risk Score Summary", 50, 50);
  doc.moveTo(50, 72).lineTo(doc.page.width - 50, 72).strokeColor(C.purple).lineWidth(0.5).stroke();

  const scoreRows = [
    { label: "Manipulation Score", value: manipulation, color: C.danger },
    { label: "Trust Score",        value: trust,        color: C.success },
    { label: "Friction Score",     value: friction,     color: C.warn },
  ];

  let sy = 85;
  for (const row of scoreRows) {
    doc.fontSize(10).fillColor(C.muted).font("Helvetica").text(row.label, 50, sy);
    doc.fontSize(10).fillColor(row.color).font("Helvetica-Bold").text(`${row.value}/100`, 200, sy);

    // Bar background
    doc.rect(270, sy + 2, 230, 8).fillColor("#1E293B").fill();
    // Bar fill
    const barW = Math.round((row.value / 100) * 230);
    if (barW > 0) doc.rect(270, sy + 2, barW, 8).fillColor(row.color).fill();

    sy += 24;
  }

  doc.fontSize(10).fillColor(C.muted).font("Helvetica").text("UX Fairness Index", 50, sy);
  const fColor = fairness.toLowerCase().includes("fair") ? C.success :
                 fairness.toLowerCase().includes("moderate") ? C.warn : C.danger;
  doc.fontSize(10).fillColor(fColor).font("Helvetica-Bold").text(fairness, 200, sy);

  sy += 30;

  // ── Detected patterns ───────────────────────────────────────────────────────
  doc.fontSize(16).fillColor(C.accent).font("Helvetica-Bold").text("Detected Dark Patterns", 50, sy);
  sy += 22;
  doc.moveTo(50, sy).lineTo(doc.page.width - 50, sy).strokeColor(C.purple).lineWidth(0.5).stroke();
  sy += 10;

  if (patterns.length === 0) {
    doc.fontSize(10).fillColor(C.muted).font("Helvetica")
       .text("No dark patterns detected in this analysis.", 50, sy);
    sy += 20;
  } else {
    for (let i = 0; i < patterns.length; i++) {
      const p = patterns[i];
      if (sy > doc.page.height - 120) { doc.addPage(); doc.rect(0, 0, doc.page.width, doc.page.height).fill(C.bg); sy = 50; }

      const confColor = p.confidence_level === "High" ? C.danger :
                        p.confidence_level === "Medium" ? C.warn : C.accent;

      doc.fontSize(11).fillColor(C.text).font("Helvetica-Bold")
         .text(`${i + 1}. ${p.category}`, 50, sy);
      doc.fontSize(9).fillColor(confColor).font("Helvetica")
         .text(`${p.confidence_level || "Medium"} confidence  |  ${p.element_identifier || ""}`, 50, sy + 14);

      const explanation = p.explanation || "";
      doc.fontSize(9).fillColor(C.muted).font("Helvetica")
         .text(explanation, 50, sy + 26, { width: doc.page.width - 100, lineGap: 2 });

      const expLines = Math.ceil(explanation.length / 90);
      sy += 48 + expLines * 13;
    }
  }

  // ── Simulation results ──────────────────────────────────────────────────────
  doc.addPage();
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(C.bg);

  doc.fontSize(16).fillColor(C.accent).font("Helvetica-Bold").text("Behavioral Simulation Results", 50, 50);
  doc.moveTo(50, 72).lineTo(doc.page.width - 50, 72).strokeColor(C.purple).lineWidth(0.5).stroke();

  let simY = 85;
  const personas = ["Elderly User", "Distracted User", "Impulsive User", "First-Time User"];
  const simMap: Record<string, any> = {};
  for (const s2 of simResults) simMap[s2.persona] = s2;

  for (const persona of personas) {
    const sim = simMap[persona];
    if (!sim) continue;
    if (simY > doc.page.height - 100) {
      doc.addPage();
      doc.rect(0, 0, doc.page.width, doc.page.height).fill(C.bg);
      simY = 50;
    }

    doc.fontSize(11).fillColor(C.warn).font("Helvetica-Bold").text(persona, 50, simY);
    const summary = sim.behavioral_summary || "No summary available.";
    doc.fontSize(9).fillColor(C.muted).font("Helvetica")
       .text(summary, 50, simY + 14, { width: doc.page.width - 100, lineGap: 2 });

    const sumLines = Math.ceil(summary.length / 90);
    simY += 30 + sumLines * 13;
  }

  if (simResults.length === 0) {
    doc.fontSize(10).fillColor(C.muted).font("Helvetica")
       .text("No simulation results available for this session.", 50, 85);
  }

  // ── Ethical redesign recommendations ───────────────────────────────────────
  doc.addPage();
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(C.bg);

  doc.fontSize(16).fillColor(C.accent).font("Helvetica-Bold").text("Ethical Redesign Recommendations", 50, 50);
  doc.moveTo(50, 72).lineTo(doc.page.width - 50, 72).strokeColor(C.purple).lineWidth(0.5).stroke();

  let recY = 85;
  const seen = new Set<string>();

  if (patterns.length === 0) {
    doc.fontSize(10).fillColor(C.muted).font("Helvetica")
       .text("No patterns detected — no redesign recommendations required.", 50, recY);
  } else {
    for (const p of patterns) {
      if (seen.has(p.category)) continue;
      seen.add(p.category);

      if (recY > doc.page.height - 100) {
        doc.addPage();
        doc.rect(0, 0, doc.page.width, doc.page.height).fill(C.bg);
        recY = 50;
      }

      const rec = REDESIGN[p.category] ||
        `Review the '${p.category}' pattern and redesign the relevant UI element to prioritize user autonomy and transparency.`;

      doc.fontSize(11).fillColor(C.danger).font("Helvetica-Bold").text(p.category, 50, recY);
      doc.fontSize(9).fillColor(C.muted).font("Helvetica")
         .text(rec, 50, recY + 14, { width: doc.page.width - 100, lineGap: 2 });

      const recLines = Math.ceil(rec.length / 90);
      recY += 30 + recLines * 13;
    }
  }

  // ── Footer disclaimer ───────────────────────────────────────────────────────
  doc.addPage();
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(C.bg);
  doc.fontSize(10).fillColor(C.muted).font("Helvetica-Bold").text("Disclaimer", 50, 50);
  doc.fontSize(9).fillColor(C.muted).font("Helvetica")
     .text(
       "Findings in this report represent AI-assisted pattern analysis and do not constitute legal advice. " +
       "All assessments use hedged language and reflect probabilistic observations about UI design patterns. " +
       "MIRROR X AI forensic reports are intended for educational and UX research purposes only.",
       50, 70, { width: doc.page.width - 100, lineGap: 3 }
     );

  doc.end();

  const pdfBuffer = await pdfReady;

  await updateSessionReport(sessionId, `report-${sessionId}.pdf`);

  const filename = `mirrorx-report-${sessionId}.pdf`;
  res.setHeader("Content-Type",        "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length",      String(pdfBuffer.length));
  return res.send(pdfBuffer);
});
