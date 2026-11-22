import { useCallback, useEffect, useRef, useState } from 'react';

export function formatClock(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// A small countdown shared by the meditation and movement tools.
// Time is tracked in refs so the interval callback never reads stale state.
export default function useCountdown(initialSeconds, onComplete) {
  const [state, setState] = useState({
    remaining: initialSeconds,
    total: initialSeconds,
    running: false,
    done: false,
  });
  const timer = useRef(null);
  const left = useRef(initialSeconds);
  const total = useRef(initialSeconds);
  const completeRef = useRef(onComplete);

  useEffect(() => {
    completeRef.current = onComplete;
  }, [onComplete]);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  // Stop ticking when the component unmounts.
  useEffect(() => clear, [clear]);

  const tick = useCallback(() => {
    left.current -= 1;
    const remaining = left.current;
    if (remaining <= 0) {
      clear();
      setState((current) => ({ ...current, remaining: 0, running: false, done: true }));
      if (completeRef.current) completeRef.current();
      return;
    }
    setState((current) => ({ ...current, remaining }));
  }, [clear]);

  const start = useCallback(() => {
    if (timer.current !== null) return;
    if (left.current <= 0) left.current = total.current;
    const remaining = left.current;
    setState((current) => ({ ...current, remaining, running: true, done: false }));
    timer.current = window.setInterval(tick, 1000);
  }, [tick]);

  const pause = useCallback(() => {
    clear();
    setState((current) => ({ ...current, running: false }));
  }, [clear]);

  const reset = useCallback((seconds) => {
    clear();
    const next = typeof seconds === 'number' ? seconds : total.current;
    total.current = next;
    left.current = next;
    setState({ remaining: next, total: next, running: false, done: false });
  }, [clear]);

  return {
    ...state,
    progress: state.total ? 1 - state.remaining / state.total : 0,
    start,
    pause,
    reset,
  };
}
