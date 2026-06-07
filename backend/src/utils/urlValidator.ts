/**
 * urlValidator.ts — URL validation utility.
 *
 * Validates: Requirement 2.3
 */

export interface UrlValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate that a string is a well-formed HTTP or HTTPS URL.
 *
 * Uses the WHATWG URL constructor for parsing and verifies:
 * - The URL parses without throwing (catches malformed URLs)
 * - The protocol is http: or https:
 *
 * @param input - The URL string to validate.
 * @returns { valid: true } for valid HTTP/HTTPS URLs,
 *          { valid: false, error: "INVALID_URL" } otherwise.
 */
export function validateUrl(input: string): UrlValidationResult {
  if (!input || typeof input !== "string") {
    return { valid: false, error: "INVALID_URL" };
  }

  let parsed: URL;

  try {
    parsed = new URL(input);
  } catch {
    return { valid: false, error: "INVALID_URL" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { valid: false, error: "INVALID_URL" };
  }

  return { valid: true };
}
