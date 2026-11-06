import { useEffect, useRef } from "react";
export function useSendSignal() {
  const controller = useRef(new AbortController());
  useEffect(() => {
    controller.current = new AbortController();
    return () => controller.current.abort();
  }, []);
  return () => controller.current.signal;
}
