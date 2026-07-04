'use client';

import { useEffect, useRef } from 'react';

/**
 * A hook that polls a function at a specified interval, but only starts
 * the next timer AFTER the previous call completes. This prevents request
 * buildup if responses are slow.
 *
 * @param callback - The async function to poll
 * @param intervalMs - The delay between completion and next call
 * @param enabled - Whether polling is enabled
 */
export function usePolling(callback: () => Promise<void>, intervalMs: number, enabled: boolean) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const callbackRef = useRef(callback);

  // Keep callback ref updated without triggering effect re-runs
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    isMountedRef.current = true;

    if (!enabled) return;

    const poll = async () => {
      if (!isMountedRef.current) return;

      try {
        await callbackRef.current();
      } catch (error) {
        console.error('Polling error:', error);
      }

      // Schedule next poll only after this one completes
      if (isMountedRef.current) {
        timeoutRef.current = setTimeout(poll, intervalMs);
      }
    };

    // Start the first poll after the interval
    timeoutRef.current = setTimeout(poll, intervalMs);

    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [intervalMs, enabled]);
}
