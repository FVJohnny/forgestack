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
  // True while a poll's callback is in flight. Guards against starting a second
  // overlapping chain if the tab is toggled hidden then visible mid-request.
  const isPollingRef = useRef(false);
  const callbackRef = useRef(callback);

  // Keep callback ref updated without triggering effect re-runs
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    isMountedRef.current = true;

    if (!enabled) return;

    const poll = async () => {
      if (!isMountedRef.current || isPollingRef.current) return;
      // Stop the chain while the tab is hidden; the visibilitychange handler
      // below restarts it when the user comes back.
      if (document.hidden) return;

      isPollingRef.current = true;
      try {
        await callbackRef.current();
      } catch (error) {
        console.error('Polling error:', error);
      } finally {
        isPollingRef.current = false;
      }

      // Schedule next poll only after this one completes. Skip if a fresh
      // chain was already started (e.g. by the visibility handler) while we
      // were awaiting, to avoid two concurrent timers.
      if (isMountedRef.current && !document.hidden) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(poll, intervalMs);
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden || !isMountedRef.current) return;
      // Back in the foreground: refresh immediately, then resume the cadence.
      // If a poll is already running (request in flight from before the tab
      // was hidden), do nothing: it will reschedule itself on completion.
      if (isPollingRef.current) return;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      void poll();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Start the first poll after the interval
    timeoutRef.current = setTimeout(poll, intervalMs);

    return () => {
      isMountedRef.current = false;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [intervalMs, enabled]);
}
