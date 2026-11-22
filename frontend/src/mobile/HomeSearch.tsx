import { useEffect, useRef, useState } from "react";
import { useExitPresence } from "../motion/hooks";
import { DesignIcon } from "./ui";
import "./home-search.css";
import { AnimatedSurface } from "../components/AnchoredPopover";

/** Shared with the desktop header search (`features/DesktopSearch.tsx`). */
const recentKey = "eatwhat-recent-searches-v1";
/** The editorial list the desktop search offers before anything is typed. */
const suggestions = ["云吞", "麻辣香锅", "杨枝甘露"];

type RecentEntry = { query: string; kind: "food" | "shop" };

function readRecent(): RecentEntry[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(recentKey) ?? "[]");
    if (!Array.isArray(stored)) return [];
    const seen = new Set<string>();
    const entries: RecentEntry[] = [];
    for (const entry of stored) {
      const query =
        entry && typeof entry.query === "string" ? entry.query.trim() : "";
      if (!query || seen.has(query)) continue;
      seen.add(query);
      entries.push({ query, kind: entry.kind === "shop" ? "shop" : "food" });
      if (entries.length === 5) break;
    }
    return entries;
  } catch {
    return [];
  }
}

function writeRecent(entries: RecentEntry[]) {
  try {
    window.localStorage.setItem(recentKey, JSON.stringify(entries));
  } catch {
    // Blocked storage only costs the history, never the search itself.
  }
}

function remember(keyword: string) {
  const kept = readRecent().filter((entry) => entry.query !== keyword);
  const next: RecentEntry[] = [{ query: keyword, kind: "food" }, ...kept];
  writeRecent(next.slice(0, 5));
}

/** Toolbar entry that opens the home search surface. */
export function HomeSearchButton({
  open,
  onOpen,
}: {
  open: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className="ew-home-search-button"
      aria-label="搜索菜品或店名"
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={onOpen}
    >
      <DesignIcon name="search" size={22} />
      <span className="mobile-home-action-label" aria-hidden="true">
        搜索
      </span>
    </button>
  );
}

/**
 * The fixed search surface opens below the toolbar without shifting the hero.
 */
export function HomeSearchOverlay({
  open,
  onClose,
  onSearch,
}: {
  open: boolean;
  onClose: () => void;
  onSearch: (keyword: string) => void;
}) {
  const presence = useExitPresence(open ? "search" : null);
  if (presence.value === null) return null;
  return (
    <SearchSurface
      exiting={presence.exiting}
      onClose={onClose}
      onSearch={onSearch}
    />
  );
}

function SearchSurface({
  exiting,
  onClose,
  onSearch,
}: {
  exiting: boolean;
  onClose: () => void;
  onSearch: (keyword: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const composing = useRef(false);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState(readRecent);

  useEffect(() => {
    const frame = requestAnimationFrame(() => input.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);

  const typed = query.trim();
  const matches = (text: string) =>
    text.toLowerCase().includes(typed.toLowerCase());
  const histories = typed
    ? recent.filter((entry) => matches(entry.query))
    : recent;
  const guesses = typed ? suggestions.filter(matches) : suggestions;

  function submit(keyword: string) {
    const value = keyword.trim();
    if (!value) return;
    remember(value);
    onClose();
    onSearch(value);
  }

  function dropHistory(keyword: string) {
    setRecent((current) => {
      const next = current.filter((entry) => entry.query !== keyword);
      writeRecent(next);
      return next;
    });
  }

  function clearHistory() {
    setRecent([]);
    try {
      window.localStorage.removeItem(recentKey);
    } catch {
      // Nothing to clear when storage is unavailable.
    }
  }

  return (
    <div
      className="ew-home-search"
      role="dialog"
      aria-modal="true"
      aria-label="搜索"
      data-exiting={exiting ? "" : undefined}
      inert={exiting || undefined}
    >
      <button
        type="button"
        className="ew-home-search-scrim"
        aria-label="关闭搜索"
        onClick={onClose}
      />
      <AnimatedSurface
        open={!exiting}
        duration={180}
        closeDuration={100}
        padding={0}
        chrome={false}
        className="ew-home-search-layer"
      >
        <form
          className="search-field ew-home-search-bar"
          role="search"
          aria-label="搜索菜品或店名"
          onSubmit={(event) => {
            event.preventDefault();
            if (!composing.current) submit(query);
          }}
        >
          <DesignIcon name="search" size={20} />
          <input
            ref={input}
            type="search"
            name="q"
            aria-label="搜索菜品或店名"
            placeholder="搜菜名或店名"
            value={query}
            maxLength={64}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="search"
            onChange={(event) => setQuery(event.target.value)}
            onCompositionStart={() => {
              composing.current = true;
            }}
            onCompositionEnd={() => {
              composing.current = false;
            }}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                (event.nativeEvent.isComposing || event.keyCode === 229)
              )
                event.preventDefault();
            }}
          />
          {query && (
            <button
              type="button"
              className="search-field-clear"
              aria-label="清空搜索关键词"
              onClick={() => {
                setQuery("");
                input.current?.focus();
              }}
            >
              <DesignIcon name="close" size={17} />
            </button>
          )}
          <button type="submit" className="search-field-submit">
            搜索
          </button>
        </form>
        <div className="ew-home-search-panel">
          {histories.length > 0 && (
            <section aria-label="最近搜索">
              <div className="ew-home-search-head">
                <p className="ew-home-search-caption">最近搜索</p>
                <button
                  type="button"
                  className="ew-home-search-clear"
                  onClick={clearHistory}
                >
                  清空
                </button>
              </div>
              {histories.map((entry) => (
                <div key={entry.query} className="ew-home-search-entry">
                  <button
                    type="button"
                    className="ew-home-search-row"
                    onClick={() => submit(entry.query)}
                  >
                    <DesignIcon name="history" size={18} />
                    <span>{entry.query}</span>
                  </button>
                  <button
                    type="button"
                    className="ew-home-search-remove"
                    aria-label={`删除搜索记录“${entry.query}”`}
                    onClick={() => dropHistory(entry.query)}
                  >
                    <DesignIcon name="close" size={15} />
                  </button>
                </div>
              ))}
            </section>
          )}
          {guesses.length > 0 && (
            <section aria-label="猜你想搜">
              <p className="ew-home-search-caption">猜你想搜</p>
              {guesses.map((text) => (
                <button
                  key={text}
                  type="button"
                  className="ew-home-search-row"
                  onClick={() => submit(text)}
                >
                  <DesignIcon name="hot" size={18} />
                  <span>{text}</span>
                </button>
              ))}
            </section>
          )}
          {typed && (
            <button
              type="button"
              className="ew-home-search-row is-query"
              onClick={() => submit(typed)}
            >
              <DesignIcon name="search" size={18} />
              <span>搜索“{typed}”</span>
            </button>
          )}
        </div>
      </AnimatedSurface>
    </div>
  );
}
