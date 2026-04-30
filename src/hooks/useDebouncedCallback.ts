import { useCallback, useEffect, useRef } from 'react';

interface Options {
  leading?: boolean;
}

/**
 * Returns a stable debounced version of `fn` that always calls the latest `fn`
 * (no stale closures). Auto-cancels on unmount.
 *
 * Returns a tuple: [debounced, cancel, flush]
 */
export function useDebouncedCallback<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  delay: number,
  options: Options = {}
): [(...args: TArgs) => void, () => void, () => void] {
  const fnRef = useRef(fn);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastArgsRef = useRef<TArgs | null>(null);
  const leadingFiredRef = useRef(false);

  // Always keep the latest fn
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    leadingFiredRef.current = false;
    lastArgsRef.current = null;
  }, []);

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (lastArgsRef.current) {
      const args = lastArgsRef.current;
      lastArgsRef.current = null;
      fnRef.current(...args);
    }
    leadingFiredRef.current = false;
  }, []);

  const debounced = useCallback(
    (...args: TArgs) => {
      lastArgsRef.current = args;

      if (options.leading && !leadingFiredRef.current) {
        leadingFiredRef.current = true;
        fnRef.current(...args);
        lastArgsRef.current = null;
      }

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        leadingFiredRef.current = false;
        if (lastArgsRef.current) {
          const a = lastArgsRef.current;
          lastArgsRef.current = null;
          fnRef.current(...a);
        }
      }, delay);
    },
    [delay, options.leading]
  );

  // Cleanup on unmount
  useEffect(() => () => cancel(), [cancel]);

  return [debounced, cancel, flush];
}
