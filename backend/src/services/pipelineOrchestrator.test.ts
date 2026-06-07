/**
 * Tests for Pipeline Orchestrator.
 *
 * Property 16: For any Analysis_Session that runs to completion, the Platform
 * SHALL emit exactly 5 `stage_progress` events in the correct order:
 *   capture → rule_engine → ai_analysis → simulation → scoring
 *
 * Unit tests:
 * - `session_failed` emitted with correct `failedStage` on each stage throw
 * - AI Service retry logic: fail once then succeed → pipeline completes
 *
 * Validates: Requirements 11.2, 11.6
 */

// ── Env bootstrap (must happen before any module import) ──────────────────────
process.env.JWT_SECRET = "test-secret";
process.env.DATABASE_URL = "postgresql://test:test@localhost/test";
process.env.AI_SERVICE_URL = "http://localhost:8000";

// ── Mock: configs/env ─────────────────────────────────────────────────────────
jest.mock("../configs/env", () => ({
  ENV: {
    JWT_SECRET: "test-secret",
    DATABASE_URL: "postgresql://test:test@localhost/test",
    AI_SERVICE_URL: "http://localhost:8000",
    PORT: "3001",
  },
}));

// ── Mock: Socket.io io export ─────────────────────────────────────────────────
const emitMock = jest.fn();
const toMock = jest.fn().mockReturnValue({ emit: emitMock });

jest.mock("../server", () => ({
  io: { to: toMock },
}));

// ── Mock: axios ───────────────────────────────────────────────────────────────
import axios from "axios";
jest.mock("axios");
const mockAxios = axios as jest.Mocked<typeof axios>;

// ── Mock: prisma ──────────────────────────────────────────────────────────────
const mockTx = {
  analysisSession: {
    update: jest.fn().mockResolvedValue({}),
  },
  detectedPatternRecord: {
    createMany: jest.fn().mockResolvedValue({}),
  },
  simulationResultRecord: {
    createMany: jest.fn().mockResolvedValue({}),
  },
  scoringResult: {
    upsert: jest.fn().mockResolvedValue({}),
  },
};

const mockTransaction = jest.fn().mockImplementation(async (cb: (tx: typeof mockTx) => Promise<void>) => {
  return cb(mockTx);
});

jest.mock("../database/prisma", () => ({
  prisma: {
    $transaction: mockTransaction,
    analysisSession: {
      update: jest.fn().mockResolvedValue({}),
    },
  },
}));

// ── Mock: fs — preserve real fs, only stub createReadStream ──────────────────
jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  createReadStream: jest.fn().mockReturnValue({}),
}));

// ── Mock: form-data ───────────────────────────────────────────────────────────
jest.mock("form-data", () => {
  return jest.fn().mockImplementation(() => ({
    append: jest.fn(),
    getHeaders: jest.fn().mockReturnValue({ "content-type": "multipart/form-data" }),
  }));
});

// ── Mock: @prisma/client — prevent Prisma native binary loading ───────────────
jest.mock("@prisma/client", () => {
  const JsonNull = "JsonNull";
  class PrismaClient {}
  return { PrismaClient, Prisma: { JsonNull, InputJsonValue: {} } };
});

// ── Import SUT (after all mocks are registered) ───────────────────────────────
import { runPipeline } from "./pipelineOrchestrator";
import { prisma } from "../database/prisma";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SESSION_ID = "session-test-001";
const SOCKET_ID = "socket-test-001";

const MOCK_ANALYZE_RESPONSE = {
  success: true,
  screenshot_path: "/tmp/screenshot.png",
  ocr_result: { text: "sample text", words: [] },
  rule_flags: [],
  detected_patterns: [
    {
      category: "Fake Urgency",
      element_identifier: "#timer",
      confidence_level: "High" as const,
      explanation: "Countdown timer creates false urgency.",
      bounding_box: { x: 10, y: 10, width: 100, height: 30 },
    },
  ],
  scores: {
    manipulation_score: { score: 75, contributions: [] },
    trust_score: { score: 25, contributions: [] },
    friction_score: { score: 50, contributions: [] },
    ux_fairness_index: "High Risk" as const,
  },
  ai_analysis: { summary: "Manipulative design detected." },
};

