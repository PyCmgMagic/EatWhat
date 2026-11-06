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
      "/auth/consent-offer",
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
      "/restaurants/directory",
    ].includes(path) ||
    /^\/(feedback\/mine|submissions|topics)\/[^/]+$/.test(path) ||
    path === "/admin/v4" ||
    /^\/me\/tags\/\d+\/foods$/.test(path)
  );
}
