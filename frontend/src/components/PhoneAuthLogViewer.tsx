import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { FileText } from "lucide-react";
import { phoneAuthLogs } from "../app/phone-auth-logs";
import { Modal } from "./ui";
import "./phone-auth-logs.css";

function LogDialog({ onClose }: { onClose: () => void }) {
  const entries = useSyncExternalStore(
    phoneAuthLogs.subscribe,
    phoneAuthLogs.getSnapshot,
  );
  const content = useRef<HTMLTextAreaElement>(null);
  const [status, setStatus] = useState("");
  const [copying, setCopying] = useState(false);
  const active = useRef(true);
  const text = JSON.stringify(entries, null, 2);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    setStatus("");
  }, [entries]);

  const copy = async () => {
    setCopying(true);
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(text);
      if (active.current) setStatus("日志已复制");
    } catch {
      if (!active.current) return;
      content.current?.focus();
      content.current?.select();
      setStatus("请长按选中的日志复制");
    } finally {
      if (active.current) setCopying(false);
    }
  };

  return createPortal(
    <Modal
      title="一键登录日志"
      onClose={onClose}
      className="phone-auth-log-dialog"
    >
      {entries.length ? (
        <textarea
          ref={content}
          className="phone-auth-log-content"
          aria-label="一键登录日志内容"
          readOnly
          spellCheck={false}
          value={text}
        />
      ) : (
        <p className="phone-auth-log-empty">暂无日志，尝试一键登录后再查看。</p>
      )}
      <div className="phone-auth-log-actions">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!entries.length || copying}
          onClick={phoneAuthLogs.clear}
        >
          清空日志
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!entries.length || copying}
          onClick={() => void copy()}
        >
          {copying ? "正在复制…" : "复制日志"}
        </button>
      </div>
      {status && (
        <p className="phone-auth-log-status" role="status">
          {status}
        </p>
      )}
    </Modal>,
    document.body,
  );
}

export function PhoneAuthLogViewer() {
  const [open, setOpen] = useState(false);
  return (
    <div className="phone-auth-log-entry">
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <FileText size={15} aria-hidden="true" />
        查看日志
      </button>
      {open && <LogDialog onClose={() => setOpen(false)} />}
    </div>
  );
}
