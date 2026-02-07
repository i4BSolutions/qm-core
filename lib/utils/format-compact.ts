/**
 * Compact number formatting utilities for responsive currency display.
 * Uses K/M/B notation for large numbers based on display context.
 */

/**
 * Display context determines when to abbreviate numbers.
 * - card: Compact displays, abbreviate at 1M+
 * - table: More space, abbreviate at 1B+
 * - detail: Full display, never abbreviate
 */
export type DisplayContext = "card" | "table" | "detail";

/**
 * Thresholds for when to switch to abbreviated display.
 * Numbers at or above these values will be abbreviated.
 */
export const ABBREVIATION_THRESHOLDS: Record<DisplayContext, number> = {
  card: 1_000_000, // Abbreviate at 1M+ on cards
  table: 1_000_000_000, // Abbreviate at 1B+ in tables
  detail: Infinity, // Never abbreviate on detail pages
};

/**
 * Format result with both display and full values for tooltip support.
 */
export interface CompactFormatResult {
  /** The formatted value to display (may be abbreviated) */
  display: string;
  /** Whether the value was abbreviated */
  isAbbreviated: boolean;
  /** The full formatted value (for tooltips) */
  fullValue: string;
}

/**
 * Format a number using compact notation (K/M/B).
 *
 * @param value - The number to format
 * @returns Abbreviated string like "1.2M" or "456K"
 *
 * @example
 * formatCompactNumber(1234567)   // "1.2M"
 * formatCompactNumber(1234)      // "1.2K"
 * formatCompactNumber(-5000000)  // "-5M"
 */
export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * Format a currency value with context-aware abbreviation.
 *
 * @param value - The amount to format
 * @param currency - Currency code (e.g., "MMK", "USD")
 * @param threshold - Threshold for abbreviation (use ABBREVIATION_THRESHOLDS)
 * @param decimals - Decimal places for non-abbreviated values
 * @returns Object with display value, abbreviation flag, and full value
 *
 * @example
 * // Abbreviated (above threshold)
 * formatCompactCurrency(1234567, "MMK", 1_000_000)
 * // { display: "1.2M MMK", isAbbreviated: true, fullValue: "1,234,567.00 MMK" }
 *
 * // Not abbreviated (below threshold)
 * formatCompactCurrency(999999, "MMK", 1_000_000)
 * // { display: "999,999.00 MMK", isAbbreviated: false, fullValue: "999,999.00 MMK" }
 *
 * // Negative value
 * formatCompactCurrency(-5000000, "USD", 1_000_000)
 * // { display: "-5M USD", isAbbreviated: true, fullValue: "-5,000,000.00 USD" }
 */
export function formatCompactCurrency(
  value: number,
  currency: string,
  threshold: number = ABBREVIATION_THRESHOLDS.card,
  decimals: number = 2
): CompactFormatResult {
  // Round to avoid floating point precision issues
  const multiplier = Math.pow(10, decimals);
  const rounded = Math.round(value * multiplier) / multiplier;

  // Format the full value (always needed for tooltip)
  const fullFormatted = new Intl.NumberFormat("en-US", {
    style: "decimal",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(rounded);
  const fullValue = `${fullFormatted} ${currency}`;

  // Check if we should abbreviate (use absolute value for comparison)
  const shouldAbbreviate = Math.abs(rounded) >= threshold;

  if (shouldAbbreviate) {
    // Use compact notation
    const compactFormatted = formatCompactNumber(rounded);
    return {
      display: `${compactFormatted} ${currency}`,
      isAbbreviated: true,
      fullValue,
    };
  }

  // Return full value
  return {
    display: fullValue,
    isAbbreviated: false,
    fullValue,
  };
}
