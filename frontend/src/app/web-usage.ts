import { useSyncExternalStore } from "react";
import type { Api } from "../api/service";
import type { TelemetryProperties } from "../api/v4-types";

const guestPreferenceKey = "eatwhat.guestUsage";
const preferenceEvent = "eatwhat:guest-usage";
export const webUsageEvent = "eatwhat:web-usage";
type GuestPreference = "off" | "on" | "delete-pending";
let guestPreference: GuestPreference = "off";

export function readGuestUsage(): GuestPreference {
  try {
    const value = localStorage.getItem(guestPreferenceKey);
    return value === "on" || value === "delete-pending" ? value : "off";
  } catch {
    return guestPreference;
  }
}

export function setGuestUsage(value: GuestPreference) {
  guestPreference = value;
  try {
    localStorage.setItem(guestPreferenceKey, value);
  } catch {
    // A browser that blocks storage can still apply the choice for this page.
  }
  window.dispatchEvent(new Event(preferenceEvent));
}

export function useGuestUsage() {
  return useSyncExternalStore(subscribe, readGuestUsage);
}

function subscribe(notify: () => void) {
  function changed(event: StorageEvent) {
    if (event.key === guestPreferenceKey || event.key === null) notify();
  }
  window.addEventListener(preferenceEvent, notify);
  window.addEventListener("storage", changed);
  return () => {
    window.removeEventListener(preferenceEvent, notify);
    window.removeEventListener("storage", changed);
  };
}

// A queued report must recheck consent once it holds the shared browser lock.
// Deleting then waits behind any report already in flight on this installation.
export async function withGuestUsageLock<T>(operation: () => Promise<T>) {
  if (navigator.locks)
    return navigator.locks.request(guestPreferenceKey, operation);
  const previous = guestQueue;
  const next = previous.then(operation);
  guestQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}
let guestQueue = Promise.resolve();

export async function disableGuestUsage(api: Api) {
  setGuestUsage("delete-pending");
  await withGuestUsageLock(async () => {
    if (readGuestUsage() !== "delete-pending") return;
    await api.disableGuestTelemetry();
    setGuestUsage("off");
  });
}

export function reportWebUsage(properties: TelemetryProperties) {
  window.dispatchEvent(
    new CustomEvent<TelemetryProperties>(webUsageEvent, { detail: properties }),
  );
}
