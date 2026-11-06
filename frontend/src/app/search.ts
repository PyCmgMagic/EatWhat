import { useEffect, useState } from "react";

// Keep typing immediate; only the network keyword waits for a pause.
export function useDebouncedSearch(value: string, delay = 250) {
  const [committed, setCommitted] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setCommitted(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return value === "" ? "" : committed;
}
