/**
 * ID Generator Utilities
 *
 * Generates human-readable IDs in the format: PREFIX-YYYY-NNNNN
 * Example: QMRL-2025-00001
 */

export type EntityPrefix = "QMRL" | "QMHQ" | "PO" | "INV";

/**
 * Generate a formatted ID for an entity
 *
 * @param prefix - The entity prefix (QMRL, QMHQ, PO, INV)
 * @param sequence - The sequence number
 * @param year - Optional year (defaults to current year)
 * @returns Formatted ID string
 *
 * @example
 * generateId("QMRL", 1) // "QMRL-2025-00001"
 * generateId("PO", 123) // "PO-2025-00123"
 */
export function generateId(
  prefix: EntityPrefix,
  sequence: number,
  year?: number
): string {
  const currentYear = year ?? new Date().getFullYear();
  const paddedSequence = sequence.toString().padStart(5, "0");
  return `${prefix}-${currentYear}-${paddedSequence}`;
}

/**
 * Parse an ID string into its components
 *
 * @param id - The formatted ID string
 * @returns Object with prefix, year, and sequence, or null if invalid
 *
 * @example
 * parseId("QMRL-2025-00001") // { prefix: "QMRL", year: 2025, sequence: 1 }
 */
export function parseId(id: string): {
  prefix: string;
  year: number;
  sequence: number;
} | null {
  const match = id.match(/^([A-Z]+)-(\d{4})-(\d{5})$/);
  if (!match) return null;

  return {
    prefix: match[1],
    year: parseInt(match[2], 10),
    sequence: parseInt(match[3], 10),
  };
}

/**
 * Validate an ID string format
 *
 * @param id - The ID string to validate
 * @param expectedPrefix - Optional expected prefix to check against
 * @returns Boolean indicating if the ID is valid
 */
export function isValidId(id: string, expectedPrefix?: EntityPrefix): boolean {
  const parsed = parseId(id);
  if (!parsed) return false;
  if (expectedPrefix && parsed.prefix !== expectedPrefix) return false;
  return true;
}

/**
 * Get the next sequence number for a given prefix and year
 * This is a placeholder - actual implementation should query the database
 *
 * @param prefix - The entity prefix
 * @param currentMax - The current maximum sequence number
 * @returns The next sequence number
 */
export function getNextSequence(
  prefix: EntityPrefix,
  currentMax: number = 0
): number {
  return currentMax + 1;
}

/**
 * Format a sequence number with leading zeros
 *
 * @param sequence - The sequence number
 * @param padding - Number of digits (default 5)
 * @returns Padded sequence string
 */
export function formatSequence(sequence: number, padding: number = 5): string {
  return sequence.toString().padStart(padding, "0");
}
