"use client";

import { useEffect, useState } from "react";

/**
 * Returns `value` only after it has stopped changing for `delay` ms.
 * Use it for search boxes so the admin API is queried once typing pauses,
 * not on every keystroke.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
