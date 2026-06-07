/**
 * Manual mock for the `puppeteer` package.
 *
 * Puppeteer v25+ ships as pure ESM which Jest (CJS mode) cannot parse.
 * This file is mapped to `puppeteer` via `moduleNameMapper` in package.json
 * and provides jest.fn() stubs for every method used by scraperService.ts.
 *
 * Individual tests can override mock behaviour with:
 *   mockPuppeteer.launch.mockResolvedValue(fakeBrowser)
 */

const puppeteer = {
  launch: jest.fn(),
};

export default puppeteer;
