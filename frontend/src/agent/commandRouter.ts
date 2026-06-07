export type AgentAction =
  | "SHOW_HIDDEN_COSTS"
  | "SHOW_URGENCY"
  | "SHOW_SCORE"
  | "GENERATE_REPORT"
  | "EXPLAIN_FINDINGS"
  | "START_REPLAY"
  | "UNKNOWN";

export const routeCommand = (
  input: string
): AgentAction => {
  const text = input.toLowerCase();

  if (text.includes("hidden cost")) {
    return "SHOW_HIDDEN_COSTS";
  }

  if (text.includes("urgency")) {
    return "SHOW_URGENCY";
  }

  if (text.includes("score")) {
    return "SHOW_SCORE";
  }

  // START_REPLAY — matches before "report" to avoid substring collision
  if (
    text.includes("replay") ||
    text.includes("manipulation replay") ||
    text.includes("show replay")
  ) {
    return "START_REPLAY";
  }

  // GENERATE_REPORT
  if (
    text.includes("generate report") ||
    text.includes("create report") ||
    text.includes("forensic report") ||
    text.includes("download report") ||
    text.includes("report")
  ) {
    return "GENERATE_REPORT";
  }

  if (text.includes("explain")) {
    return "EXPLAIN_FINDINGS";
  }

  return "UNKNOWN";
};
