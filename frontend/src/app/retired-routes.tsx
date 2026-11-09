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

/** Old bookmarks must not reopen retired registration or authorization flows. */
export function retiredRouteDestination(
  path: string,
  search: string,
  signedIn: boolean,
) {
  const current = normalizeAuthRoute(path);
  if (current !== path) return current + search;
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
