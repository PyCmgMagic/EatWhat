import type { ReactNode } from "react";
import "./marker-tabs.css";

export function MarkerTabs<Key extends string>({
  items,
  value,
  onChange,
  panelId,
  label,
  className = "",
}: {
  items: readonly { id: Key; name: ReactNode; icon: ReactNode }[];
  value: Key;
  onChange: (key: Key) => void;
  panelId: string;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={`marker-tabs ${className}`}
      onKeyDown={(event) => {
        const tabs = Array.from(
          event.currentTarget.querySelectorAll<HTMLButtonElement>(
            '[role="tab"]',
          ),
        );
        const index = tabs.indexOf(event.target as HTMLButtonElement);
        if (index < 0) return;
        const next = {
          ArrowLeft: (index + tabs.length - 1) % tabs.length,
          ArrowRight: (index + 1) % tabs.length,
          Home: 0,
          End: tabs.length - 1,
        }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        tabs[next].focus({ preventScroll: true });
        onChange(items[next].id);
      }}
    >
      {items.map(({ id, name, icon }) => (
        <button
          key={id}
          type="button"
          role="tab"
          id={panelId + id}
          aria-controls={panelId}
          aria-selected={id === value}
          tabIndex={id === value ? 0 : -1}
          onClick={() => onChange(id)}
        >
          <span>
            {icon}
            {name}
          </span>
        </button>
      ))}
    </div>
  );
}
