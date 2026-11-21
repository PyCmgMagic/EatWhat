import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import "./select.css";

type Props = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "multiple" | "size"
> & {
  menuLabel?: string;
  popupClassName?: string;
  compactLabel?: string;
  icon?: ReactNode;
};
type Option = {
  value: string;
  label: string;
  disabled: boolean;
  description?: string;
  color?: string;
  group?: string;
};

/**
 * The mobile shell scales its whole canvas with CSS `zoom` (--mobile-scale).
 * Inside a zoomed subtree every length is multiplied by that zoom — including
 * the offsets of a portalled popup — while getBoundingClientRect already
 * reports viewport pixels. Coordinates measured from the trigger therefore have
 * to be divided by the accumulated zoom to land where the trigger really is.
 */
function zoomScale(node: HTMLElement | null): number {
  let scale = 1;
  for (let el = node; el; el = el.parentElement) {
    const zoom = Number.parseFloat(getComputedStyle(el).zoom);
    if (Number.isFinite(zoom) && zoom > 0 && zoom !== 1) scale *= zoom;
  }
  return scale;
}

function text(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) =>
      isValidElement<{ children?: ReactNode }>(child)
        ? text(child.props.children)
        : String(child),
    )
    .join("");
}

function optionsFrom(
  children: ReactNode,
  group?: string,
  disabled = false,
): Option[] {
  return Children.toArray(children).flatMap((child): Option[] => {
    if (!isValidElement<Record<string, unknown>>(child)) return [];
    const p = child.props;
    if (child.type === "option") {
      if (p.hidden) return [];
      const label = String(p.label ?? text(p.children as ReactNode));
      return [
        {
          value: String(p.value ?? label),
          label,
          disabled: disabled || !!p.disabled,
          description: p["data-description"] as string | undefined,
          color: p["data-color"] as string | undefined,
          group,
        },
      ];
    }
    return optionsFrom(
      p.children as ReactNode,
      child.type === "optgroup" ? String(p.label ?? "") : group,
      disabled || !!p.disabled,
    );
  });
}

