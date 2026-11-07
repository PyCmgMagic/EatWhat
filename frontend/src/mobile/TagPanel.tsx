import { useRef } from "react";
import { Check, LockKeyhole, X } from "lucide-react";
import SheetHandle from "./SheetHandle";
import "./tag-panel.css";

export type TagChoice = {
  name: string;
  selected: boolean;
  toggle: () => void;
};
type Source = {
  pending: boolean;
  error?: string;
  retry: () => void;
};
export default function TagPanel({
  draft,
  system,
  personal,
  systemSource,
  personalSource,
  value,
  onChange,
  onAdd,
  onDone,
  onClose,
  busy,
  error,
  status,
}: {
  draft: boolean;
  system: TagChoice[];
  personal: TagChoice[];
  systemSource: Source;
  personalSource: Source;
  value: string;
  onChange: (value: string) => void;
  onAdd: () => Promise<boolean>;
  onDone: () => void;
  onClose: () => void;
  busy: boolean;
  error: string;
  status: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const count = [...system, ...personal].filter((t) => t.selected).length;
  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label="加标签"
      className="mobile-tag-panel"
    >
      <SheetHandle
        label="标签面板"
        mode="dismiss"
        disabled={busy}
        onDismiss={onClose}
      />
      <header>
        <h1>添加标签</h1>
        <button
          type="button"
          aria-label="关闭标签面板"
          disabled={busy}
          onClick={onClose}
        >
          <X size={22} />
        </button>
      </header>
      <div className="mobile-tag-panel-body">
        <fieldset>
          <legend>
            口味标签 <small>公开 · 可以多选</small>
          </legend>
          <div className="mobile-tag-choices">
            {system.map((t) => (
              <button
                key={t.name}
                type="button"
                aria-pressed={t.selected}
                disabled={busy}
                onClick={t.toggle}
              >
                {t.selected && <Check size={14} />}
                {t.name}
              </button>
            ))}
          </div>
          {systemSource.pending ? (
            <p role="status">正在读取口味标签…</p>
          ) : systemSource.error ? (
            <p role="alert">
              口味标签暂时无法读取。
              <button type="button" onClick={systemSource.retry}>
                重试
              </button>
            </p>
          ) : (
            !system.length && <p>暂无口味标签，可以在下方添加自己的标签。</p>
          )}
        </fieldset>
        <fieldset>
          <legend>
            <LockKeyhole size={15} /> 我的标签 <small>仅自己可见</small>
          </legend>
          <div className="mobile-tag-choices personal">
            {personal.map((t) => (
              <button
                key={t.name}
                type="button"
                aria-pressed={t.selected}
                disabled={busy}
                onClick={t.toggle}
              >
                {t.selected && <Check size={14} />}
                {t.name}
              </button>
            ))}
          </div>
          {personalSource.pending && <p role="status">正在读取已有标签…</p>}
          {personalSource.error && (
            <p role="alert">
              已有标签暂时无法读取，仍可填写新标签。
              <button type="button" onClick={personalSource.retry}>
                重试
              </button>
            </p>
          )}
          <form
            className="mobile-tag-entry"
            onSubmit={async (event) => {
              event.preventDefault();
              if (await onAdd()) input.current?.focus({ preventScroll: true });
            }}
          >
            <label htmlFor="mobile-custom-tag">写一个新标签</label>
            <div>
              <input
                ref={input}
                id="mobile-custom-tag"
                aria-label="写一个我的标签"
                value={value}
                disabled={busy}
                placeholder="例如：想再吃"
                autoComplete="off"
                enterKeyHint="done"
                aria-describedby="mobile-tag-limit"
                aria-invalid={!!error}
                onChange={(event) => onChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && event.nativeEvent.isComposing)
                    event.preventDefault();
                }}
              />
              <button type="submit" disabled={busy || !value.trim()}>
                添加
              </button>
            </div>
            <small id="mobile-tag-limit">
              每个最多 10 个字 <span>{[...value.trim()].length} / 10</span>
            </small>
          </form>
          {error && (
            <p className="mobile-tag-error" role="alert">
              {error}
            </p>
          )}
          <p className="mobile-tag-status" role="status">
            {status || "点亮标签即可选中，再点一次移除。"}
          </p>
        </fieldset>
      </div>
      <footer>
        <button type="button" disabled={busy} onClick={onDone}>
          {busy ? "正在保存…" : `完成${count ? `（已选 ${count} 个）` : ""}`}
        </button>
        <p>{draft ? "标签将在发布菜品时一并保存" : "已选标签会保存到这道菜"}</p>
      </footer>
    </section>
  );
}
