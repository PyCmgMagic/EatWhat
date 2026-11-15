import { useEffect, useId, useRef, useState } from "react";
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
    input = useRef<HTMLInputElement>(null),
    panelId = useId();
  const [query, setQuery] = useState(""),
    [kind, setKind] = useState<SearchKind>("food"),
    [open, setOpen] = useState(false),
    [recent, setRecent] = useState<RecentSearch[]>(readRecent);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setQuery(params.get("q") ?? "");
    setKind(params.get("type") === "shop" ? "shop" : "food");
    setOpen(false);
  }, [location.pathname, location.search]);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  function submit(nextKind: SearchKind, value: string) {
    const keyword = value.trim();
    if (!keyword) {
      setOpen(true);
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
      <div className="pc-header-search-wrap" ref={root} data-open={open}>
        <form
          className="pc-header-search"
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
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setOpen(false);
                input.current?.blur();
              }
              if (event.key === "ArrowDown") {
                event.preventDefault();
                root.current
                  ?.querySelector<HTMLButtonElement>(".pc-search-suggestion")
                  ?.focus();
              }
            }}
          />
          {query ? (
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
          ) : (
            <button aria-label="开始搜索">
              <Icon name="chevronRight" size={16} />
            </button>
          )}
        </form>
        {open && (
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
            <div className="pc-header-search-panel-footer">
              <span>Enter 搜索{kind === "shop" ? "店铺" : "菜品"}</span>
              <button type="button" onClick={() => submit(kind, query)}>
                搜索{kind === "shop" ? "店铺" : "菜品"}
                <Icon name="chevronRight" size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
      <button
        className="pc-compact-search pc-icon-button"
        type="button"
        aria-label="搜索菜品或店名"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen(true);
          input.current?.focus();
        }}
      >
        <Icon name="search" size={21} />
      </button>
    </>
  );
}
