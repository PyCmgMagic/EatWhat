import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useApp } from "./state";
import { safeLoginNext } from "./auth-dialog";

const retired = new Set([
  "/auth/consent",
  "/auth/consent-offer",
  "/auth/withdraw-consent",
]);

/** Old bookmarks must not reopen the retired cross-site authorization flow. */
export function retiredRouteDestination(
  path: string,
  search: string,
  signedIn: boolean,
) {
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
  const { pathname, search } = useLocation();
  const { session } = useApp();
  const target = retiredRouteDestination(pathname, search, !!session);
  return target ? <Navigate to={target} replace /> : children;
}
