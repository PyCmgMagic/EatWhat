import { useEffect, useId, useRef, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { useSurfaceDismiss } from "../motion/hooks";
import SheetHandle from "./SheetHandle";
import { DesignIcon } from "./ui";
import "./avatar-source-sheet.css";

export default function AvatarSourceSheet({
  busy,
  onPick,
  onClose,
}: {
  busy: boolean;
  onPick: (source: "camera" | "library") => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const dismiss = useSurfaceDismiss(dialog, onClose);
  const backdropPointer = useRef(false);

  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (previousFocus?.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, []);

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
      className="mobile-avatar-sheet"
      aria-labelledby={titleId}
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) dismiss();
      }}
      onPointerDown={(event) => {
        backdropPointer.current =
          event.target === event.currentTarget && outside(event);
      }}
      onPointerUp={(event) => {
        if (!busy && backdropPointer.current && outside(event)) dismiss();
        backdropPointer.current = false;
      }}
    >
      <SheetHandle
        mode="dismiss"
        label="头像选项"
        disabled={busy}
        onDismiss={onClose}
      />
      <header className="mobile-avatar-sheet-heading">
        <h2 id={titleId}>更换头像</h2>
        <button
          type="button"
          aria-label="关闭头像选项"
          disabled={busy}
          onClick={dismiss}
        >
          <DesignIcon name="close" size={20} />
        </button>
      </header>
      <button
        type="button"
        className="mobile-avatar-source"
        disabled={busy}
        onClick={() => onPick("camera")}
      >
        <DesignIcon name="camera" size={22} />
        拍一张
      </button>
      <button
        type="button"
        className="mobile-avatar-source"
        disabled={busy}
        onClick={() => onPick("library")}
      >
        <DesignIcon name="image" size={22} />
        从相册选
      </button>
      <p>{busy ? "正在上传头像…" : "JPG、PNG 或 WebP，最大 10 MB"}</p>
    </dialog>,
    document.body,
  );
}
