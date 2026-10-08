import { useEffect, useRef } from 'react';

/**
 * useIdleTimeout
 * ─────────────────────────────────────────────────────────────
 * Signs a session out after a period without interaction. Sessions
 * that never expire are a finding in their own right (OWASP A07):
 * an unattended browser on a staffroom machine stays authenticated
 * forever.
 *
 * Any of the listed events counts as activity. `onIdle` is called
 * once per idle period; the timer restarts on activity.
 * ─────────────────────────────────────────────────────────────
 */

export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;   // 30 minutes

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'wheel', 'visibilitychange'];

export function useIdleTimeout({ timeoutMs = IDLE_TIMEOUT_MS, onIdle, enabled = true } = {}) {
  const callback = useRef(onIdle);

  // keep the latest callback without mutating a ref during render
  useEffect(() => { callback.current = onIdle; }, [onIdle]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;

    let timer;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => callback.current?.(), timeoutMs);
    };

    reset();
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, reset, { passive: true }));
    return () => {
      clearTimeout(timer);
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, reset));
    };
  }, [enabled, timeoutMs]);
}
