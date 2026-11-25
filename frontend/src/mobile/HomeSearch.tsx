import { useLayoutEffect, useRef, useState, type Ref } from "react";
import {
  readRecentSearches,
  recentSearchId,
  rememberSearch,
  searchSuggestions,
  writeRecentSearches,
  type RecentSearch,
  type SearchKind,
} from "../app/search";
import { DesignIcon } from "./ui";
import "./home-search.css";
import { AnimatedSurface } from "../components/AnchoredPopover";
import { openModalLayer } from "../components/modal-layer";

/** Toolbar entry that opens the home search surface. */
export function HomeSearchButton({
  ref,
  open,
  onOpen,
}: {
  ref?: Ref<HTMLButtonElement>;
  open: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      ref={ref}
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
  returnFocus = null,
  onClose,
  onSearch,
}: {
  open: boolean;
  returnFocus?: HTMLButtonElement | null;
  onClose: () => void;
  onSearch: (entry: RecentSearch) => void;
}) {
  const [retained, setRetained] = useState(open);
  useLayoutEffect(() => {
    if (open) setRetained(true);
  }, [open]);
  if (!open && !retained) return null;
  return (
    <SearchSurface
      exiting={!open}
      returnFocus={returnFocus}
      onClose={onClose}
      onExited={() => setRetained(false)}
      onSearch={onSearch}
    />
  );
}

function SearchSurface({
  exiting,
  returnFocus,
  onClose,
  onExited,
  onSearch,
}: {
  exiting: boolean;
  returnFocus: HTMLButtonElement | null;
  onClose: () => void;
  onExited: () => void;
  onSearch: (entry: RecentSearch) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const position = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const composing = useRef(false);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState(readRecentSearches);
  const [layerOpen, setLayerOpen] = useState(false);

  useLayoutEffect(() => {
    if (!dialog.current) return;
    const closeLayer = openModalLayer(dialog.current, returnFocus);
    setLayerOpen(true);
    return closeLayer;
  }, [returnFocus]);

  useLayoutEffect(() => {
    if (layerOpen && !exiting) input.current?.focus({ preventScroll: true });
  }, [layerOpen, exiting]);

  function origin() {
    const box = position.current;
    const source = returnFocus?.getBoundingClientRect();
    const target = box?.getBoundingClientRect();
    if (
      !box ||
      !source?.width ||
      !source.height ||
      !target?.width ||
      !target.height
    )
      return;
    const zoom = target.width / (box.offsetWidth || target.width);
    return {
      x: (source.left - target.left) / zoom,
      y: (source.top - target.top) / zoom,
      sx: Math.max(0.05, source.width / target.width),
      sy: Math.max(0.05, source.height / target.height),
    };
  }

  const typed = query.trim();
  const matches = (text: string) =>
    text.toLowerCase().includes(typed.toLowerCase());
  const histories = typed
    ? recent.filter((entry) => matches(entry.query))
    : recent;
  const guesses = typed ? searchSuggestions.filter(matches) : searchSuggestions;

  function submit(keyword: string, kind: SearchKind = "food") {
    const value = keyword.trim();
    if (!value || exiting) return;
    const entry = { query: value, kind };
    rememberSearch(entry, recent);
    onClose();
    onSearch(entry);
  }

  function dropHistory(entry: RecentSearch) {
    const id = recentSearchId(entry);
    const next = readRecentSearches(recent).filter(
      (item) => recentSearchId(item) !== id,
    );
    setRecent(next);
    writeRecentSearches(next);
    input.current?.focus({ preventScroll: true });
  }

  function clearHistory() {
    setRecent([]);
    writeRecentSearches([]);
    input.current?.focus({ preventScroll: true });
  }

  return (
    <dialog
      ref={dialog}
      className="ew-home-search"
      aria-label="搜索"
      data-exiting={exiting ? "" : undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (!exiting) onClose();
      }}
      onClick={(event) => {
        if (!exiting && event.target === event.currentTarget) onClose();
      }}
    >
      <div className="ew-home-search-position" ref={position}>
        {layerOpen && (
          <AnimatedSurface
            open={!exiting}
            duration={180}
            closeDuration={100}
            onExited={onExited}
            padding={0}
            chrome={false}
            origin={origin}
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
              <button
                type="button"
                className="ew-home-search-close"
                aria-label="关闭搜索"
                onClick={onClose}
              >
                <DesignIcon name="close" size={20} />
              </button>
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
                    <div
                      key={recentSearchId(entry)}
                      className="ew-home-search-entry"
                    >
                      <button
                        type="button"
                        className="ew-home-search-row"
                        onClick={() => submit(entry.query, entry.kind)}
                      >
                        <DesignIcon name="history" size={18} />
                        <span>{entry.query}</span>
                        <small>{entry.kind === "shop" ? "店铺" : "菜品"}</small>
                      </button>
                      <button
                        type="button"
                        className="ew-home-search-remove"
                        aria-label={`删除${entry.kind === "shop" ? "店铺" : "菜品"}搜索记录“${entry.query}”`}
                        onClick={() => dropHistory(entry)}
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
        )}
      </div>
    </dialog>
  );
}
