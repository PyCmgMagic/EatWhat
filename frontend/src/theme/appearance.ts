import { useSyncExternalStore } from "react";
import { instantMotion } from "../motion/runtime";

type Theme = "light" | "dark";
export type Appearance = Theme | "system";
const key = "eatwhat.appearance";
const transparencyKey = "eatwhat.navTransparency";
const defaultTransparency = 87;
const listeners = new Set<() => void>();
let preference: Appearance = "system";
let theme: Theme = "light";
let transparency = defaultTransparency;
let system: MediaQueryList;
let transition: ViewTransition | undefined;
let fallbackTimer: number | undefined;

function readPreference(): Appearance {
  try {
    const saved = localStorage.getItem(key);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* Keep a usable in-memory preference when storage is blocked. */
  }
  return "system";
}

function restoreTransparency() {
  let value = defaultTransparency;
  try {
    const saved = localStorage.getItem(transparencyKey);
    if (saved !== null && /^(?:[0-9]{1,2}|100)$/.test(saved))
      value = Number(saved);
  } catch {
    /* Use the default when browser storage is unavailable. */
  }
  applyTransparency(value);
}

function applyTransparency(value: number) {
  transparency = value;
  document.documentElement.style.setProperty("--nav-transparency", value + "%");
  listeners.forEach((notify) => notify());
}

export function setNavTransparency(value: number) {
  if (!Number.isFinite(value)) return;
  const next = Math.max(0, Math.min(100, Math.round(value)));
  if (next === transparency) return;
  applyTransparency(next);
  try {
    localStorage.setItem(transparencyKey, String(next));
  } catch {
    /* The current tab still applies the choice. */
  }
}

function apply(animate = false) {
  theme =
    preference === "system" ? (system?.matches ? "dark" : "light") : preference;
  const root = document.documentElement;
  const paint = () => {
    root.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#0f0f0e" : "#f4efeb");
  };
  transition?.skipTransition();
  if (animate && root.dataset.theme !== theme && !instantMotion()) {
    if (document.startViewTransition) {
      root.dataset.themeTransition = "";
      const current = document.startViewTransition(paint);
      transition = current;
      void current.finished.then(() => {
        if (transition === current) {
          transition = undefined;
          delete root.dataset.themeTransition;
        }
      });
    } else {
      root.dataset.themeChanging = "";
      window.clearTimeout(fallbackTimer);
      paint();
      fallbackTimer = window.setTimeout(
        () => delete root.dataset.themeChanging,
        220,
      );
    }
  } else paint();
  listeners.forEach((notify) => notify());
}

export function initializeAppearance() {
  system = window.matchMedia("(prefers-color-scheme: dark)");
  preference = readPreference();
  restoreTransparency();
  apply();
  const syncSystem = () => {
    if (preference === "system") apply();
  };
  const syncStorage = (event: StorageEvent) => {
    if (event.storageArea !== localStorage) return;
    if (event.key === transparencyKey || event.key === null)
      restoreTransparency();
    if (event.key === key || event.key === null) {
      preference = readPreference();
      apply();
    }
  };
  system.addEventListener("change", syncSystem);
  window.addEventListener("storage", syncStorage);
  return () => {
    system.removeEventListener("change", syncSystem);
    window.removeEventListener("storage", syncStorage);
  };
}

export function setAppearance(next: Appearance) {
  preference = next;
  try {
    if (next === "system") localStorage.removeItem(key);
    else localStorage.setItem(key, next);
  } catch {
    /* The current tab still applies the choice. */
  }
  apply(true);
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

export const useTheme = () => useSyncExternalStore(subscribe, () => theme);
export const useNavTransparency = () =>
  useSyncExternalStore(subscribe, () => transparency);
export const useAppearance = () =>
  useSyncExternalStore(subscribe, () => preference);
