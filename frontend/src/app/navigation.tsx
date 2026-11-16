import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";
import { Link, useLocation, useNavigationType } from "react-router-dom";

export function localDestination(value: unknown): string | undefined {
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !/[\\\r\n]/.test(value)
    ? value
    : undefined;
}
export function authNext(search: string) {
  const next = localDestination(new URLSearchParams(search).get("next"));
  return next ? "?next=" + encodeURIComponent(next) : "";
}
type Entry = {
  address: string;
  back?: string;
  windowY: number;
  panelY: number;
};
const Continuity = createContext<string | undefined>(undefined);

// Each history entry remembers its own source. Returning to a detail through an
// edit page must not replace the original list with the editor as its parent.
export function RouteContinuityProvider({ children }: { children: ReactNode }) {
  const loc = useLocation(),
    action = useNavigationType();
  const entries = useRef(new Map<string, Entry>());
  const positions = useRef(new Map<string, Entry>());
  const active = useRef<Entry | undefined>(undefined);
  const key = useRef("");
  const address = loc.pathname + loc.search;
  // Native hash links may retain the previous history.state key. Include the
  // address so prototype anchors and pasted hash URLs are tracked as well.
  const entryKey = loc.key + ":" + address;
  if (key.current !== entryKey) {
    const previous = active.current;
    let entry = entries.current.get(entryKey);
    if (!entry) {
      const samePage = previous?.address.split("?")[0] === loc.pathname;
      const returningFromEdit =
        previous?.address.split("?")[0] === loc.pathname + "/edit";
      const source = localDestination(
        (loc.state as { returnTo?: string } | null)?.returnTo,
      );
      const preserveScroll =
        (loc.state as { preserveScroll?: boolean } | null)?.preserveScroll ===
        true;
      entry = {
        address,
        back:
          source ??
          (returningFromEdit
            ? positions.current.get(previous?.back ?? address)?.back
            : samePage
              ? previous?.back
              : previous?.address),
        windowY: preserveScroll ? window.scrollY : 0,
        panelY: preserveScroll
          ? (document.getElementById("profile-workspace-panel")?.scrollTop ?? 0)
          : 0,
      };
      if (
        action === "POP" ||
        previous?.back === address ||
        (loc.state as { workspaceSwitch?: boolean } | null)?.workspaceSwitch
      ) {
        const saved = positions.current.get(address);
        if (saved) entry = { ...saved, back: saved.back };
      }
      entries.current.set(entryKey, entry);
    }
    key.current = entryKey;
    active.current = entry;
  }
  useLayoutEffect(() => {
    const entry = active.current!;
    let restoring = true;
    const targetWindow = entry.windowY,
      targetPanel = entry.panelY;
    const apply = () => {
      if (!restoring) return;
      window.scrollTo({ top: targetWindow, behavior: "instant" });
      const panel = document.getElementById("profile-workspace-panel");
      panel?.scrollTo({ top: targetPanel, behavior: "instant" });
      if (
        Math.abs(window.scrollY - targetWindow) < 2 &&
        Math.abs((panel?.scrollTop ?? 0) - targetPanel) < 2
      )
        stop();
    };
    const record = () => {
      if (restoring) return;
      entry.windowY = window.scrollY;
      entry.panelY =
        document.getElementById("profile-workspace-panel")?.scrollTop ?? 0;
      positions.current.set(entry.address, { ...entry });
    };
    const stop = () => {
      restoring = false;
      observer.disconnect();
      resize?.disconnect();
    };
    const observer = new MutationObserver(apply);
    const resize =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    resize?.observe(document.body);
    const frame = requestAnimationFrame(apply);
    // A slow list can initially clamp scrolling to zero. Keep the saved target
    // until content can reach it; never replace it with that temporary clamp.
    const timer = window.setTimeout(stop, 10000);
    window.addEventListener("scroll", record, true);
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("touchstart", stop, { passive: true });
    window.addEventListener("keydown", stop);
    window.addEventListener("pointerdown", stop);
    return () => {
      stop();
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      // Last scroll event already captured the old page before React removes it.
      positions.current.set(entry.address, { ...entry });
      window.removeEventListener("scroll", record, true);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("keydown", stop);
      window.removeEventListener("pointerdown", stop);
    };
  }, [entryKey]);
  return (
    <Continuity.Provider value={active.current?.back}>
      {children}
    </Continuity.Provider>
  );
}
export function useReturnTo(fallback: string) {
  const origin = useContext(Continuity);
  return localDestination(origin) ?? fallback;
}
export function NotFound() {
  useLayoutEffect(() => {
    document.title = "页面不存在 · 山软今天吃什么";
  }, []);
  return (
    <section
      className="ew-feature ew-form-panel"
      style={{ margin: "32px auto", maxWidth: 720 }}
    >
      <h1>页面不存在</h1>
      <p>这个地址可能已经失效，请从导航重新进入。</p>
      <Link className="ew-button" to="/">
        回到发现
      </Link>
      <Link className="ew-button light" to="/me">
        返回我的
      </Link>
    </section>
  );
}
