import type { Session } from "../api/client";
import { demoEnabled } from "./mode";
export const isDemo = demoEnabled(
  location.search,
  import.meta.env.DEV,
  import.meta.env.VITE_ENABLE_DEMO === "true",
);
const storageKey = isDemo ? "eatwhat-demo-session" : "eatwhat-session";
let memorySession: Session | null = null;
let storageWriteFailed = false;
function parseSession(raw: string | null): Session | null {
  try {
    const s = JSON.parse(raw || "null");
    if (
      typeof s?.tokenName === "string" &&
      s.tokenName &&
      typeof s?.tokenValue === "string" &&
      s.tokenValue
    )
      return { tokenName: s.tokenName, tokenValue: s.tokenValue };
  } catch {
    /* Malformed storage is a signed-out session. */
  }
  return null;
}
// Move this tab's existing login once. A shared null is an explicit logout and
// must take precedence over any stale sessionStorage in another old tab.
try {
  if (localStorage.getItem(storageKey) === null) {
    const legacy = sessionStorage.getItem(storageKey);
    if (legacy !== null)
      localStorage.setItem(storageKey, JSON.stringify(parseSession(legacy)));
  }
  sessionStorage.removeItem(storageKey);
} catch {
  /* Storage may be disabled; normal login still has a memory fallback. */
}
export function readSession(): Session | null {
  if (storageWriteFailed) return memorySession;
  try {
    memorySession = parseSession(localStorage.getItem(storageKey));
  } catch {
    /* session memory fallback */
  }
  return memorySession;
}
export function writeSession(session: Session | null) {
  memorySession = session;
  try {
    localStorage.setItem(storageKey, JSON.stringify(session));
    storageWriteFailed = false;
  } catch {
    /* memory-only session */
    storageWriteFailed = true;
  }
}
export function sameSession(a: Session | null, b: Session | null) {
  return a?.tokenName === b?.tokenName && a?.tokenValue === b?.tokenValue;
}
export function subscribeSession(listener: (session: Session | null) => void) {
  const onStorage = (event: StorageEvent) => {
    if (
      event.storageArea === localStorage &&
      (event.key === storageKey || event.key === null)
    ) {
      storageWriteFailed = false;
      listener(readSession());
    }
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}
if (isDemo) {
  const initialSession = {
    tokenName: "satoken",
    tokenValue: "isolated-demo-token",
  };
  try {
    // A stored null remembers an explicit logout, including after a refresh.
    if (localStorage.getItem(storageKey) === null) writeSession(initialSession);
  } catch {
    memorySession = initialSession;
  }
}
