import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";

// ─── Result & Error Types ─────────────────────────────────────────────────────

export interface ScrapeResult {
  url: string;
  screenshotPath: string;
  domHtml: string;
  domElementCount: number;
  pageTitle: string;
  metaDescription: string;
  buttons: string[];
}

export class ScraperTimeoutError extends Error {
  constructor(url: string) {
    super(`Navigation timeout after 30 seconds for URL: ${url}`);
    this.name = "ScraperTimeoutError";
  }
}

export class PartialRenderError extends Error {
  constructor(count: number) {
    super(
      `Page rendered incompletely: only ${count} DOM elements found (minimum 10 required)`
    );
    this.name = "PartialRenderError";
  }
}

// ─── Scraper Service ─────────────────────────────────────────────────────────

/**
 * Captures a URL using headless Puppeteer:
 *  - 1280×800 viewport
 *  - Full-page PNG screenshot saved to uploads/
 *  - DOM HTML extracted after up to 15 s of JS execution
 *  - Throws ScraperTimeoutError on 30 s navigation timeout
 *  - Throws PartialRenderError when DOM element count < 10
 *
 * Requirements: 2.1, 2.2, 2.4, 2.5, 2.6
 */
export async function captureUrl(url: string): Promise<ScrapeResult> {
  // Ensure the uploads directory exists (relative to the project root / CWD)
  const uploadsDir = path.resolve(process.cwd(), "uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });

  // Dynamic import required — Puppeteer v21+ is ESM-only but backend is CJS
  const puppeteer = (await import("puppeteer")).default;

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    // Requirement 2.1 — 1280×800 viewport
    await page.setViewport({ width: 1280, height: 800 });

    // Requirement 2.5 — 30-second navigation timeout; throw typed error on breach
    try {
      await page.goto(url, {
        timeout: 30000,
        waitUntil: "domcontentloaded",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        message.includes("TimeoutError") ||
        message.includes("Navigation timeout") ||
        message.includes("Timeout")
      ) {
        throw new ScraperTimeoutError(url);
      }
      throw err;
    }

    // Requirement 2.2 — allow up to 15 s for JS execution
    try {
      await page.waitForSelector("body", { timeout: 15000 });
    } catch {
      // Body selector may not appear on all pages; continue with what rendered
    }

    // Requirement 2.6 — count DOM elements after JS execution
    const domElementCount: number = await page.evaluate(
      () => document.querySelectorAll("*").length
    );

    if (domElementCount < 10) {
      throw new PartialRenderError(domElementCount);
    }

    // Requirement 2.4 — page title, meta description, all button texts
    const pageTitle: string = await page.evaluate(() => document.title);

    const metaDescription: string = await page.evaluate(() => {
      const meta = document.querySelector<HTMLMetaElement>(
        'meta[name="description"]'
      );
      return meta ? meta.content : "";
    });

    const buttons: string[] = await page.evaluate(() =>
      Array.from(document.querySelectorAll("button")).map(
        (btn) => btn.innerText.trim()
      )
    );

    // Requirement 2.2 — full raw HTML
    const domHtml: string = await page.evaluate(
      () => document.documentElement.outerHTML
    );

    // Requirement 2.1 — full-page PNG screenshot saved to uploads/
    const screenshotFilename = `${randomUUID()}.png`;
    const screenshotPath = path.join(uploadsDir, screenshotFilename);

    await page.screenshot({ path: screenshotPath as `${string}.png`, fullPage: true });

    return {
      url,
      screenshotPath,
      domHtml,
      domElementCount,
      pageTitle,
      metaDescription,
      buttons,
    };
  } finally {
    await browser.close();
  }
}
