/**
 * Number Input Utilities
 *
 * Provides keydown handlers and validation helpers for controlled number inputs.
 * - Amount fields: 2 decimal places max
 * - Exchange rate fields: 4 decimal places max
 * - Quantity fields: integers only (no decimals)
 *
 * All handlers block: negative sign (-), e, E, + characters
 */

// Navigation and control keys that should always be allowed
const ALLOWED_CONTROL_KEYS = [
  "Backspace",
  "Delete",
  "Tab",
  "Escape",
  "Enter",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
];

// Characters that are always blocked in number inputs
const BLOCKED_CHARS = ["-", "e", "E", "+"];

/**
 * Check if a key event is a control/navigation key or modifier combo
 */
function isControlKey(e: React.KeyboardEvent<HTMLInputElement>): boolean {
  // Allow control keys
  if (ALLOWED_CONTROL_KEYS.includes(e.key)) {
    return true;
  }

  // Allow Ctrl/Cmd combinations (copy, paste, select all, etc.)
  if (e.ctrlKey || e.metaKey) {
    return true;
  }

  return false;
}

/**
 * Get the number of decimal places in a string value
 */
function getDecimalPlaces(value: string): number {
  const decimalIndex = value.indexOf(".");
  if (decimalIndex === -1) return 0;
  return value.length - decimalIndex - 1;
}

/**
 * Check if a value already contains a decimal point
 */
function hasDecimalPoint(value: string): boolean {
  return value.includes(".");
}

/**
 * Keydown handler for amount inputs (2 decimal places max)
 * Blocks: -, e, E, +
 * Limits: 2 decimal places
 */
export function handleAmountKeyDown(
  e: React.KeyboardEvent<HTMLInputElement>
): void {
  // Allow control keys
  if (isControlKey(e)) {
    return;
  }

  const key = e.key;
  const currentValue = e.currentTarget.value;

  // Block invalid characters
  if (BLOCKED_CHARS.includes(key)) {
    e.preventDefault();
    return;
  }

  // Handle decimal point
  if (key === ".") {
    // Block if already has decimal
    if (hasDecimalPoint(currentValue)) {
      e.preventDefault();
      return;
    }
    return;
  }

  // Only allow digits after this point
  if (!/^\d$/.test(key)) {
    e.preventDefault();
    return;
  }

  // If we have a decimal, check if adding another digit exceeds 2 decimal places
  if (hasDecimalPoint(currentValue)) {
    const decimalPlaces = getDecimalPlaces(currentValue);
    // Get selection - if user has selection, they might be replacing text
    const selectionStart = e.currentTarget.selectionStart ?? currentValue.length;
    const selectionEnd = e.currentTarget.selectionEnd ?? currentValue.length;
    const decimalIndex = currentValue.indexOf(".");

    // Only block if cursor is after decimal and already at max decimals
    // and no text is selected for replacement
    if (
      selectionStart > decimalIndex &&
      selectionStart === selectionEnd &&
      decimalPlaces >= 2
    ) {
      e.preventDefault();
      return;
    }
  }
}

/**
 * Keydown handler for exchange rate inputs (4 decimal places max)
 * Blocks: -, e, E, +
 * Limits: 4 decimal places
 */
export function handleExchangeRateKeyDown(
  e: React.KeyboardEvent<HTMLInputElement>
): void {
  // Allow control keys
  if (isControlKey(e)) {
    return;
  }

  const key = e.key;
  const currentValue = e.currentTarget.value;

  // Block invalid characters
  if (BLOCKED_CHARS.includes(key)) {
    e.preventDefault();
    return;
  }

  // Handle decimal point
  if (key === ".") {
    // Block if already has decimal
    if (hasDecimalPoint(currentValue)) {
      e.preventDefault();
      return;
    }
    return;
  }

  // Only allow digits after this point
  if (!/^\d$/.test(key)) {
    e.preventDefault();
    return;
  }

  // If we have a decimal, check if adding another digit exceeds 4 decimal places
  if (hasDecimalPoint(currentValue)) {
    const decimalPlaces = getDecimalPlaces(currentValue);
    const selectionStart = e.currentTarget.selectionStart ?? currentValue.length;
    const selectionEnd = e.currentTarget.selectionEnd ?? currentValue.length;
    const decimalIndex = currentValue.indexOf(".");

    // Only block if cursor is after decimal and already at max decimals
    if (
      selectionStart > decimalIndex &&
      selectionStart === selectionEnd &&
      decimalPlaces >= 4
    ) {
      e.preventDefault();
      return;
    }
  }
}

/**
 * Keydown handler for quantity inputs (integers only)
 * Blocks: -, e, E, +, . (decimal point)
 */
export function handleQuantityKeyDown(
  e: React.KeyboardEvent<HTMLInputElement>
): void {
  // Allow control keys
  if (isControlKey(e)) {
    return;
  }

  const key = e.key;

  // Block invalid characters (including decimal point for integers)
  if (BLOCKED_CHARS.includes(key) || key === ".") {
    e.preventDefault();
    return;
  }

  // Only allow digits
  if (!/^\d$/.test(key)) {
    e.preventDefault();
    return;
  }
}

/**
 * Validate an amount string
 * Returns true if valid positive number or empty string
 */
export function validateAmount(value: string): boolean {
  if (value === "" || value.trim() === "") {
    return true;
  }

  const num = parseFloat(value);
  return !isNaN(num) && num >= 0 && isFinite(num);
}

/**
 * Validate an exchange rate string
 * Returns true if valid positive number > 0 or empty string
 */
export function validateExchangeRate(value: string): boolean {
  if (value === "" || value.trim() === "") {
    return true;
  }

  const num = parseFloat(value);
  return !isNaN(num) && num > 0 && isFinite(num);
}

/**
 * Validate a quantity string
 * Returns true if valid positive integer or empty string
 */
export function validateQuantity(value: string): boolean {
  if (value === "" || value.trim() === "") {
    return true;
  }

  // Check if it's a valid integer (no decimal point)
  if (value.includes(".")) {
    return false;
  }

  const num = parseInt(value, 10);
  return !isNaN(num) && num >= 0 && num.toString() === value.trim();
}

/**
 * Parse an amount string to a number rounded to 2 decimals
 * Returns 0 if invalid
 */
export function parseAmount(value: string): number {
  if (value === "" || value.trim() === "") {
    return 0;
  }

  const num = parseFloat(value);
  if (isNaN(num) || !isFinite(num) || num < 0) {
    return 0;
  }

  // Round to 2 decimal places
  return Math.round(num * 100) / 100;
}

/**
 * Parse an exchange rate string to a number rounded to 4 decimals
 * Returns 1 if invalid or empty (default exchange rate)
 */
export function parseExchangeRate(value: string): number {
  if (value === "" || value.trim() === "") {
    return 1;
  }

  const num = parseFloat(value);
  if (isNaN(num) || !isFinite(num) || num <= 0) {
    return 1;
  }

  // Round to 4 decimal places
  return Math.round(num * 10000) / 10000;
}

/**
 * Parse a quantity string to an integer
 * Returns 0 if invalid
 */
export function parseQuantity(value: string): number {
  if (value === "" || value.trim() === "") {
    return 0;
  }

  const num = parseInt(value, 10);
  if (isNaN(num) || num < 0) {
    return 0;
  }

  return num;
}
