import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { DesignIcon as Icon } from "../mobile/ui";
import "./desktop-search.css";
import { AnimatedSurface } from "../components/AnchoredPopover";
import { instantMotion, trackMotion } from "../motion/runtime";
import {
  readRecentSearches,
  recentSearchId,
  rememberSearch,
  searchResultPath,
  searchSuggestions,
  writeRecentSearches,
  type RecentSearch,
  type SearchKind,
} from "../app/search";

export default function DesktopSearch() {
  const navigate = useNavigate(),
    location = useLocation(),
    root = useRef<HTMLDivElement>(null),
    form = useRef<HTMLFormElement>(null),
    compact = useRef<HTMLButtonElement>(null),
    input = useRef<HTMLInputElement>(null),
    origin = useRef<DOMRect | null>(null),
    home = useRef<DOMRect | null>(null),
    returnAnimation = useRef<Animation | null>(null),
    panelId = useId();
  const [query, setQuery] = useState(""),
    [kind, setKind] = useState<SearchKind>("food"),
    [open, setOpen] = useState(false),
    [closing, setClosing] = useState(false),
    [recent, setRecent] = useState<RecentSearch[]>(readRecentSearches);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setQuery(params.get("q") ?? "");
    setKind(params.get("type") === "shop" ? "shop" : "food");
    returnAnimation.current?.cancel();
    setClosing(false);
    setOpen(false);
  }, [location.pathname, location.search]);
  useEffect(() => {
    const close = (event: PointerEvent) => {
        if (open && !root.current?.contains(event.target as Node))
          closeSearch();
      },
      escape = (event: KeyboardEvent) => {
        if (event.key === "Escape" && open) closeSearch();
      };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open, closing]);
  useEffect(
    () => () => {
      returnAnimation.current?.cancel();
    },
    [],
  );
  useLayoutEffect(() => {
    const element = form.current,
      previous = origin.current;
    if (
      !open ||
      !element ||
      !previous ||
      typeof element.animate !== "function" ||
      !window.matchMedia ||
      instantMotion() ||
      (typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    )
      return;
    const next = element.getBoundingClientRect();
    if (!previous.width || !next.width) return;
    const animation = trackMotion(
      element.animate(
        [
          {
            left: `${previous.left}px`,
            top: `${previous.top}px`,
            width: `${previous.width}px`,
            height: `${previous.height}px`,
          },
          {
            left: `${next.left}px`,
            top: `${next.top}px`,
            width: `${next.width}px`,
            height: `${next.height}px`,
          },
        ],
        { duration: 280, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      ),
    );
    animation.onfinish = () => {
      origin.current = null;
    };
    return () => animation.cancel();
  }, [open]);
  useLayoutEffect(() => {
    if (open || !closing) return;
    const element = form.current,
      previous = origin.current;
    if (!element || !previous) {
      setClosing(false);
      return;
    }
    if (!element.animate || !window.matchMedia || instantMotion()) {
      setClosing(false);
      return;
    }
    const next = element.getBoundingClientRect();
    if (!previous.width || !next.width) {
      setClosing(false);
      return;
    }
    const animation = trackMotion(
      element.animate(
        [
          {
            left: `${previous.left}px`,
            top: `${previous.top}px`,
            width: `${previous.width}px`,
            height: `${previous.height}px`,
            padding: "0px 12px",
            backgroundColor: "var(--pc-paper)",
            boxShadow:
              "0 0 0 1px var(--pc-line), 0 12px 32px rgba(56, 43, 30, 0.1)",
          },
          {
            left: `${next.left}px`,
            top: `${next.top}px`,
            width: `${next.width}px`,
            height: `${next.height}px`,
            padding: "0px 12px",
            backgroundColor: "var(--pc-mist)",
            boxShadow: "0 0 0 0 rgba(216, 197, 160, 0)",
          },
        ],
        { duration: 220, easing: "cubic-bezier(0.4, 0, 1, 1)" },
      ),
    );
    returnAnimation.current = animation;
    animation.onfinish = () => {
      origin.current = null;
      returnAnimation.current = null;
      setClosing(false);
    };
    return () => animation.cancel();
  }, [open, closing]);

  function showSearch(source?: HTMLElement) {
    if (closing) {
      origin.current = form.current?.getBoundingClientRect() ?? null;
      returnAnimation.current?.cancel();
      setClosing(false);
      setOpen(true);
      return;
    }
    if (!open) {
      setRecent(readRecentSearches(recent));
      const rect = (source ?? form.current)?.getBoundingClientRect() ?? null;
      origin.current = rect;
      home.current = rect;
    }
    setOpen(true);
  }

  function closeSearch() {
    if (!open || closing) return;
    input.current?.blur();
    const element = form.current,
      target = window.innerWidth > 1250 ? root.current : compact.current;
    if (
      !element ||
      !target ||
      typeof element.animate !== "function" ||
      !window.matchMedia ||
      instantMotion() ||
      (typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    ) {
      setOpen(false);
      return;
    }
    const from = element.getBoundingClientRect(),
      to = home.current ?? target.getBoundingClientRect();
    if (!to.width) {
      setOpen(false);
      return;
    }
    origin.current = from;
    home.current = to;
    setClosing(true);
    setOpen(false);
  }

  function submit(nextKind: SearchKind, value: string) {
    const keyword = value.trim();
    if (!keyword) {
      showSearch();
      input.current?.focus();
      return;
    }
    const entry = { query: keyword, kind: nextKind };
    setRecent(rememberSearch(entry, recent));
    setOpen(false);
    navigate(searchResultPath(entry));
  }

  const matches = recent.filter((item) =>
    item.query.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const recommended = searchSuggestions.filter(
    (item) =>
      !matches.some((recentItem) => recentItem.query === item) &&
      item.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  return (
    <>
      <div
        className="pc-header-search-wrap"
        ref={root}
        data-open={open}
        data-closing={closing}
      >
        {(open || closing) && (
          <button
            type="button"
            tabIndex={-1}
            className="pc-header-search-backdrop"
            aria-label="关闭搜索"
            onClick={closeSearch}
          />
        )}
        <form
          ref={form}
          className="pc-header-search"
          style={
            closing && !open && home.current
              ? {
                  position: "fixed",
                  zIndex: 102,
                  top: home.current.top,
                  left: home.current.left,
                  display: "flex",
                  width: home.current.width,
                  height: home.current.height,
                }
              : undefined
          }
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            submit(kind, query);
          }}
        >
          <Icon name="search" size={18} />
          <input
            ref={input}
            role="combobox"
            aria-label="搜索菜品或店名"
            aria-expanded={open}
            aria-controls={panelId}
            aria-haspopup="dialog"
            autoComplete="off"
            maxLength={64}
            placeholder="搜菜品或店名"
            value={query}
            onFocus={() => showSearch()}
            onChange={(event) => {
              setQuery(event.target.value);
              showSearch();
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                root.current
                  ?.querySelector<HTMLButtonElement>(".pc-search-suggestion")
                  ?.focus();
              }
            }}
          />
          {query && (
            <button
              type="button"
              aria-label="清空搜索关键词"
              onClick={() => {
                setQuery("");
                input.current?.focus();
              }}
            >
              <Icon name="close" size={15} />
            </button>
          )}
          <button
            className="pc-header-search-submit"
            aria-label={`搜索${kind === "shop" ? "店铺" : "菜品"}`}
          >
            <Icon name="search" size={17} />
          </button>
        </form>
        {(open || closing) && (
          <AnimatedSurface
            open={open}
            duration={180}
            closeDuration={100}
            padding={10}
            className="pc-header-search-panel"
            id={panelId}
            role="dialog"
            aria-label="搜索选项"
          >
            <div className="pc-search-scope" role="group" aria-label="搜索范围">
              {(
                [
                  ["food", "菜品"],
                  ["shop", "店铺"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={kind === value}
                  onClick={() => setKind(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            {matches.length > 0 && (
              <section className="pc-header-search-panel-section">
                <div className="pc-header-search-panel-heading">
                  <span>最近搜索</span>
                  <button
                    type="button"
                    onClick={() => {
                      setRecent([]);
                      writeRecentSearches([]);
                    }}
                  >
                    清空
                  </button>
                </div>
                {matches.map((item) => (
                  <button
                    className="pc-search-suggestion"
                    type="button"
                    key={recentSearchId(item)}
                    onClick={() => submit(item.kind, item.query)}
                  >
                    <Icon name="history" size={16} />
                    <span>{item.query}</span>
                    <small>{item.kind === "shop" ? "店铺" : "菜品"}</small>
                  </button>
                ))}
              </section>
            )}
            {recommended.length > 0 && (
              <section className="pc-header-search-panel-section">
                <div className="pc-header-search-panel-heading">
                  <span>{query.trim() ? "相关搜索" : "试试这些"}</span>
                </div>
                {recommended.map((item) => (
                  <button
                    className="pc-search-suggestion"
                    type="button"
                    key={item}
                    onClick={() => submit(kind, item)}
                  >
                    <Icon name="search" size={16} />
                    <span>{item}</span>
                  </button>
                ))}
              </section>
            )}
          </AnimatedSurface>
        )}
      </div>
      <button
        ref={compact}
        className="pc-compact-search pc-icon-button"
        type="button"
        aria-label="搜索菜品或店名"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={(event) => {
          showSearch(event.currentTarget);
          requestAnimationFrame(() => input.current?.focus());
        }}
      >
        <Icon name="search" size={21} />
      </button>
    </>
  );
}
