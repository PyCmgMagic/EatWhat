import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Check, CircleAlert, Info, X } from "lucide-react";
import { motion } from "../motion/runtime";
import "./toast.css";

export type ToastOptions = { tone?: "info" | "success" | "error" };
export type Toast = {
  id: number;
  message: string;
  tone: NonNullable<ToastOptions["tone"]>;
};

export function useToasts() {
  const [items, setItems] = useState<Toast[]>([]);
  const sequence = useRef(0);
  const last = useRef({ message: "", time: -Infinity });
  const toast = useCallback((message: string, options: ToastOptions = {}) => {
    const text = message.trim();
    if (!text) return;
    // One action can be observed by both its controller and a shared error view.
    const now = Date.now();
    if (last.current.message === text && now - last.current.time < 400) return;
    last.current = { message: text, time: now };
    const item: Toast = {
      id: ++sequence.current,
      message: text,
      tone: options.tone ?? "info",
    };
    setItems((previous) =>
      [...previous.filter((value) => value.message !== text), item].slice(-4),
    );
  }, []);
  const dismiss = useCallback((id: number) => {
    setItems((previous) => previous.filter((item) => item.id !== id));
    last.current = { message: "", time: -Infinity };
  }, []);
  return { items, toast, dismiss };
}

function ToastItem({
  item,
  dismiss,
}: {
  item: Toast;
  dismiss: (id: number) => void;
}) {
  const [paused, setPaused] = useState(false);
  const [closing, setClosing] = useState(false);
  const lifetime =
    item.tone === "error"
      ? 8000
      : Math.min(
          5000,
          Math.max(
            item.tone === "success" ? 2000 : 3000,
            [...item.message].length * 80,
          ),
        );
  useEffect(() => {
    if (paused || closing) return;
    const timer = setTimeout(() => setClosing(true), lifetime);
    return () => clearTimeout(timer);
  }, [item.id, lifetime, paused, closing]);
  useEffect(() => {
    if (!closing) return;
    const preference = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const finish = () => dismiss(item.id);
    if (preference?.matches) {
      finish();
      return;
    }
    const timer = window.setTimeout(finish, motion.exit);
    const changed = () => {
      if (preference?.matches) finish();
    };
    preference?.addEventListener("change", changed);
    return () => {
      clearTimeout(timer);
      preference?.removeEventListener("change", changed);
    };
  }, [closing, item.id, dismiss]);
  const Icon =
    item.tone === "error"
      ? CircleAlert
      : item.tone === "success"
        ? Check
        : Info;
  return (
    <div
      className="toast visible app-toast"
      data-tone={item.tone}
      data-exiting={closing ? "true" : undefined}
      inert={closing}
      role={item.tone === "error" ? "alert" : "status"}
      aria-atomic="true"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setPaused(false);
      }}
    >
      <Icon
        className="app-toast-icon"
        size={20}
        strokeWidth={1.8}
        aria-hidden="true"
      />
      <span>{item.message}</span>
      <button
        type="button"
        onClick={(event) => {
          if (event.detail === 0) dismiss(item.id);
          else setClosing(true);
        }}
        aria-label="关闭提示"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

export function ToastViewport({
  items,
  dismiss,
}: {
  items: Toast[];
  dismiss: (id: number) => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [container, setContainer] = useState<HTMLElement>(document.body);
  useLayoutEffect(() => {
    const update = () => {
      const dialogs = Array.from(
        document.querySelectorAll<HTMLDialogElement>("dialog[open]"),
      );
      setContainer(dialogs.at(-1) ?? document.body);
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["open"],
    });
    return () => observer.disconnect();
  }, []);
  const latest = items.at(-1)?.id;
  // A dialog can leave the document in the same commit that adds a toast
  // (e.g. confirming a crop); the observer only catches up afterwards, so
  // never render into a detached host.
  const host = container.isConnected ? container : document.body;
  useLayoutEffect(() => {
    const node = viewport.current;
    if (!node || typeof node.showPopover !== "function" || !node.isConnected)
      return;
    // A manual popover shares the browser top layer with native dialogs, so
    // feedback stays visible inside login, cropping and confirmation dialogs.
    try {
      if (node.matches(":popover-open")) node.hidePopover();
      if (latest !== undefined) node.showPopover();
    } catch {
      // Feedback must never take the page down; the toast still renders inline.
    }
  }, [latest, host]);
  return createPortal(
    <div
      ref={viewport}
      className="app-toast-viewport"
      popover="manual"
      aria-label="操作提示"
    >
      {items.map((item) => (
        <ToastItem key={item.id} item={item} dismiss={dismiss} />
      ))}
    </div>,
    host,
  );
}
