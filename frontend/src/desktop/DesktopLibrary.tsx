import { useRef, useState } from "react";
import { ContentSkeleton } from "../components/LoadingSkeleton";
import { Link } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { isDemo } from "../app/runtime";
import { errorMessage } from "../api/client";
import { mediaUrl } from "../api/models";
import { DesignIcon as Icon } from "../mobile/ui";
import { visualFor } from "../mobile/catalog";
import { MotionRegion, SlidingTabs } from "./motion";
import {
  historyEntry,
  historyGroups,
  historyTime,
  type HistoryKind,
} from "./history";
import "./library.css";
import "./history-page.css";
import { ProfileEmpty, ProfilePageHead } from "../features/ProfilePage";
import { ClearHistory } from "../features/ApiV2";

function Failure({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="pc-library-error" role="alert">
      <span>{errorMessage(error)}</span>
      <button type="button" onClick={retry}>
        重新加载
      </button>
    </div>
  );
}
function Pager({
  page,
  hasNext,
  busy,
  change,
}: {
  page: number;
  hasNext?: boolean | null;
  busy: boolean;
  change: (page: number) => void;
}) {
  return page > 1 || hasNext ? (
    <div className="pc-pagination">
      <button
        className="pc-button light"
        disabled={busy || page === 1}
        onClick={() => change(page - 1)}
      >
        <Icon name="back" size={15} />
        上一页
      </button>
      <span>第 {page} 页</span>
      <button
        className="pc-button light"
        disabled={busy || !hasNext}
        onClick={() => change(page + 1)}
      >
        下一页
        <Icon name="chevronRight" size={15} />
      </button>
    </div>
  ) : null;
}
function jumpToLibrary() {
  document.querySelector(".pc-library")?.scrollIntoView({
    block: "start",
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
  });
}

