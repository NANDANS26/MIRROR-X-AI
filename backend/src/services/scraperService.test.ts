/**
 * Tests for scraperService (captureUrl).
 *
 * Covers:
 *  - ScraperTimeoutError is thrown when navigation times out (Requirement 2.5)
 *  - PartialRenderError is thrown when DOM element count < 10 (Requirement 2.6)
 *  - Metadata extraction: pageTitle, metaDescription, buttons (Requirement 2.4)
 *  - DOM extraction after JS execution (Requirement 2.3)
 *
 * Validates: Requirements 2.3, 2.4, 2.5, 2.6
 */

// Set env vars before any imports that may validate them
process.env.JWT_SECRET = "test-secret-for-scraper-tests";
process.env.DATABASE_URL = "postgresql://test:test@localhost/test";
process.env.AI_SERVICE_URL = "http://localhost:8000";

// Mock the env module
jest.mock("../configs/env", () => ({
  ENV: {
    JWT_SECRET: "test-secret-for-scraper-tests",
    DATABASE_URL: "postgresql://test:test@localhost/test",
    AI_SERVICE_URL: "http://localhost:8000",
    PORT: "3001",
  },
}));

// puppeteer is auto-replaced with src/__mocks__/puppeteer.ts via moduleNameMapper
// (puppeteer v25 is pure ESM and cannot be parsed by Jest in CJS mode)
import puppeteer from "puppeteer";
import {
  captureUrl,
  ScraperTimeoutError,
  PartialRenderError,
} from "./scraperService";

const mockPuppeteer = puppeteer as jest.Mocked<typeof puppeteer>;

// ─── Mock helpers ──────────────────────────────────────────────────────────────

/**
 * Build a minimal fake Puppeteer Page.
 * `overrides` replace the default mock implementations.
 */
