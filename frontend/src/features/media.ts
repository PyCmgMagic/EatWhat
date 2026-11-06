import { useRef } from "react";
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
