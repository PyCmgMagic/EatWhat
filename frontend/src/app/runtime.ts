import type { Session } from "../api/client";
export const isDemo = import.meta.env.DEV
  ? new URLSearchParams(location.search).get("demo") !== "0"
  : import.meta.env.VITE_ENABLE_DEMO === "true" &&
    new URLSearchParams(location.search).get("demo") === "1";
const storageKey = isDemo ? "eatwhat-demo-session" : "eatwhat-session";
let memorySession: Session | null = null;
export function readSession(): Session | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(storageKey) || "null");
    if (
      typeof s?.tokenName === "string" &&
      typeof s?.tokenValue === "string" &&
      s.tokenValue
    )
      return s;
  } catch {
    /* session memory fallback */
  }
  return memorySession;
}
export function writeSession(session: Session | null) {
  memorySession = session;
  try {
    if (session || isDemo)
      sessionStorage.setItem(storageKey, JSON.stringify(session));
    else sessionStorage.removeItem(storageKey);
  } catch {
    /* memory-only session */
  }
}
if (isDemo) {
  const initialSession = {
    tokenName: "satoken",
    tokenValue: "isolated-demo-token",
  };
  try {
    // A stored null remembers an explicit logout, including after a refresh.
    if (sessionStorage.getItem(storageKey) === null)
      writeSession(initialSession);
  } catch {
    memorySession = initialSession;
  }
}
