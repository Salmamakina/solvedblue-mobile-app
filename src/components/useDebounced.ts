import { useEffect, useState } from 'react';

/**
 * A value that settles `delay` ms after it stops changing.
 *
 * For a search box whose value is part of a query key: without it, every
 * keystroke is a request, and the answers can arrive out of order so the list
 * ends up showing the results for a prefix of what was typed.
 *
 * The field itself stays on the raw value, so typing never feels delayed; only
 * the fetch waits.
 */
export function useDebounced<T>(value: T, delay = 300): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return settled;
}
