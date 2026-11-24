import { useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { uuidV7 } from "../api/install-id";
import type {
  TelemetryBatch,
  TelemetryPage,
  TelemetryProperties,
} from "../api/v4-types";
import { isAdminPath } from "./admin-routes";
import { useApp } from "./state";
import {
  readGuestUsage,
  useGuestUsage,
  webUsageEvent,
  withGuestUsageLock,
} from "./web-usage";

export function useTelemetryConsent(enabled = true) {
  const { api, session, user } = useApp();
  const key = ["telemetry", "consent", user?.id] as const;
  const query = useQuery({
    queryKey: key,
    queryFn: () => api.telemetryConsent(),
    enabled: enabled && !!session && !!user?.id,
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
  const cache = useQueryClient();
  const { pathname } = useLocation();
  const admin = isAdminPath(pathname);
  const { query } = useTelemetryConsent(!admin);
  const guestUsage = useGuestUsage();
  const guest = !session;
  const consent = query.data;
  const owner = guest ? "guest" : user?.id;
  const revision = guest ? 0 : consent?.revision;
  const enabled =
    !admin &&
    (guest
      ? guestUsage === "on"
      : query.isSuccess && consent?.enabled === true);
  const opening = useRef(admin ? null : { session, guestUsage });
  const lastView = useRef<{ owner: number | "guest"; path: string } | null>(
    null,
  );
  const send = useCallback(
    (properties: TelemetryProperties[]) => {
      if (!enabled || revision == null || owner == null) return;
      const batch: TelemetryBatch = {
        consentRevision: revision,
        events: properties.map((item) => ({
          eventId: uuidV7(),
          properties: item,
        })),
      };
      const call = guest
        ? withGuestUsageLock(async () => {
            if (readGuestUsage() === "on")
              await api.telemetryEvents(batch, true);
          })
        : api.telemetryEvents(batch).then((result) => {
            if (result.enabled === false)
              return cache.invalidateQueries({
                queryKey: ["telemetry", "consent", owner],
              });
          });
      // Statistics must never interrupt browsing.
      void call.catch(() => {});
    },
    [api, cache, enabled, guest, owner, revision],
  );

  useEffect(() => {
    const start = opening.current;
    if (admin || !enabled || owner == null || revision == null) {
      lastView.current = null;
      if (
        admin ||
        (guest && guestUsage !== "on") ||
        (!guest && consent?.enabled === false)
      )
        opening.current = null;
      return;
    }
    if (lastView.current?.owner === owner && lastView.current.path === pathname)
      return;
    lastView.current = { owner, path: pathname };
    const events: TelemetryProperties[] = [];
    if (
      start &&
      start.session === session &&
      (!guest || start.guestUsage === "on")
    )
      events.push({ event: "app_open" });
    opening.current = null;
    events.push({ event: "page_view", page: pageCategory(pathname) });
    send(events);
  }, [
    admin,
    consent?.enabled,
    enabled,
    guest,
    guestUsage,
    owner,
    pathname,
    revision,
    send,
    session,
  ]);

  useEffect(() => {
    function record(event: Event) {
      send([(event as CustomEvent<TelemetryProperties>).detail]);
    }
    window.addEventListener(webUsageEvent, record);
    return () => window.removeEventListener(webUsageEvent, record);
  }, [send]);
  return null;
}