const MOCK_SIMULATE_RESPONSE = [
  {
    persona: "Elderly User",
    confusion_points: [],
    pressure_points: [],
    hidden_risk_areas: [],
    accidental_consent_zones: [],
    behavioral_summary: "High risk for elderly users.",
  },
];

const MOCK_SCORE_RESPONSE = {
  manipulation_score: { score: 75, contributions: [{ pattern_name: "Fake Urgency", points: 25 }] },
  trust_score: { score: 25, contributions: [] },
  friction_score: { score: 50, contributions: [] },
  ux_fairness_index: "High Risk" as const,
};

// ── Helper: set up a full successful pipeline mock ────────────────────────────
function setupSuccessfulPipeline(): void {
  mockAxios.post
    .mockResolvedValueOnce({ data: MOCK_ANALYZE_RESPONSE }) // /analyze/url (stages 2+3)
    .mockResolvedValueOnce({ data: MOCK_SIMULATE_RESPONSE }) // /simulate (stage 4)
    .mockResolvedValueOnce({ data: MOCK_SCORE_RESPONSE });   // /score (stage 5)
}

// ── URL input fixture ─────────────────────────────────────────────────────────
const URL_INPUT = {
  type: "url" as const,
  scrapedData: {
    url: "https://example.com",
    screenshotPath: "/tmp/screenshot.png",
    domHtml: "<html><body><button>Buy Now</button></body></html>",
    domElementCount: 42,
    pageTitle: "Test Page",
    metaDescription: "A test page",
    buttons: ["Buy Now"],
  },
};

// ── beforeEach: reset all mocks ───────────────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();

  // Re-wire toMock to always return fresh emit mock reference
  toMock.mockReturnValue({ emit: emitMock });

  // Re-apply transaction mock after clearAllMocks
  (mockTransaction as jest.Mock).mockImplementation(async (cb: (tx: typeof mockTx) => Promise<void>) => {
    return cb(mockTx);
  });
  mockTx.analysisSession.update.mockResolvedValue({});
  mockTx.detectedPatternRecord.createMany.mockResolvedValue({});
  mockTx.simulationResultRecord.createMany.mockResolvedValue({});
  mockTx.scoringResult.upsert.mockResolvedValue({});

  (prisma.analysisSession.update as jest.Mock).mockResolvedValue({});
});

// =============================================================================
// Property 16: Pipeline Stage Event Completeness
// Validates: Requirement 11.2
// =============================================================================

