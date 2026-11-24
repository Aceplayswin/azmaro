"use client";

import { useEffect, useState } from "react";

/**
 * Returns `value` only after it has stopped changing for `delay` ms.
 * Use it to keep search inputs responsive while delaying the expensive work
 * (API requests, URL updates, large client-side filters) until typing pauses.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
