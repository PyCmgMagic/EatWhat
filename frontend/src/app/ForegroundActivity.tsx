import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useApp } from "./state";
import { readSession, sameSession } from "./runtime";
import { watchForegroundActivity } from "./foreground-activity";

export default function ForegroundActivity() {
  const { api, session, user } = useApp();
  const cache = useQueryClient(),
    { pathname } = useLocation();
  const enabled =
    !!session &&
    !!user?.id &&
    user.banned !== true &&
    !/^\/(admin|auth)(\/|$)/.test(pathname) &&
    pathname !== "/settings/delete";
  useEffect(() => {
    if (!enabled) return;
    return watchForegroundActivity({
      run: (signal) => api.recordActivity(signal),
      isCurrent: () => sameSession(session, readSession()),
      accept: (result) => {
        if (result.growth)
          cache.setQueryData(["growth", user!.id, "progress"], result.growth);
        void cache.invalidateQueries({
          queryKey: ["growth", user!.id, "ledger"],
        });
      },
    });
  }, [enabled, api, cache, session?.tokenName, session?.tokenValue, user?.id]);
  return null;
}