describe("Property 16 — Pipeline stage event completeness", () => {
  /**
   * For any Analysis_Session that runs to completion, the Platform SHALL emit
   * exactly 5 `stage_progress` events, one per stage, in correct order:
   *   capture → rule_engine → ai_analysis → simulation → scoring
   *
   * Validates: Requirements 11.2
   */
  it("emits exactly 5 stage_progress events on a successful run", async () => {
    setupSuccessfulPipeline();

    await runPipeline(SESSION_ID, SOCKET_ID, URL_INPUT);

    // Collect all stage_progress emit calls (first arg to emit is the event name)
    const stageProgressCalls = emitMock.mock.calls
      .filter((call) => call[0] === "stage_progress")
      .map((call) => call[1]);

    expect(stageProgressCalls).toHaveLength(5);
  });

  it("emits stage_progress events in correct order: capture, rule_engine, ai_analysis, simulation, scoring", async () => {
    setupSuccessfulPipeline();

    await runPipeline(SESSION_ID, SOCKET_ID, URL_INPUT);

    const stageProgressCalls = emitMock.mock.calls
      .filter((call) => call[0] === "stage_progress")
      .map((call) => call[1]);

    const expectedOrder = ["capture", "rule_engine", "ai_analysis", "simulation", "scoring"];

    stageProgressCalls.forEach((payload, index) => {
      expect(payload.stage).toBe(expectedOrder[index]);
    });
  });

  it("each stage_progress event has correct stepNumber and totalSteps=5", async () => {
    setupSuccessfulPipeline();

    await runPipeline(SESSION_ID, SOCKET_ID, URL_INPUT);

    const stageProgressCalls = emitMock.mock.calls
      .filter((call) => call[0] === "stage_progress")
      .map((call) => call[1]);

    stageProgressCalls.forEach((payload, index) => {
      expect(payload.stepNumber).toBe(index + 1);
      expect(payload.totalSteps).toBe(5);
    });
  });

  it("emits session_complete after all 5 stages complete successfully", async () => {
    setupSuccessfulPipeline();

    await runPipeline(SESSION_ID, SOCKET_ID, URL_INPUT);

    const sessionCompleteCalls = emitMock.mock.calls.filter(
      (call) => call[0] === "session_complete"
    );

    expect(sessionCompleteCalls).toHaveLength(1);
    expect(sessionCompleteCalls[0][1]).toMatchObject({ sessionId: SESSION_ID });
  });

  it("does NOT emit session_failed on a successful run", async () => {
    setupSuccessfulPipeline();

    await runPipeline(SESSION_ID, SOCKET_ID, URL_INPUT);

    const sessionFailedCalls = emitMock.mock.calls.filter(
      (call) => call[0] === "session_failed"
    );

    expect(sessionFailedCalls).toHaveLength(0);
  });
});

// =============================================================================
// Unit tests: session_failed with correct failedStage on each stage failure
// Validates: Requirement 11.6
// =============================================================================

describe("session_failed — correct failedStage per stage", () => {
  it("emits session_failed with failedStage='ai_analysis' when analyze call fails", async () => {
    mockAxios.post.mockRejectedValue(new Error("AI Service unavailable"));

    await runPipeline(SESSION_ID, SOCKET_ID, URL_INPUT);

    const failedCall = emitMock.mock.calls.find((call) => call[0] === "session_failed");

    expect(failedCall).toBeDefined();
    expect(failedCall![1]).toMatchObject({
      sessionId: SESSION_ID,
      failedStage: "ai_analysis",
    });
  });

  it("emits session_failed with failedStage='simulation' when simulate call fails", async () => {
    mockAxios.post
      .mockResolvedValueOnce({ data: MOCK_ANALYZE_RESPONSE }) // /analyze/url succeeds
      .mockRejectedValue(new Error("Simulation service down"));  // /simulate fails (retry also fails)

    await runPipeline(SESSION_ID, SOCKET_ID, URL_INPUT);

    const failedCall = emitMock.mock.calls.find((call) => call[0] === "session_failed");

    expect(failedCall).toBeDefined();
    expect(failedCall![1]).toMatchObject({
      sessionId: SESSION_ID,
      failedStage: "simulation",
    });
  });

  it("emits session_failed with failedStage='scoring' when score call fails", async () => {
    mockAxios.post
      .mockResolvedValueOnce({ data: MOCK_ANALYZE_RESPONSE }) // /analyze/url succeeds
      .mockResolvedValueOnce({ data: MOCK_SIMULATE_RESPONSE }) // /simulate succeeds
      .mockRejectedValue(new Error("Scoring service down"));    // /score fails (retry also fails)

    await runPipeline(SESSION_ID, SOCKET_ID, URL_INPUT);

    const failedCall = emitMock.mock.calls.find((call) => call[0] === "session_failed");

    expect(failedCall).toBeDefined();
    expect(failedCall![1]).toMatchObject({
      sessionId: SESSION_ID,
      failedStage: "scoring",
    });
  });

  it("persists status=failed and failedStage to the database on failure", async () => {
    mockAxios.post.mockRejectedValue(new Error("AI Service unavailable"));

    await runPipeline(SESSION_ID, SOCKET_ID, URL_INPUT);

    expect(prisma.analysisSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SESSION_ID },
        data: expect.objectContaining({
          status: "failed",
          failedStage: "ai_analysis",
        }),
      })
    );
  });

  it("session_failed payload includes a non-empty message string", async () => {
    mockAxios.post.mockRejectedValue(new Error("Connection refused"));

    await runPipeline(SESSION_ID, SOCKET_ID, URL_INPUT);

    const failedCall = emitMock.mock.calls.find((call) => call[0] === "session_failed");

    expect(failedCall).toBeDefined();
    expect(typeof failedCall![1].message).toBe("string");
    expect(failedCall![1].message.length).toBeGreaterThan(0);
  });

  it("emits stage_progress events up to the point of failure (ai_analysis fails → only 3 progress events emitted)", async () => {
    // analyze call fails → stages 1, 2, 3 were already emitted before the async call throws
    mockAxios.post.mockRejectedValue(new Error("AI Service unavailable"));

    await runPipeline(SESSION_ID, SOCKET_ID, URL_INPUT);

    const stageProgressCalls = emitMock.mock.calls
      .filter((call) => call[0] === "stage_progress")
      .map((call) => call[1]);

    // capture (1), rule_engine (2), ai_analysis (3) are emitted BEFORE the await that throws
    expect(stageProgressCalls.length).toBe(3);
    expect(stageProgressCalls[0].stage).toBe("capture");
    expect(stageProgressCalls[1].stage).toBe("rule_engine");
    expect(stageProgressCalls[2].stage).toBe("ai_analysis");
  });
});

