import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useApp } from "./state";
import { safeLoginNext } from "./auth-dialog";
import { normalizeAuthRoute } from "./auth-routes";

const retired = new Set([
  "/auth/consent",
  "/auth/consent-offer",
  "/auth/withdraw-consent",
]);

/**
 * Features backend v2 does not have. Old links land on the closest page that
 * still exists, and menus use isRetiredV2 to leave the entries out.
 */
const v2Retired: [RegExp, string][] = [
  [/^\/me\/growth$/, "/me"],
  [/^\/me\/tags(\/.*)?$/, "/me"],
  [/^\/topics(\/.*)?$/, "/"],
  [/^\/submissions(\/.*)?$/, "/me"],
  [/^\/settings\/delete$/, "/settings/account"],
  [/^\/settings\/telemetry$/, "/settings"],
  [/^\/settings\/notifications$/, "/settings"],
  [/^\/auth\/(account|mobile|device)-recovery$/, "/settings/account"],
];
export function isRetiredV2(to: string | null | undefined) {
  const path = (to ?? "").split(/[?#]/)[0].replace(/\/+$/, "");
  return v2Retired.some(([pattern]) => pattern.test(path));
}

/** Old bookmarks must not reopen retired registration or authorization flows. */
export function retiredRouteDestination(
  path: string,
  search: string,
  signedIn: boolean,
) {
  const current = normalizeAuthRoute(path);
  if (current !== path) return current + search;
  const gone = v2Retired.find(([pattern]) =>
    pattern.test(path.replace(/\/+$/, "")),
  );
  if (gone) return gone[1];
  if (!retired.has(path.replace(/\/+$/, ""))) return null;
  const next = safeLoginNext(new URLSearchParams(search).get("next"));
  return signedIn
    ? (next ?? "/settings/account")
    : "/auth/password" + (next ? "?next=" + encodeURIComponent(next) : "");
}

export default function RetiredRouteBoundary({
  children,
}: {
  children: ReactNode;
}) {
  const { pathname, search, state } = useLocation();
  const { session } = useApp();
  const target = retiredRouteDestination(pathname, search, !!session);
  return target ? <Navigate to={target} replace state={state} /> : children;
}