export function DesktopHistory() {
  const { api } = useApp();
  const [kind, setKind] = useState<HistoryKind>("food"),
    [page, setPage] = useState(1),
    [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["history", "desktop", kind, page],
    queryFn: async () => ({ ...(await api.history(kind, page)), kind }),
    placeholderData: keepPreviousData,
    refetchOnMount: "always",
  });
  const items = query.data?.items ?? [],
    visible = items.filter((item) =>
      (historyEntry(item, query.data?.kind ?? kind).content?.name ?? "")
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
    );
  const groups = historyGroups(visible);
  function select(next: HistoryKind) {
    setKind(next);
    setPage(1);
    setSearch("");
  }
  return (
    <section className="pc-profile-content pc-library pc-history-page">
      <ProfilePageHead
        title="浏览足迹"
        detail={
          <>
            <Icon name="lock" size={14} />
            看过的菜品和店铺都记在这里，只有你自己看得到。
          </>
        }
      >
        <div className="pp-seg">
          <SlidingTabs label="足迹类型" active={kind}>
            {[
              { id: "food", name: "菜品", icon: "bowl" },
              { id: "restaurant", name: "店铺", icon: "store" },
            ].map((tab) => (
              <button
                role="tab"
                key={tab.id}
                aria-selected={kind === tab.id}
                tabIndex={kind === tab.id ? 0 : -1}
                onClick={() => select(tab.id as HistoryKind)}
              >
                <Icon name={tab.icon} size={16} />
                {tab.name}
              </button>
            ))}
          </SlidingTabs>
        </div>
      </ProfilePageHead>
      {items.length > 0 && (
        <div className="pc-library-toolbar pc-history-toolbar">
          <span className="pc-history-count">
            {query.isPlaceholderData
              ? "正在切换…"
              : `共 ${query.data?.totalItems ?? items.length} 条记录`}
          </span>
          <div className="pc-history-tools">
            <label className="pc-library-search">
              <Icon name="search" size={16} />
              <input
                aria-label="筛选本页足迹"
                placeholder="筛选本页记录"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {search && (
                <button
                  type="button"
                  aria-label="清除足迹筛选"
                  onClick={() => setSearch("")}
                >
                  <Icon name="close" size={15} />
                </button>
              )}
            </label>
            <ClearHistory
              kind={kind}
              disabled={query.isFetching}
              onClear={() => {
                setPage(1);
                setSearch("");
              }}
            />
          </div>
        </div>
      )}
      {query.error && query.data && (
        <Failure error={query.error} retry={() => void query.refetch()} />
      )}
      {query.isPlaceholderData && (
        <p className="pc-history-loading" role="status">
          正在切换记录…
        </p>
      )}
      <MotionRegion
        changeKey={
          query.isPlaceholderData
            ? undefined
            : `${kind}:${page}:${query.dataUpdatedAt}`
        }
        order={kind === "food" ? 0 : 1}
        className="pc-history-content"
        aria-busy={query.isPlaceholderData}
      >
        {query.isPending ? (
          <ContentSkeleton kind="rows" count={4} />
        ) : query.isError && !query.data ? (
          <ProfileEmpty
            role="alert"
            icon="history"
            title="暂时没能加载浏览记录"
            detail={errorMessage(query.error)}
          >
            <button
              type="button"
              className="pp-button is-quiet"
              onClick={() => void query.refetch()}
            >
              重新加载
            </button>
          </ProfileEmpty>
        ) : !items.length ? (
          <ProfileEmpty
            illustration="baozi"
            title={
              page > 1
                ? "这一页没有浏览记录"
                : kind === "food"
                  ? "还没有浏览过的菜品"
                  : "还没有浏览过的店铺"
            }
            detail={
              page > 1
                ? "可以返回上一页，继续查找之前的足迹。"
                : `看过的${kind === "food" ? "菜品" : "店铺"}会出现在这里，下次想吃时不用重新找。`
            }
          >
            {page === 1 && (
              <Link className="pp-button" to={kind === "food" ? "/" : "/nearby"}>
                {kind === "food" ? "发现好吃的" : "找一家店"}
                <Icon name="chevronRight" size={16} />
              </Link>
            )}
          </ProfileEmpty>
        ) : !visible.length ? (
          <ProfileEmpty
            compact
            icon="search"
            title="这页没有找到匹配的足迹"
            detail="试试其他关键词，或翻页继续查找。"
          >
            <button
              type="button"
              className="pp-button is-quiet"
              onClick={() => setSearch("")}
            >
              清除筛选
            </button>
          </ProfileEmpty>
        ) : (
          groups.map((group) => (
            <section className="pc-history-group" key={group.key}>
              <h2>
                <i />
                {group.label}
                <span>{group.items.length} 条</span>
              </h2>
              <div className="pc-history-grid">
                {group.items.map((item, index) => {
                  const entry = historyEntry(item, query.data?.kind ?? kind),
                    date = historyTime(item.viewedAt),
                    src = mediaUrl(entry.content?.pictureUrl?.[0]),
                    visual = visualFor(
                      {
                        name: entry.content?.name,
                        pictureUrl: entry.content?.pictureUrl,
                      },
                      isDemo,
                    );
                  const body = (
                    <>
                      <span
                        className={`pc-library-thumb ${entry.kind === "restaurant" ? "is-restaurant" : ""}`}
                        style={{ background: visual.tile }}
                      >
                        {src ? (
                          <img src={src} alt="" />
                        ) : (
                          <Icon
                            name={
                              entry.kind === "restaurant" ? "store" : "bowl"
                            }
                            size={30}
                          />
                        )}
                      </span>
                      <span className="pc-history-entry-info">
                        <small>
                          {entry.kind === "restaurant" ? "店铺" : "菜品"}
                        </small>
                        <strong>{entry.content?.name ?? "内容暂不可用"}</strong>
                        <time dateTime={date?.toISOString()}>
                          {date
                            ? `${date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })} 浏览`
                            : "浏览时间待确认"}
                        </time>
                      </span>
                      {entry.href ? (
                        <Icon name="chevronRight" size={17} />
                      ) : (
                        <span className="pc-history-unavailable">
                          暂不可查看
                        </span>
                      )}
                    </>
                  );
                  return entry.href ? (
                    <Link
                      className="pc-history-entry"
                      to={entry.href}
                      key={`${item.targetType}:${item.targetId}:${index}`}
                      aria-disabled={query.isPlaceholderData || undefined}
                      tabIndex={query.isPlaceholderData ? -1 : 0}
                      onClick={(event) => {
                        if (query.isPlaceholderData) event.preventDefault();
                      }}
                    >
                      {body}
                    </Link>
                  ) : (
                    <div
                      className="pc-history-entry is-unavailable"
                      key={`missing-${index}`}
                    >
                      {body}
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </MotionRegion>
      <Pager
        page={page}
        hasNext={query.data?.hasNext}
        busy={query.isFetching}
        change={(next) => {
          setPage(next);
          setSearch("");
          jumpToLibrary();
        }}
      />
      {items.length > 0 && (
        <p className="pc-library-page-note">
          按浏览日期整理；关键词仅筛选当前页记录。
        </p>
      )}
    </section>
  );
}
