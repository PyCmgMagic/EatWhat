import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useLocation } from "react-router-dom";
import { useApp } from "./state";
import { isDemo } from "./runtime";
import {
  isAdminPath,
  safeAdminWorkspace,
  safeFrontWorkspace,
} from "./admin-routes";

function storageKey(user: number | null | undefined, key: string) {
  return `eatwhat-admin:${isDemo ? "demo" : "live"}:${user ?? "guest"}:${key}`;
}
export function readAdminState<T>(
  user: number | null | undefined,
  key: string,
  fallback: T,
): T {
  if (!user) return fallback;
  try {
    const raw = sessionStorage.getItem(storageKey(user, key));
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}
export function writeAdminState(
  user: number | null | undefined,
  key: string,
  value: unknown,
) {
  if (!user) return;
  try {
    if (value === undefined) sessionStorage.removeItem(storageKey(user, key));
    else sessionStorage.setItem(storageKey(user, key), JSON.stringify(value));
  } catch {
    /* Navigation still works if session storage is unavailable. */
  }
}

export function workspaceDestination(
  user: number | null | undefined,
  mode: "front" | "admin",
) {
  const saved = readAdminState<unknown>(user, `workspace:${mode}`, null);
  return mode === "admin"
    ? (safeAdminWorkspace(saved) ?? "/admin")
    : (safeFrontWorkspace(saved) ?? "/me");
}

export function useRememberWorkspaces() {
  const { user } = useApp();
  const location = useLocation();
  useEffect(() => {
    if (user?.role !== "admin") return;
    const address = location.pathname + location.search;
    const mode = isAdminPath(location.pathname) ? "admin" : "front";
    const safe =
      mode === "admin"
        ? safeAdminWorkspace(address)
        : safeFrontWorkspace(address);
    if (safe) writeAdminState(user.id, `workspace:${mode}`, safe);
  }, [user?.id, user?.role, location.pathname, location.search]);
}
/** Non-secret working state is isolated to the current admin and browser tab. */
export function useAdminState<T>(
  key: string,
  initial: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const { user } = useApp();
  const scope = storageKey(user?.id, key);
  const init = () =>
    readAdminState(
      user?.id,
      key,
      typeof initial === "function" ? (initial as () => T)() : initial,
    );
  const [stored, setStored] = useState(() => ({ scope, value: init() }));
  const value = stored.scope === scope ? stored.value : init();
  if (stored.scope !== scope) setStored({ scope, value });
  const setValue: Dispatch<SetStateAction<T>> = (next) =>
    setStored((previous) => {
      const current = previous.scope === scope ? previous.value : init();
      const value =
        typeof next === "function" ? (next as (value: T) => T)(current) : next;
      writeAdminState(user?.id, key, value);
      return { scope, value };
    });
  return [value, setValue];
}
export function useAdminReturnTo(destination: "/admin" | "/admin/v4") {
  const { user } = useApp(),
    location = useLocation();
  useEffect(() => {
    if (user?.role === "admin")
      writeAdminState(
        user.id,
        `route:${location.pathname}`,
        location.pathname + location.search,
      );
  }, [user?.id, user?.role, location.pathname, location.search]);
  const previous = readAdminState(
    user?.id,
    `route:${destination}`,
    destination,
  );
  return previous.split("?")[0] === destination ? previous : destination;
}
