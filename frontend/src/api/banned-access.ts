import type { RequestOptions } from "./client";

/** Restricted accounts retain browsing and account care, without publishing. */
const restrictedPages = new Set([
  "/me",
  "/me/shares",
  "/me/growth",
  "/me/growth/leaderboard",
  "/me/tags",
  "/favorites",
  "/likes",
  "/history",
  "/notifications",
  "/announcements",
  "/help",
  "/feedback",
  "/feedback/mine",
  "/reports/new",
  "/restaurants/correction",
  "/restaurants/favorites",
  "/submissions",
  "/settings",
  "/settings/account",
  "/settings/password",
  "/settings/devices",
  "/settings/phone",
  "/settings/bind-phone",
  "/settings/username",
  "/settings/delete",
  "/settings/privacy",
  "/settings/blocked",
  "/settings/notifications",
  "/settings/personalization",
  "/settings/preferences",
]);
export function bannedPageAllowed(path: string) {
  return (
    restrictedPages.has(path) ||
    /^\/(users\/\d+|feedback\/mine\/\d+|submissions\/[^/]+|me\/tags\/\d+\/foods)$/.test(
      path,
    )
  );
}

/** Withdrawing an interaction never creates content or a new social edge. */
export function withdrawalAllowed(path: string, options: RequestOptions = {}) {
  const method = (options.method ?? "GET").toUpperCase();
  return (
    (method === "POST" &&
      /^\/(foods\/[^/]+\/un(?:like|favorite)|user\/unfollow)$/.test(path)) ||
    (method === "DELETE" &&
      /^\/(restaurant\/[^/]+\/(favorite|rating)|foods\/[^/]+\/rating|comments\/[^/]+\/(like|reactions\/[^/]+)|activity\/posts\/[^/]+\/like|history\/browse)$/.test(
        path,
      ))
  );
}

/** Explicit write allowlist; unknown authenticated commands remain blocked. */
export function bannedRequestAllowed(
  path: string,
  options: RequestOptions = {},
) {
  const method = (options.method ?? "GET").toUpperCase();
  if (
    /^\/(admin(?:\/|$)|user\/(list|ban\/|unban\/)|auth\/security\/)/.test(path)
  )
    return false;
  if (/^\/auth\/(sdu(?:\/|$)|sendEmail$|verifyEmail$)/.test(path)) return false;
  if (method === "GET" || method === "HEAD") return true;
  if (withdrawalAllowed(path, options)) return true;
  if (method === "POST") {
    if (
      /^\/auth\/(logout|changePassword|getCode|password\/(code|reset)|username\/set|checkUsername|consent\/grant|account\/delete(?:\/code)?|phone\/verification(?:\/web-token)?|sessions\/revoke-others)$/.test(
        path,
      )
    )
      return true;
    if (
      /^\/user\/(changePrivacy|bindMobile|getCode|mobile\/change\/(old-code|verify-old|new-code|commit))$/.test(
        path,
      )
    )
      return true;
    if (
      /^\/notification\/(read\/(all|[^/]+)|cards\/([^/]+\/read|read-all))$/.test(
        path,
      )
    )
      return true;
    if (/^\/feedback\/(messages|reports|catalog-errors)$/.test(path))
      return true;
    if (
      /^\/push\/(bindings(?:\/[^/]+\/(token|transfer|unbind))?|commands\/status|settings\/(enable|disable))$/.test(
        path,
      )
    )
      return true;
    if (path === "/telemetry/events" || path === "/device/register")
      return true;
    const body = options.body as { biz?: string; key?: string } | undefined;
    if (/^\/upload\/presign(?:\/batch)?$/.test(path))
      return body?.biz === "feedback";
    // The server must additionally check the stored purpose and owner of this key.
    if (path === "/upload/complete") return /^feedback\//.test(body?.key ?? "");
  }
  if (method === "DELETE" && /^\/auth\/sessions\/[^/]+$/.test(path))
    return true;
  if (
    ["PUT", "DELETE"].includes(method) &&
    /^\/(user\/blocks\/[^/]+|user\/recommendation-profile\/preferences|telemetry\/consent)$/.test(
      path,
    )
  )
    return true;
  return method === "PUT" && path === "/user/recommendation-settings";
}

export const bannedActionMessage =
  "账号受限，暂时不能进行此操作。可在“我的”查看原因并申诉。";