// =============================================================================
// Unit tests: AI Service retry logic
// Validates: Requirement 11.6 (retry once before failing)
// =============================================================================

describe("AI Service retry logic", () => {
  /**
   * When a stage fails once then succeeds on the retry, the pipeline should
   * complete successfully (session_complete emitted, no session_failed).
   */
  it("completes successfully when analyze fails once then succeeds on retry", async () => {
    mockAxios.post
      .mockRejectedValueOnce(new Error("Transient error on analyze"))  // first /analyze attempt
      .mockResolvedValueOnce({ data: MOCK_ANALYZE_RESPONSE })           // retry /analyze succeeds
      .mockResolvedValueOnce({ data: MOCK_SIMULATE_RESPONSE })          // /simulate
      .mockResolvedValueOnce({ data: MOCK_SCORE_RESPONSE });            // /score

    await runPipeline(SESSION_ID, SOCKET_ID, URL_INPUT);

    // session_complete should be emitted
    const sessionCompleteCalls = emitMock.mock.calls.filter(
      (call) => call[0] === "session_complete"
    );
    expect(sessionCompleteCalls).toHaveLength(1);

    // session_failed should NOT be emitted
    const sessionFailedCalls = emitMock.mock.calls.filter(
      (call) => call[0] === "session_failed"
    );
    expect(sessionFailedCalls).toHaveLength(0);
  });

  it("completes successfully when simulate fails once then succeeds on retry", async () => {
    mockAxios.post
      .mockResolvedValueOnce({ data: MOCK_ANALYZE_RESPONSE })           // /analyze succeeds
      .mockRejectedValueOnce(new Error("Transient error on simulate"))  // first /simulate attempt
      .mockResolvedValueOnce({ data: MOCK_SIMULATE_RESPONSE })          // retry /simulate succeeds
      .mockResolvedValueOnce({ data: MOCK_SCORE_RESPONSE });            // /score

    await runPipeline(SESSION_ID, SOCKET_ID, URL_INPUT);

    const sessionCompleteCalls = emitMock.mock.calls.filter(
      (call) => call[0] === "session_complete"
    );
    expect(sessionCompleteCalls).toHaveLength(1);

    const sessionFailedCalls = emitMock.mock.calls.filter(
      (call) => call[0] === "session_failed"
    );
    expect(sessionFailedCalls).toHaveLength(0);
  });

  it("completes successfully when score fails once then succeeds on retry", async () => {
    mockAxios.post
      .mockResolvedValueOnce({ data: MOCK_ANALYZE_RESPONSE })         // /analyze
      .mockResolvedValueOnce({ data: MOCK_SIMULATE_RESPONSE })        // /simulate
      .mockRejectedValueOnce(new Error("Transient error on score"))   // first /score attempt
      .mockResolvedValueOnce({ data: MOCK_SCORE_RESPONSE });          // retry /score succeeds

    await runPipeline(SESSION_ID, SOCKET_ID, URL_INPUT);

    const sessionCompleteCalls = emitMock.mock.calls.filter(
      (call) => call[0] === "session_complete"
    );
    expect(sessionCompleteCalls).toHaveLength(1);

    const sessionFailedCalls = emitMock.mock.calls.filter(
      (call) => call[0] === "session_failed"
    );
    expect(sessionFailedCalls).toHaveLength(0);
  });

  it("fails after second analyze attempt if both fail (no more retries)", async () => {
    mockAxios.post
      .mockRejectedValueOnce(new Error("First analyze failure"))
      .mockRejectedValueOnce(new Error("Second analyze failure")); // retry also fails

    await runPipeline(SESSION_ID, SOCKET_ID, URL_INPUT);

    const sessionFailedCalls = emitMock.mock.calls.filter(
      (call) => call[0] === "session_failed"
    );
    expect(sessionFailedCalls).toHaveLength(1);
    expect(sessionFailedCalls[0][1].failedStage).toBe("ai_analysis");
  });

  it("retries exactly once — axios.post called twice on analyze failure", async () => {
    mockAxios.post
      .mockRejectedValueOnce(new Error("First failure"))
      .mockRejectedValueOnce(new Error("Second failure"));

    await runPipeline(SESSION_ID, SOCKET_ID, URL_INPUT);

    // axios.post should have been called exactly twice for the analyze stage
    // (initial attempt + 1 retry)
    expect(mockAxios.post).toHaveBeenCalledTimes(2);
  });
});

