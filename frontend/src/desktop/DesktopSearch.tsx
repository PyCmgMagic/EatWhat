import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { DesignIcon as Icon } from "../mobile/ui";
import "./desktop-search.css";

type SearchKind = "food" | "shop";
type RecentSearch = { query: string; kind: SearchKind };
const storageKey = "eatwhat-recent-searches-v1";
const suggestions = ["云吞", "麻辣香锅", "杨枝甘露"];

function readRecent(): RecentSearch[] {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (item) =>
          typeof item?.query === "string" &&
          ["food", "shop"].includes(item?.kind),
      )
      .slice(0, 5);
  } catch {
    return [];
  }
}

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
    [recent, setRecent] = useState<RecentSearch[]>(readRecent);
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
      (typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    )
      return;
    const next = element.getBoundingClientRect();
    if (!previous.width || !next.width) return;
    const animation = element.animate(
      [
        {
          width: `${previous.width}px`,
          height: `${previous.height}px`,
          transform: `translate(${previous.left - next.left}px, ${previous.top - next.top}px)`,
        },
        {
          width: `${next.width}px`,
          height: `${next.height}px`,
          transform: "translate(0, 0)",
        },
      ],
      { duration: 280, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
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
    const next = element.getBoundingClientRect();
    if (!previous.width || !next.width) {
      setClosing(false);
      return;
    }
    const animation = element.animate(
      [
        {
          width: `${previous.width}px`,
          height: `${previous.height}px`,
          padding: "0px 12px",
          backgroundColor: "#fff",
          boxShadow: "0 0 0 1px #e6ddd4, 0 12px 32px rgba(56, 43, 30, 0.1)",
          transform: `translate(${previous.left - next.left}px, ${previous.top - next.top}px)`,
        },
        {
          width: `${next.width}px`,
          height: `${next.height}px`,
          padding: "0px 12px",
          backgroundColor: "#f4efeb",
          boxShadow: "0 0 0 0 rgba(216, 197, 160, 0)",
          transform: "translate(0, 0)",
        },
      ],
      { duration: 220, easing: "cubic-bezier(0.4, 0, 1, 1)" },
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
    if (closing) return;
    if (!open) {
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
    const next = [
      { query: keyword, kind: nextKind },
      ...recent.filter(
        (item) => item.query !== keyword || item.kind !== nextKind,
      ),
    ].slice(0, 5);
    setRecent(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Search still works when storage is unavailable.
    }
    setOpen(false);
    navigate(
      `/search?q=${encodeURIComponent(keyword)}${nextKind === "shop" ? "&type=shop" : ""}`,
    );
  }

  const matches = recent.filter((item) =>
    item.query.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const recommended = suggestions.filter(
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
                  translate: "0 0",
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
          <div
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
                      localStorage.removeItem(storageKey);
                    }}
                  >
                    清空
                  </button>
                </div>
                {matches.map((item) => (
                  <button
                    className="pc-search-suggestion"
                    type="button"
                    key={`${item.kind}:${item.query}`}
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
          </div>
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
