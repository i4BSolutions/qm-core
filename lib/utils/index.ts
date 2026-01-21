import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind CSS classes with clsx and tailwind-merge
 * This handles class conflicts and conditional classes properly
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number with thousand separators and proper decimal places
 * Returns just the formatted number (e.g., "1,234.56")
 * Rounds to specified decimals to avoid floating point display issues
 */
export function formatCurrency(
  amount: number,
  decimals: number = 2
): string {
  // Round first to avoid floating point precision issues (e.g., 3999.9999999 -> 4000)
  const multiplier = Math.pow(10, decimals);
  const rounded = Math.round(amount * multiplier) / multiplier;

  return new Intl.NumberFormat("en-US", {
    style: "decimal",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(rounded);
}

/**
 * Format a number with currency suffix (e.g., "1,234.56 MMK")
 */
export function formatAmount(
  amount: number,
  currency: string = "MMK",
  decimals: number = 2
): string {
  return formatCurrency(amount, decimals) + ` ${currency}`;
}

/**
 * Format a number as EUSD equivalent (e.g., "1,234.56 EUSD")
 */
export function formatEUSD(amount: number): string {
  return formatCurrency(amount, 2) + " EUSD";
}

/**
 * Calculate EUSD from amount and exchange rate
 */
export function calculateEUSD(amount: number, exchangeRate: number): number {
  if (exchangeRate <= 0) return 0;
  return Math.round((amount / exchangeRate) * 100) / 100;
}

/**
 * Format a date string to a readable format
 */
export function formatDate(
  date: string | Date,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  }
): string {
  return new Date(date).toLocaleDateString("en-US", options);
}

/**
 * Format a date to relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;

  return formatDate(date);
}

/**
 * Debounce a function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Capitalize first letter of a string
 */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * Convert snake_case to Title Case
 */
export function snakeToTitle(text: string): string {
  return text
    .split("_")
    .map((word) => capitalize(word))
    .join(" ");
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
