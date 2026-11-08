import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
// Renew a failed signed URL once; repeated failures must not create a request loop.
export function useFoodImageRefresh() {
  const tried = useRef(false),
    cache = useQueryClient();
  return (src?: string) => {
    if (tried.current || !src || !/^https?:\/\//i.test(src)) return;
    tried.current = true;
    void cache.invalidateQueries({ queryKey: ["foods"] });
  };
}

/** Show a labeled fallback while allowing a refreshed signed URL to recover. */
export function useFoodPhoto(src?: string) {
  const [failedSrc, setFailedSrc] = useState<string>();
  const renew = useFoodImageRefresh();
  const failed = !!src && failedSrc === src;
  return {
    unavailable: !src || failed,
    failed,
    onError: () => {
      if (!src) return;
      setFailedSrc(src);
      renew(src);
    },
  };
}