// =============================================================================
// Unit tests: session_started and general happy-path checks
// =============================================================================

describe("session_started and happy-path behaviour", () => {
  it("emits session_started at the beginning of the pipeline", async () => {
    setupSuccessfulPipeline();

    await runPipeline(SESSION_ID, SOCKET_ID, URL_INPUT);

    const sessionStartedCalls = emitMock.mock.calls.filter(
      (call) => call[0] === "session_started"
    );
    expect(sessionStartedCalls).toHaveLength(1);
    expect(sessionStartedCalls[0][1]).toMatchObject({ sessionId: SESSION_ID });
  });

  it("uses io.to(socketId) for all emits", async () => {
    setupSuccessfulPipeline();

    await runPipeline(SESSION_ID, SOCKET_ID, URL_INPUT);

    // Every call to toMock should have been with the correct socketId
    const calls = toMock.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    calls.forEach((call) => {
      expect(call[0]).toBe(SOCKET_ID);
    });
  });

  it("persists session with status=completed on success", async () => {
    setupSuccessfulPipeline();

    await runPipeline(SESSION_ID, SOCKET_ID, URL_INPUT);

    expect(mockTx.analysisSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SESSION_ID },
        data: expect.objectContaining({
          status: "completed",
          failedStage: null,
        }),
      })
    );
  });

  it("works with upload type input", async () => {
    mockAxios.post
      .mockResolvedValueOnce({ data: MOCK_ANALYZE_RESPONSE })
      .mockResolvedValueOnce({ data: MOCK_SIMULATE_RESPONSE })
      .mockResolvedValueOnce({ data: MOCK_SCORE_RESPONSE });

    const uploadInput = {
      type: "upload" as const,
      filePath: "/tmp/uploaded-screenshot.png",
    };

    await runPipeline(SESSION_ID, SOCKET_ID, uploadInput);

    const stageProgressCalls = emitMock.mock.calls
      .filter((call) => call[0] === "stage_progress")
      .map((call) => call[1]);

    expect(stageProgressCalls).toHaveLength(5);

    const sessionCompleteCalls = emitMock.mock.calls.filter(
      (call) => call[0] === "session_complete"
    );
    expect(sessionCompleteCalls).toHaveLength(1);
  });
});
