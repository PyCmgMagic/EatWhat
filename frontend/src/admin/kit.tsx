import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import { errorMessage, unavailable } from "../api/client";
import { mediaUrl } from "../api/models";
import { DesignIcon } from "../mobile/ui";

export const Icon = DesignIcon;
export type Tone = "neutral" | "good" | "warn" | "bad" | "info" | "accent";

/* ---------- formatting ---------- */
export const num = (value?: number | null) =>
  value == null ? "—" : value.toLocaleString("zh-CN");
function asDate(value?: string | number | null) {
  if (value == null || value === "") return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}
const pad = (n: number) => String(n).padStart(2, "0");
export function dateTime(value?: string | number | null) {
  const d = asDate(value);
  return d
    ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
    : "—";
}
export function ago(value?: string | number | null) {
  const d = asDate(value);
  if (!d) return "—";
  const minutes = Math.round((Date.now() - d.getTime()) / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} 小时前`;
  if (minutes < 43200) return `${Math.floor(minutes / 1440)} 天前`;
  return dateTime(value).slice(0, 10);
}
/** ISO string ↔ the value a datetime-local input uses (local time). */
export function toLocalInput(value?: string | null) {
  const d = asDate(value);
  return d
    ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    : "";
}
export const fromLocalInput = (value: string) =>
  value ? new Date(value).toISOString() : undefined;

/* ---------- surfaces ---------- */
export function Panel({
  title,
  hint,
  actions,
  children,
  flush = false,
  className = "",
}: {
  title?: ReactNode;
  hint?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  /** Content runs edge to edge (tables and lists). */
  flush?: boolean;
  className?: string;
}) {
  return (
    <section
      className={`ad-panel ${className}`}
      data-flush={flush || undefined}
    >
      {(title || actions) && (
        <header className="ad-panel-head">
          <div>
            {title && <h2>{title}</h2>}
            {hint && <p>{hint}</p>}
          </div>
          {actions && <div className="ad-panel-actions">{actions}</div>}
        </header>
      )}
      <div className="ad-panel-body">{children}</div>
    </section>
  );
}

export function Pill({
  tone = "neutral",
  children,
  dot = true,
}: {
  tone?: Tone;
  children: ReactNode;
  dot?: boolean;
}) {
  return (
    <span className="ad-pill" data-tone={tone}>
      {dot && <i />}
      {children}
    </span>
  );
}

export function Notice({
  tone = "info",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <p className="ad-notice" data-tone={tone}>
      <Icon
        name={tone === "bad" || tone === "warn" ? "warning" : "info"}
        size={17}
      />
      <span>{children}</span>
    </p>
  );
}

type QueryLike = {
  isPending: boolean;
  isError?: boolean;
  error: unknown;
  data?: unknown;
  refetch: () => unknown;
};
/** Loading, failure and empty states for one query, inside a panel. */
export function Async({
  query,
  empty = false,
  emptyTitle = "暂无数据",
  emptyHint,
  rows = 4,
  children,
}: {
  query: QueryLike;
  empty?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
  rows?: number;
  children: ReactNode;
}) {
  if (query.isPending)
    return (
      <div className="ad-skeleton" aria-busy="true" aria-label="正在加载">
        {Array.from({ length: rows }, (_, i) => (
          <span key={i} />
        ))}
      </div>
    );
  if (query.error && query.data === undefined)
    return (
      <div className="ad-state" role="alert">
        <Icon name="wifiOff" size={28} />
        <strong>
          {unavailable(query.error) ? "服务端尚未提供此功能" : "加载失败"}
        </strong>
        <p>
          {unavailable(query.error)
            ? "接口返回未开放，可稍后再试。"
            : errorMessage(query.error)}
        </p>
        <button
          className="ad-btn is-small"
          onClick={() => void query.refetch()}
        >
          重试
        </button>
      </div>
    );
  if (empty)
    return (
      <div className="ad-state" role="status">
        <Icon name="bowl" size={28} />
        <strong>{emptyTitle}</strong>
        {emptyHint && <p>{emptyHint}</p>}
      </div>
    );
  return <>{children}</>;
}

export function Pager({
  page,
  totalPages,
  total,
  hasNext,
  onChange,
}: {
  page: number;
  totalPages?: number | null;
  total?: number | null;
  hasNext?: boolean | null;
  onChange: (page: number) => void;
}) {
  const more = hasNext ?? (totalPages ? page < totalPages : false);
  if (page <= 1 && !more && total == null) return null;
  return (
    <nav className="ad-pager" aria-label="分页">
      <span>
        {total != null && <>共 {num(total)} 条 · </>}第 {page}
        {totalPages ? ` / ${totalPages}` : ""} 页
      </span>
      <div>
        <button
          className="ad-btn is-small"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          上一页
        </button>
        <button
          className="ad-btn is-small"
          disabled={!more}
          onClick={() => onChange(page + 1)}
        >
          下一页
        </button>
      </div>
    </nav>
  );
}

/* ---------- identity ---------- */
export function Avatar({
  src,
  name,
  size = 34,
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
}) {
  const url = mediaUrl(src);
  return (
    <span className="ad-avatar" style={{ width: size, height: size }}>
      {url ? (
        <img src={url} alt="" loading="lazy" />
      ) : (
        Array.from(name || "食")[0]
      )}
    </span>
  );
}
export function Thumb({
  src,
  icon = "bowl",
}: {
  src?: string | null;
  icon?: string;
}) {
  const url = mediaUrl(src);
  const [failed, setFailed] = useState(false);
  return (
    <span className="ad-thumb">
      {url && !failed ? (
        <img src={url} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <Icon name={icon} size={18} />
      )}
    </span>
  );
}

/* ---------- inputs ---------- */
export function Field({
  label,
  hint,
  children,
  wide = false,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className="ad-field" data-wide={wide || undefined}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      className="ad-toggle"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <i />
    </button>
  );
}
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly (readonly [T, ReactNode])[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="ad-segmented" role="radiogroup" aria-label={label}>
      {options.map(([id, text]) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          onClick={() => onChange(id)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/* ---------- overlays ---------- */
function useDialog(onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current,
      previous = document.activeElement as HTMLElement | null,
      root = document.documentElement,
      overflow = root.style.overflow;
    if (dialog && !dialog.open) dialog.showModal?.();
    root.style.overflow = "hidden";
    return () => {
      dialog?.close?.();
      root.style.overflow = overflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return {
    ref,
    onCancel: (e: { preventDefault: () => void }) => {
      e.preventDefault();
      onClose();
    },
    onMouseDown: (e: { target: unknown }) => {
      if (e.target === ref.current) onClose();
    },
  };
}
/** Right-hand sheet for details and editing; keeps the list visible behind. */
export function Drawer({
  title,
  subtitle,
  onClose,
  children,
  footer,
  onSubmit,
  wide = false,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** With onSubmit the drawer body and footer form one <form>. */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  wide?: boolean;
}) {
  const dialog = useDialog(onClose),
    id = useId();
  const content = (
    <>
      <header>
        <div>
          <h2 id={id}>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button
          type="button"
          className="ad-icon-btn"
          aria-label="关闭"
          onClick={onClose}
        >
          <Icon name="close" size={18} />
        </button>
      </header>
      <div className="ad-drawer-body">{children}</div>
      {footer && <footer>{footer}</footer>}
    </>
  );
  return (
    <dialog
      {...dialog}
      className="ad-drawer"
      data-wide={wide || undefined}
      aria-labelledby={id}
    >
      {onSubmit ? (
        <form
          className="ad-drawer-frame"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(e);
          }}
        >
          {content}
        </form>
      ) : (
        <div className="ad-drawer-frame">{content}</div>
      )}
    </dialog>
  );
}
export function Confirm({
  title,
  children,
  confirmLabel = "确认",
  danger = false,
  busy = false,
  askReason,
  onConfirm,
  onClose,
}: {
  title: string;
  children?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  /** Label of an optional reason field passed to onConfirm. */
  askReason?: string;
  onConfirm: (reason?: string) => void;
  onClose: () => void;
}) {
  const dialog = useDialog(onClose),
    id = useId(),
    [reason, setReason] = useState("");
  return (
    <dialog {...dialog} className="ad-confirm" aria-labelledby={id}>
      <div className="ad-confirm-frame">
        <span className="ad-confirm-mark" data-danger={danger || undefined}>
          <Icon name={danger ? "warning" : "question"} size={22} />
        </span>
        <h2 id={id}>{title}</h2>
        {children && <div className="ad-confirm-text">{children}</div>}
        {askReason && (
          <Field label={askReason}>
            <textarea
              rows={3}
              maxLength={200}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
        )}
        <div className="ad-confirm-actions">
          <button className="ad-btn" disabled={busy} onClick={onClose}>
            取消
          </button>
          <button
            className={`ad-btn ${danger ? "is-danger" : "is-primary"}`}
            disabled={busy}
            onClick={() => onConfirm(reason.trim() || undefined)}
          >
            {busy ? "处理中…" : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

/* ---------- data display ---------- */
export function Meta({ items }: { items: [ReactNode, ReactNode][] }) {
  return (
    <dl className="ad-meta">
      {items.map(([term, value], i) => (
        <div key={i}>
          <dt>{term}</dt>
          <dd>{value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
/** Small column chart; values are always printed, so it needs no axis. */
export function Columns({
  data,
  label,
}: {
  data: { label: string; value?: number | null; note?: string }[];
  label: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value ?? 0));
  return (
    <ol className="ad-columns" aria-label={label}>
      {data.map((d, i) => (
        <li key={i} data-last={i === data.length - 1 || undefined}>
          <b>{d.value == null ? "—" : num(d.value)}</b>
          <span
            className="ad-column-bar"
            style={{ height: `${Math.max(3, ((d.value ?? 0) / max) * 100)}%` }}
            data-empty={d.value == null || undefined}
          />
          <small>{d.label}</small>
        </li>
      ))}
    </ol>
  );
}
