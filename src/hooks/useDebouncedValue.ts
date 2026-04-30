import { useEffect, useState } from 'react';

/**
 * Returns a debounced copy of `value` that updates only after `delay` ms
 * of stability. Use for search inputs / sliders / anything that changes rapidly.
 */
export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