function createMockPage(overrides: Record<string, jest.Mock> = {}) {
  return {
    setViewport: jest.fn().mockResolvedValue(undefined),
    goto: jest.fn().mockResolvedValue(undefined),
    waitForSelector: jest.fn().mockResolvedValue(undefined),
    // Default evaluate returns 100 DOM elements (well above the 10-element threshold)
    evaluate: jest.fn().mockResolvedValue(100),
    screenshot: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/**
 * Build a minimal fake Puppeteer Browser that returns the given page.
 */
function createMockBrowser(page: ReturnType<typeof createMockPage>) {
  return {
    newPage: jest.fn().mockResolvedValue(page),
    close: jest.fn().mockResolvedValue(undefined),
  };
}

// ─── Requirement 2.5 — Navigation timeout ────────────────────────────────────

describe("ScraperTimeoutError — navigation timeout (Requirement 2.5)", () => {
  it("throws ScraperTimeoutError when page.goto times out", async () => {
    const page = createMockPage({
      goto: jest
        .fn()
        .mockRejectedValue(
          new Error("Navigation timeout of 30000ms exceeded")
        ),
    });
    const browser = createMockBrowser(page);
    mockPuppeteer.launch.mockResolvedValue(browser as any);

    await expect(captureUrl("https://example.com")).rejects.toThrow(
      ScraperTimeoutError
    );
  });

  it("ScraperTimeoutError has the correct name", async () => {
    const page = createMockPage({
      goto: jest
        .fn()
        .mockRejectedValue(new Error("Navigation timeout of 30000ms exceeded")),
    });
    const browser = createMockBrowser(page);
    mockPuppeteer.launch.mockResolvedValue(browser as any);

    try {
      await captureUrl("https://timeout.example");
    } catch (err) {
      expect(err).toBeInstanceOf(ScraperTimeoutError);
      expect((err as ScraperTimeoutError).name).toBe("ScraperTimeoutError");
    }
  });

  it("ScraperTimeoutError message includes the target URL", async () => {
    const targetUrl = "https://slow-site.example.com";
    const page = createMockPage({
      goto: jest
        .fn()
        .mockRejectedValue(new Error("Navigation timeout of 30000ms exceeded")),
    });
    const browser = createMockBrowser(page);
    mockPuppeteer.launch.mockResolvedValue(browser as any);

    try {
      await captureUrl(targetUrl);
      fail("Expected ScraperTimeoutError to be thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ScraperTimeoutError);
      expect((err as ScraperTimeoutError).message).toContain(targetUrl);
    }
  });

  it("still closes the browser even when a timeout error is thrown", async () => {
    const page = createMockPage({
      goto: jest
        .fn()
        .mockRejectedValue(new Error("Navigation timeout of 30000ms exceeded")),
    });
    const browser = createMockBrowser(page);
    mockPuppeteer.launch.mockResolvedValue(browser as any);

    await expect(captureUrl("https://example.com")).rejects.toThrow(
      ScraperTimeoutError
    );
    expect(browser.close).toHaveBeenCalledTimes(1);
  });

  it("re-throws non-timeout errors as-is (does not wrap them)", async () => {
    const networkError = new Error("net::ERR_NAME_NOT_RESOLVED");
    const page = createMockPage({
      goto: jest.fn().mockRejectedValue(networkError),
    });
    const browser = createMockBrowser(page);
    mockPuppeteer.launch.mockResolvedValue(browser as any);

    await expect(captureUrl("https://example.com")).rejects.toThrow(
      "net::ERR_NAME_NOT_RESOLVED"
    );
    // Ensure it is NOT wrapped in a ScraperTimeoutError
    await expect(
      captureUrl("https://example.com")
    ).rejects.not.toBeInstanceOf(ScraperTimeoutError);
  });
});

// ─── Requirement 2.6 — Partial render detection ───────────────────────────────

describe("PartialRenderError — DOM element count < 10 (Requirement 2.6)", () => {
  /**
   * Helper: build a mock page whose evaluate() returns `domCount` for the
   * DOM-counting call.  The scraper calls evaluate() multiple times; the first
   * call (querySelectorAll count) is the one we care about.
   */
  function pageWithDomCount(domCount: number) {
    return createMockPage({
      evaluate: jest.fn().mockResolvedValueOnce(domCount),
    });
  }

  it("throws PartialRenderError when DOM count is 0", async () => {
    const browser = createMockBrowser(pageWithDomCount(0));
    mockPuppeteer.launch.mockResolvedValue(browser as any);

    await expect(captureUrl("https://empty.example")).rejects.toThrow(
      PartialRenderError
    );
  });

  it("throws PartialRenderError when DOM count is 5 (< 10)", async () => {
    const browser = createMockBrowser(pageWithDomCount(5));
    mockPuppeteer.launch.mockResolvedValue(browser as any);

    await expect(captureUrl("https://sparse.example")).rejects.toThrow(
      PartialRenderError
    );
  });

  it("throws PartialRenderError when DOM count is exactly 9 (boundary — still < 10)", async () => {
    const browser = createMockBrowser(pageWithDomCount(9));
    mockPuppeteer.launch.mockResolvedValue(browser as any);

    await expect(captureUrl("https://nine-elements.example")).rejects.toThrow(
      PartialRenderError
    );
  });

  it("does NOT throw PartialRenderError when DOM count is exactly 10 (boundary — valid)", async () => {
    // Provide enough evaluate responses for the full scrape pipeline:
    // 1st call → DOM count (10)
    // Subsequent calls → pageTitle, metaDescription, buttons, outerHTML
    const page = createMockPage({
      evaluate: jest
        .fn()
        .mockResolvedValueOnce(10)          // DOM element count
        .mockResolvedValueOnce("Page Title") // pageTitle
        .mockResolvedValueOnce("")           // metaDescription
        .mockResolvedValueOnce([])           // buttons
        .mockResolvedValueOnce("<html></html>"), // domHtml
    });
    const browser = createMockBrowser(page);
    mockPuppeteer.launch.mockResolvedValue(browser as any);

    await expect(captureUrl("https://ten-elements.example")).resolves.toBeDefined();
  });

  it("PartialRenderError name is 'PartialRenderError'", async () => {
    const browser = createMockBrowser(pageWithDomCount(3));
    mockPuppeteer.launch.mockResolvedValue(browser as any);

    try {
      await captureUrl("https://partial.example");
    } catch (err) {
      expect(err).toBeInstanceOf(PartialRenderError);
      expect((err as PartialRenderError).name).toBe("PartialRenderError");
    }
  });

  it("PartialRenderError message includes the actual element count", async () => {
    const browser = createMockBrowser(pageWithDomCount(5));
    mockPuppeteer.launch.mockResolvedValue(browser as any);

    try {
      await captureUrl("https://partial.example");
      fail("Expected PartialRenderError to be thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(PartialRenderError);
      expect((err as PartialRenderError).message).toContain("5");
    }
  });

  it("still closes the browser when PartialRenderError is thrown", async () => {
    const page = pageWithDomCount(1);
    const browser = createMockBrowser(page);
    mockPuppeteer.launch.mockResolvedValue(browser as any);

    await expect(captureUrl("https://partial.example")).rejects.toThrow(
      PartialRenderError
    );
    expect(browser.close).toHaveBeenCalledTimes(1);
  });
});

// ─── Requirement 2.4 — Metadata extraction ───────────────────────────────────

describe("Metadata extraction (Requirement 2.4)", () => {
  const FIXTURE_TITLE = "Checkout — Best Store";
  const FIXTURE_META = "Buy amazing products at unbeatable prices.";
  const FIXTURE_BUTTONS = ["Add to Cart", "Buy Now", "Cancel"];
  const FIXTURE_HTML = `<!DOCTYPE html><html><head><title>${FIXTURE_TITLE}</title></head><body></body></html>`;

  /**
   * Build a page that simulates the full sequence of page.evaluate() calls
   * made by captureUrl in the happy path:
   *   1. document.querySelectorAll("*").length  → DOM count (≥10)
   *   2. document.title                          → pageTitle
   *   3. meta[name="description"].content        → metaDescription
   *   4. Array.from(buttons).map(...)            → buttons[]
   *   5. document.documentElement.outerHTML      → domHtml
   */
  function createMetadataPage() {
    return createMockPage({
      evaluate: jest
        .fn()
        .mockResolvedValueOnce(42)               // DOM element count (≥10)
        .mockResolvedValueOnce(FIXTURE_TITLE)    // pageTitle
        .mockResolvedValueOnce(FIXTURE_META)     // metaDescription
        .mockResolvedValueOnce(FIXTURE_BUTTONS)  // buttons
        .mockResolvedValueOnce(FIXTURE_HTML),    // domHtml
    });
  }

  it("returns the correct page title", async () => {
    const browser = createMockBrowser(createMetadataPage());
    mockPuppeteer.launch.mockResolvedValue(browser as any);

    const result = await captureUrl("https://shop.example.com/checkout");
    expect(result.pageTitle).toBe(FIXTURE_TITLE);
  });

  it("returns the correct meta description", async () => {
    const browser = createMockBrowser(createMetadataPage());
    mockPuppeteer.launch.mockResolvedValue(browser as any);

    const result = await captureUrl("https://shop.example.com/checkout");
    expect(result.metaDescription).toBe(FIXTURE_META);
  });

  it("returns all button texts", async () => {
    const browser = createMockBrowser(createMetadataPage());
    mockPuppeteer.launch.mockResolvedValue(browser as any);

    const result = await captureUrl("https://shop.example.com/checkout");
    expect(result.buttons).toEqual(FIXTURE_BUTTONS);
  });

  it("returns the DOM HTML string", async () => {
    const browser = createMockBrowser(createMetadataPage());
    mockPuppeteer.launch.mockResolvedValue(browser as any);

    const result = await captureUrl("https://shop.example.com/checkout");
    expect(result.domHtml).toBe(FIXTURE_HTML);
  });

  it("returns the input URL unchanged in the result", async () => {
    const targetUrl = "https://shop.example.com/checkout";
    const browser = createMockBrowser(createMetadataPage());
    mockPuppeteer.launch.mockResolvedValue(browser as any);

    const result = await captureUrl(targetUrl);
    expect(result.url).toBe(targetUrl);
  });

  it("returns the correct DOM element count", async () => {
    const browser = createMockBrowser(createMetadataPage());
    mockPuppeteer.launch.mockResolvedValue(browser as any);

    const result = await captureUrl("https://shop.example.com/checkout");
    expect(result.domElementCount).toBe(42);
  });

  it("returns a screenshotPath string", async () => {
    const browser = createMockBrowser(createMetadataPage());
    mockPuppeteer.launch.mockResolvedValue(browser as any);

    const result = await captureUrl("https://shop.example.com/checkout");
    expect(typeof result.screenshotPath).toBe("string");
    expect(result.screenshotPath.length).toBeGreaterThan(0);
  });

  it("returns an empty string for metaDescription when no meta tag is present", async () => {
    const page = createMockPage({
      evaluate: jest
        .fn()
        .mockResolvedValueOnce(20)     // DOM count
        .mockResolvedValueOnce("Title With No Meta")
        .mockResolvedValueOnce("")     // empty meta description
        .mockResolvedValueOnce([])     // no buttons
        .mockResolvedValueOnce("<html></html>"),
    });
    const browser = createMockBrowser(page);
    mockPuppeteer.launch.mockResolvedValue(browser as any);

    const result = await captureUrl("https://nometa.example.com");
    expect(result.metaDescription).toBe("");
  });

  it("returns an empty array for buttons when no button elements are present", async () => {
    const page = createMockPage({
      evaluate: jest
        .fn()
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce("No Buttons Page")
        .mockResolvedValueOnce("")
        .mockResolvedValueOnce([])          // no buttons
        .mockResolvedValueOnce("<html></html>"),
    });
    const browser = createMockBrowser(page);
    mockPuppeteer.launch.mockResolvedValue(browser as any);

    const result = await captureUrl("https://nobuttons.example.com");
    expect(result.buttons).toEqual([]);
  });

  it("closes the browser after a successful scrape", async () => {
    const page = createMetadataPage();
    const browser = createMockBrowser(page);
    mockPuppeteer.launch.mockResolvedValue(browser as any);

    await captureUrl("https://shop.example.com/checkout");
    expect(browser.close).toHaveBeenCalledTimes(1);
  });

  it("sets the viewport to 1280×800 (Requirement 2.1)", async () => {
    const page = createMetadataPage();
    const browser = createMockBrowser(page);
    mockPuppeteer.launch.mockResolvedValue(browser as any);

    await captureUrl("https://shop.example.com/checkout");
    expect(page.setViewport).toHaveBeenCalledWith({ width: 1280, height: 800 });
  });
});
