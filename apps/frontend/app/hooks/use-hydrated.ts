import { useEffect, useState } from 'react';

/**
 * Returns true only after the component has hydrated on the client.
 * Use this to keep initial client render identical to SSR markup,
 * then switch to live, client-only state after hydration.
 */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  return hydrated;
}
