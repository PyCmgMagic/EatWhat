import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { uuidV7 } from "../api/install-id";
import type { TelemetryBatch, TelemetryPage } from "../api/v4-types";
import { useApp } from "./state";

export function useTelemetryConsent() {
  const { api, session, user } = useApp();
  const key = ["telemetry", "consent", user?.id] as const;
  const query = useQuery({
    queryKey: key,
    queryFn: () => api.telemetryConsent(),
    enabled: !!session && !!user?.id,
    refetchOnWindowFocus: true,
  });
  return { key, query };
}

function pageCategory(path: string): TelemetryPage {
  if (path === "/" || path === "/home-photo") return "HOME";
  if (path === "/recommend") return "RECOMMEND";
  if (
    ["/search", "/nearby", "/restaurants", "/restaurants/directory"].includes(
      path,
    )
  )
    return "SEARCH";
  if (/^\/restaurants\/\d+$/.test(path)) return "RESTAURANT";
  if (/^\/foods\/\d+$/.test(path)) return "FOOD";
  if (path === "/notifications") return "MESSAGE";
  if (/^\/(me(?:\/|$)|users\/\d+$)/.test(path)) return "PROFILE";
  return "OTHER";
}

export default function WebTelemetry() {
  const { api, session, user } = useApp();
  const { query } = useTelemetryConsent();
  const cache = useQueryClient();
  const { pathname } = useLocation();
  // Opening belongs to this document. A later login or opt-in is not another open.
  const openingSession = useRef(session);
  const lastView = useRef<{ owner: number; path: string } | null>(null);
  useEffect(() => {
    const consent = query.data;
    if (
      !session ||
      !user?.id ||
      !query.isSuccess ||
      consent?.revision == null
    ) {
      if (!session) lastView.current = null;
      return;
    }
    const opened = openingSession.current === session;
    openingSession.current = null;
    if (!consent.enabled) {
      lastView.current = null;
      return;
    }
    if (
      lastView.current?.owner === user.id &&
      lastView.current.path === pathname
    )
      return;
    lastView.current = { owner: user.id, path: pathname };
    const events: TelemetryBatch["events"] = [];
    if (opened)
      events.push({ eventId: uuidV7(), properties: { event: "app_open" } });
    events.push({
      eventId: uuidV7(),
      properties: { event: "page_view", page: pageCategory(pathname) },
    });
    void api
      .telemetryEvents({ consentRevision: consent.revision, events })
      .then((result) => {
        // The setting may have changed on another device since the last read.
        if (result.enabled === false)
          return cache.invalidateQueries({
            queryKey: ["telemetry", "consent", user.id],
          });
      })
      .catch(() => {
        /* Statistics must not interrupt browsing. */
      });
  }, [api, cache, session, user?.id, query.isSuccess, query.data, pathname]);
  return null;
}
