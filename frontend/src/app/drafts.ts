import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { isDemo } from "./runtime";

const memory = new Map<string, unknown>();
const prefix = `eatwhat:${isDemo ? "demo" : "live"}:draft:`;

/** Only call this with non-sensitive form fields; passwords and tokens are excluded. */
export function readDraft<T>(key: string, initial: T): T {
  try {
    const value = JSON.parse(sessionStorage.getItem(prefix + key) || "null");
    if (value === null || typeof value !== typeof initial) return initial;
    if (
      typeof initial === "object" &&
      initial !== null &&
      !Array.isArray(initial)
    ) {
      if (Array.isArray(value)) return initial;
      const result = { ...initial };
      for (const field of Object.keys(initial) as (keyof T)[]) {
        if (
          field in value &&
          (initial[field] == null ||
            (typeof value[field] === typeof initial[field] &&
              Array.isArray(value[field]) === Array.isArray(initial[field])))
        )
          result[field] = value[field];
      }
      return result;
    }
    return Array.isArray(value) === Array.isArray(initial) ? value : initial;
  } catch {
    return initial;
  }
}

export function writeDraft<T>(key: string, value: T) {
  try {
    sessionStorage.setItem(prefix + key, JSON.stringify(value));
  } catch {
    /* Keep the current form usable. */
  }
}
export function removeDraft(key: string) {
  try {
    sessionStorage.removeItem(prefix + key);
  } catch {
    /* Storage may be unavailable. */
  }
}

/** Comment drafts and uncertain commands belong to one authenticated lifetime. */
export function clearCommentDrafts() {
  for (const [key, value] of memory) {
    if (!key.startsWith(prefix + "comments:")) continue;
    if (Array.isArray(value))
      for (const item of value) {
        if (typeof item?.url === "string" && item.url.startsWith("blob:"))
          URL.revokeObjectURL(item.url);
      }
    memory.delete(key);
  }
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(prefix + "comments:")) sessionStorage.removeItem(key);
    }
  } catch {
    /* Storage can be unavailable. */
  }
}

export function useSessionDraft<T>(key: string, initial: T) {
  return useDraftState(key, initial, true);
}
/** Files stay in this tab's memory and never enter persistent storage. */
export function useMemoryDraft<T>(key: string, initial: T) {
  return useDraftState(key, initial, false);
}
function useDraftState<T>(key: string, initial: T, persistent: boolean) {
  const storageKey = prefix + key;
  const load = () =>
    persistent
      ? readDraft(key, initial)
      : memory.has(storageKey)
        ? (memory.get(storageKey) as T)
        : initial;
  const [snapshot, setSnapshot] = useState(() => ({
    key: storageKey,
    value: load(),
  }));
  const current = useRef(snapshot);
  if (snapshot.key !== storageKey) {
    current.current = { key: storageKey, value: load() };
    setSnapshot(current.current);
  }
  const setDraft: Dispatch<SetStateAction<T>> = (next) => {
    const previous =
      current.current.key === storageKey ? current.current.value : load();
    const updated =
      typeof next === "function" ? (next as (old: T) => T)(previous) : next;
    if (persistent) writeDraft(key, updated);
    else memory.set(storageKey, updated);
    // A late async callback for the previous owner must not replace this form.
    if (current.current.key === storageKey) {
      current.current = { key: storageKey, value: updated };
      setSnapshot(current.current);
    }
  };
  const clear = () =>
    persistent ? removeDraft(key) : memory.delete(storageKey);
  return [current.current.value, setDraft, clear] as const;
}

/** Async results may finish after a route has unmounted. Never navigate from it. */
export function usePageLifetime() {
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  return active;
}
