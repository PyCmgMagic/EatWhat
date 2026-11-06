import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useLocation } from "react-router-dom";
import { useApp } from "./state";
import { isDemo } from "./runtime";

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
function writeAdminState(
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
