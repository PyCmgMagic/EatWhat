import { parseId } from "../api/models";

export function restaurantHistoryId(path: string) {
  return parseId(/^\/restaurants\/(\d+)\/history$/.exec(path)?.[1]);
}

export function isV4Path(path: string) {
  return (
    [
      "/feedback",
      "/feedback/mine",
      "/reports/new",
      "/restaurants/correction",
      "/settings/devices",
      "/settings/phone",
      "/settings/delete",
      "/settings/notifications",
      "/settings/telemetry",
      "/auth/account-recovery",
      "/auth/device-recovery",
      "/auth/mobile-recovery",
      "/notifications",
      "/announcements",
      "/topics",
      "/topics/current",
      "/submissions",
      "/restaurants/favorites",
      "/features",
      "/me/growth",
      "/restaurants/directory",
    ].includes(path) ||
    restaurantHistoryId(path) !== undefined ||
    /^\/(feedback\/mine|submissions|topics)\/[^/]+$/.test(path) ||
    path === "/admin/v4" ||
    /^\/me\/tags\/\d+\/foods$/.test(path)
  );
}
