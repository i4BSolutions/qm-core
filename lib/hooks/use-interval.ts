'use client';

import { useEffect, useRef } from 'react';

/**
 * Custom hook for setting up intervals with proper cleanup and ref pattern.
 *
 * Uses a ref to store the callback, preventing stale closures that can occur
 * with standard setInterval patterns in React. The callback ref is updated
 * on every render, but the interval is only restarted when the delay changes.
 *
 * @param callback - Function to call on each interval tick
 * @param delay - Delay in milliseconds between ticks, or null to disable the interval
 *
 * @example
 * // Auto-refresh every 60 seconds
 * useInterval(() => {
 *   fetchData().then(setData);
 * }, 60000);
 *
 * @example
 * // Conditionally disable interval
 * useInterval(() => {
 *   fetchData().then(setData);
 * }, isActive ? 60000 : null);
 */
export function useInterval(callback: () => void, delay: number | null): void {
  const savedCallback = useRef(callback);

  // Update ref whenever callback changes (no interval restart)
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval
  useEffect(() => {
    // Disabled when delay is null
    if (delay === null) {
      return;
    }

    const id = setInterval(() => {
      savedCallback.current();
    }, delay);

    // Cleanup on unmount or delay change
    return () => clearInterval(id);
  }, [delay]);
}
