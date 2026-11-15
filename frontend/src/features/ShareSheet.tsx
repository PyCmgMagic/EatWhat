import { useEffect, useId, useRef, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { Link, X } from "lucide-react";
import { useSurfaceDismiss } from "../motion/hooks";
import SheetHandle from "../mobile/SheetHandle";
import { DesignIcon } from "../mobile/ui";
import "./share-sheet.css";

export function ShareSheet({
  title,
  url,
  busy,
  manual,
  onClose,
  onShare,
  onCopy,
}: {
  title: string;
  url: string;
  busy: boolean;
  manual: boolean;
  onClose: () => void;
  onShare: () => void;
  onCopy: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const subjectId = useId();
  const dismiss = useSurfaceDismiss(dialog, onClose);
  const backdropPointer = useRef(false);

  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement as HTMLElement | null;
    const root = document.documentElement;
    const overflow = root.style.overflow;
    element.showModal();
    root.style.overflow = "hidden";
    return () => {
      element.close();
      root.style.overflow = overflow;
      if (previousFocus?.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    if (manual && !busy) {
      input.current?.focus();
      input.current?.select();
    }
  }, [manual, busy]);

  function outside(event: PointerEvent<HTMLDialogElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    );
  }

  return createPortal(
    <dialog
      ref={dialog}
      className="share-sheet"
      aria-labelledby={titleId}
      aria-describedby={subjectId}
      aria-modal="true"
      aria-busy={busy}
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
      onPointerDown={(event) => {
        backdropPointer.current =
          event.target === event.currentTarget && outside(event);
      }}
      onPointerUp={(event) => {
        if (backdropPointer.current && outside(event)) dismiss();
        backdropPointer.current = false;
      }}
    >
      <SheetHandle mode="dismiss" label="分享选项" onDismiss={onClose} />
      <header className="share-sheet-heading">
        <h2 id={titleId}>分享</h2>
        <button type="button" aria-label="关闭分享" onClick={dismiss}>
          <X aria-hidden="true" size={24} strokeWidth={1.8} />
        </button>
      </header>
      <p id={subjectId} className="share-sheet-subject">
        {title}
      </p>
      <div className="share-sheet-actions">
        <button type="button" disabled={busy} onClick={onShare}>
          <span aria-hidden="true">
            <DesignIcon name="share" size={26} />
          </span>
          分享给朋友
        </button>
        <button type="button" disabled={busy} onClick={onCopy}>
          <span aria-hidden="true">
            <Link size={24} strokeWidth={1.8} />
          </span>
          复制链接
        </button>
      </div>
      {manual && (
        <label className="share-sheet-manual">
          请长按链接复制
          <input
            ref={input}
            aria-label="分享链接"
            readOnly
            value={url}
            onFocus={(event) => event.currentTarget.select()}
          />
        </label>
      )}
    </dialog>,
    document.body,
  );
}