/** A styled single select; its native control retains form submission and validation. */
export function Select({
  children,
  id,
  className = "",
  style,
  value,
  defaultValue,
  disabled,
  autoFocus,
  menuLabel,
  popupClassName,
  compactLabel,
  icon,
  ...props
}: Props) {
  const generated = useId(),
    triggerId = id ?? `select-${generated}`;
  const listId = `${triggerId}-options`;
  const options = optionsFrom(children);
  const [local, setLocal] = useState(
    String(defaultValue ?? options.find((o) => !o.disabled)?.value ?? ""),
  );
  const selectedValue = String(value ?? local);
  const selected =
    options.find((o) => o.value === selectedValue) ??
    options.find((o) => !o.disabled) ??
    options[0];
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(-1);
  const [invalid, setInvalid] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({
    visibility: "hidden",
  });
  const native = useRef<HTMLSelectElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null),
    search = useRef({ text: "", time: 0 });
  const host =
    trigger.current?.closest("dialog, [role='dialog']") ?? document.body;

  function show(edge?: "first" | "last") {
    if (disabled) return;
    const selectedIndex = options.findIndex(
      (o) => o.value === selected?.value && !o.disabled,
    );
    setActive(
      edge === "last"
        ? (options
            .map((o, i) => (o.disabled ? -1 : i))
            .filter((i) => i >= 0)
            .at(-1) ?? -1)
        : edge === "first"
          ? options.findIndex((o) => !o.disabled)
          : selectedIndex,
    );
    setPosition({ visibility: "hidden" });
    search.current = { text: "", time: 0 };
    setOpen(true);
  }

  function choose(index: number) {
    const option = options[index];
    if (!native.current || !option || option.disabled) return;
    native.current.value = option.value;
    // Dispatch on the real select so existing React handlers and FormData stay intact.
    native.current.dispatchEvent(new Event("change", { bubbles: true }));
    setInvalid(false);
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const key = event.key;
    if (key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    } else if (key === "Tab") {
      setOpen(false);
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(key)) {
      event.preventDefault();
      if (!open)
        return show(
          key === "Home" ? "first" : key === "End" ? "last" : undefined,
        );
      const available = options
        .map((o, i) => (o.disabled ? -1 : i))
        .filter((i) => i >= 0);
      const index = available.indexOf(active);
      setActive(
        key === "Home"
          ? available[0]
          : key === "End"
            ? available.at(-1)!
            : available[
                Math.max(
                  0,
                  Math.min(
                    available.length - 1,
                    index + (key === "ArrowDown" ? 1 : -1),
                  ),
                )
              ],
      );
    } else if (open && (key === "Enter" || key === " ")) {
      event.preventDefault();
      choose(active);
    } else if (
      key.length === 1 &&
      key !== " " &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      if (!open) show();
      const now = Date.now();
      search.current.text =
        now - search.current.time < 700 ? search.current.text + key : key;
      search.current.time = now;
      const query = search.current.text.toLocaleLowerCase();
      const index = options.findIndex(
        (o) => !o.disabled && o.label.toLocaleLowerCase().startsWith(query),
      );
      if (index >= 0) setActive(index);
    }
  }

  useEffect(() => {
    const control = native.current,
      form = control?.form;
    const reset = () => {
      setOpen(false);
      setInvalid(false);
      setLocal(
        String(
          defaultValue ??
            optionsFrom(children).find((o) => !o.disabled)?.value ??
            "",
        ),
      );
    };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [defaultValue, children]);

  useLayoutEffect(() => {
    if (value === undefined && native.current) setLocal(native.current.value);
  }, [value, children]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useLayoutEffect(() => {
    if (!open || !popup.current || !trigger.current) return;
    const panel = popup.current,
      button = trigger.current;
    // The top layer avoids clipping by scroll containers and transformed pages.
    if (typeof panel.showPopover === "function" && panel.isConnected) {
      try {
        panel.showPopover();
      } catch {
        // Already open or detached mid-update: keep the inline panel instead of crashing.
      }
    }
    const update = () => {
      const rect = button.getBoundingClientRect(),
        viewport = window.visualViewport;
      const width = viewport?.width ?? window.innerWidth,
        height = viewport?.height ?? window.innerHeight;
      const offsetX = viewport?.offsetLeft ?? 0,
        offsetY = viewport?.offsetTop ?? 0;
      if (rect.bottom < offsetY || rect.top > height + offsetY) {
        setOpen(false);
        return;
      }
      // Keep the panel glued to the trigger inside a zoomed canvas: the rect is
      // in viewport pixels, the popup's own lengths are zoom-multiplied.
      const scale = zoomScale(panel);
      const popupWidth = Math.min(
        Math.max(rect.width, 216 * scale),
        width - 24,
      );
      const below = height + offsetY - rect.bottom - 18,
        above = rect.top - offsetY - 18;
      const needed = Math.min(panel.scrollHeight * scale, 300);
      const flip = below < needed && above > below;
      const maxHeight = Math.max(60, Math.min(344, flip ? above : below));
      setPosition({
        width: popupWidth / scale,
        maxHeight: maxHeight / scale,
        left:
          Math.max(
            offsetX + 12,
            Math.min(rect.left, offsetX + width - popupWidth - 12),
          ) / scale,
        top:
          (flip
            ? Math.max(offsetY + 12, rect.top - Math.min(needed, maxHeight) - 8)
            : rect.bottom + 8) / scale,
        transformOrigin: flip ? "bottom left" : "top left",
      });
    };
    update();
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    observer?.observe(button);
    const scroll = (event: Event) => {
      if (!panel.contains(event.target as Node)) update();
    };
    const outside = (event: PointerEvent) => {
      if (
        !panel.contains(event.target as Node) &&
        !button.contains(event.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", outside, true);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      observer?.disconnect();
      document.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      if (
        typeof panel.hidePopover === "function" &&
        panel.matches(":popover-open")
      )
        panel.hidePopover();
    };
  }, [open, children]);

  useEffect(() => {
    if (open && active >= 0)
      popup.current
        ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
        ?.scrollIntoView?.({ block: "nearest" });
  }, [active, open]);

  return (
    <span className="ew-select" data-open={open || undefined}>
      <button
        ref={trigger}
        id={triggerId}
        type="button"
        className={`ew-select-trigger ${className}`}
        style={style}
        disabled={disabled}
        autoFocus={autoFocus}
        role="combobox"
        aria-label={props["aria-label"]}
        aria-labelledby={props["aria-labelledby"]}
        aria-describedby={props["aria-describedby"]}
        aria-required={props.required || undefined}
        aria-invalid={invalid || props["aria-invalid"] || undefined}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-haspopup="listbox"
        aria-activedescendant={
          open && active >= 0 ? `${listId}-${active}` : undefined
        }
        onKeyDown={onKeyDown}
        onBlur={(event) => {
          if (!popup.current?.contains(event.relatedTarget)) setOpen(false);
        }}
        onClick={() => (open ? setOpen(false) : show())}
      >
        {icon && (
          <span className="ew-select-icon" aria-hidden="true">
            {icon}
          </span>
        )}
        <span className="ew-select-value">
          {selected?.color && (
            <i
              className="ew-select-swatch"
              style={{ background: selected.color }}
            />
          )}
          <span className="ew-select-label">{selected?.label ?? "请选择"}</span>
          {compactLabel && (
            <span className="ew-select-compact-label">{compactLabel}</span>
          )}
        </span>
        <ChevronDown
          className="ew-select-chevron"
          aria-hidden="true"
          size={16}
        />
      </button>
      <select
        {...props}
        ref={native}
        id={`${triggerId}-native`}
        className="ew-select-native"
        aria-hidden="true"
        tabIndex={-1}
        value={value}
        defaultValue={defaultValue}
        disabled={disabled}
        onChange={(event) => {
          setLocal(event.target.value);
          setInvalid(false);
          props.onChange?.(event);
        }}
        onInvalid={(event) => {
          event.preventDefault();
          setInvalid(true);
          trigger.current?.focus();
          props.onInvalid?.(event);
        }}
      >
        {children}
      </select>
      {open &&
        createPortal(
          <div
            ref={popup}
            popover="manual"
            className={
              popupClassName
                ? `ew-select-popup ${popupClassName}`
                : "ew-select-popup"
            }
            style={position}
            onMouseDown={(event) => event.preventDefault()}
          >
            {menuLabel && <div className="ew-select-caption">{menuLabel}</div>}
            <div
              id={listId}
              role="listbox"
              aria-label={menuLabel ?? props["aria-label"]}
              aria-labelledby={
                !menuLabel && !props["aria-label"] ? triggerId : undefined
              }
            >
              {options.map((option, index) => (
                <div key={`${option.value}-${index}`}>
                  {option.group &&
                    option.group !== options[index - 1]?.group && (
                      <div className="ew-select-caption">{option.group}</div>
                    )}
                  <div
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={option.value === selected?.value}
                    aria-disabled={option.disabled || undefined}
                    className="ew-select-option"
                    data-active={active === index || undefined}
                    data-index={index}
                    onPointerMove={(event) => {
                      if (event.pointerType === "mouse" && !option.disabled)
                        setActive(index);
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      choose(index);
                    }}
                  >
                    {option.color && (
                      <i
                        className="ew-select-swatch"
                        style={{ background: option.color }}
                      />
                    )}
                    <span className="ew-select-option-copy">
                      <span>{option.label}</span>
                      {option.description && (
                        <small>{option.description}</small>
                      )}
                    </span>
                    {option.value === selected?.value && (
                      <Check
                        className="ew-select-check"
                        size={16}
                        strokeWidth={2.4}
                        aria-hidden="true"
                      />
                    )}
                  </div>
                </div>
              ))}
              {!options.length && (
                <div className="ew-select-caption">暂无可选项</div>
              )}
            </div>
          </div>,
          host,
        )}
    </span>
  );
}
