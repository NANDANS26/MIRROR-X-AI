/**
 * scraperService.ts — HTTP-based URL scraper using axios + cheerio.
 *
 * Replaces Puppeteer which requires system Chromium binaries not available
 * on Render free tier. This implementation:
 *  - Fetches the page HTML with axios (no browser needed)
 *  - Parses DOM with cheerio (pure Node.js)
 *  - Extracts title, meta description, button text, visible text, raw HTML
 *  - No screenshot (not possible without a browser — screenshotPath is empty string)
 *
 * Limitations vs Puppeteer:
 *  - Cannot execute JavaScript (SPA content may not be fully rendered)
 *  - No screenshots
 *  - Sites that require JS rendering will return partial content
 *
 * This is a production-viable replacement for Render free tier.
 */

import axios from "axios";
import * as cheerio from "cheerio";

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
    super(`Navigation timeout fetching URL: ${url}`);
    this.name = "ScraperTimeoutError";
  }
}

export class PartialRenderError extends Error {
  constructor(count: number) {
    super(`Page rendered incompletely: only ${count} elements found (minimum 10 required)`);
    this.name = "PartialRenderError";
  }
}

export async function captureUrl(url: string): Promise<ScrapeResult> {
  let html: string;

  try {
    const response = await axios.get<string>(url, {
      timeout: 30_000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
      maxRedirects: 5,
      responseType: "text",
    });
    html = response.data as string;
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const code = err.code;
      if (code === "ECONNABORTED" || code === "ETIMEDOUT") {
        throw new ScraperTimeoutError(url);
      }
    }
    throw err;
  }

  const $ = cheerio.load(html);

  // Remove script and style tags to get clean text
  $("script, style, noscript").remove();

  const pageTitle = $("title").first().text().trim() || "";
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    "";

  // Collect all button and link text that looks like CTAs
  const buttons: string[] = [];
  $("button, [type='button'], [type='submit'], a[class*='btn'], a[class*='button']").each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length < 100) buttons.push(text);
  });

  // Count meaningful DOM elements
  const domElementCount = $("*").length;

  if (domElementCount < 10) {
    throw new PartialRenderError(domElementCount);
  }

  // Full HTML (cheerio re-serialised)
  const domHtml = $.html();

  return {
    url,
    screenshotPath: "",  // No screenshot without a browser
    domHtml,
    domElementCount,
    pageTitle,
    metaDescription,
    buttons,
  };
}
