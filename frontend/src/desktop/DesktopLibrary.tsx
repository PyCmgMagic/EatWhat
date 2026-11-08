import { ClearHistory } from "../features/ApiV2";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ContentSkeleton } from "../components/LoadingSkeleton";
import {
  DishIllustration,
  type DishIllustrationName,
} from "../components/DishIllustration";
import { Link } from "react-router-dom";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useApp } from "../app/state";
import { isDemo } from "../app/runtime";
import { errorMessage } from "../api/client";
import { mediaUrl, type CustomTag } from "../api/models";
import { DesignIcon as Icon, useMobile } from "../mobile/ui";
import { visualFor } from "../mobile/catalog";
import { MotionRegion, SlidingTabs } from "./motion";
import { useSurfaceDismiss } from "../motion/hooks";
import {
  historyEntry,
  historyGroups,
  historyTime,
  type HistoryKind,
} from "./history";
import "./library.css";
import "./history-page.css";
import { ProfileSectionNav } from "../features/ProfileSectionNav";

function Empty({
  title,
  children,
  icon = "bowl",
  illustration,
}: {
  title: string;
  children: ReactNode;
  icon?: string;
  illustration?: DishIllustrationName;
}) {
  return (
    <div className="pc-library-empty">
      {illustration ? (
        <DishIllustration name={illustration} />
      ) : (
        <span className="pc-library-empty-symbol">
          <Icon name={icon} size={35} />
        </span>
      )}
      <h2>{title}</h2>
      {children}
    </div>
  );
}
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

export function DesktopTags() {
  const { api, toast } = useApp(),
    cache = useQueryClient(),
    mobile = useMobile();
  const [page, setPage] = useState(1),
    [search, setSearch] = useState("");
  const tags = useQuery({
    queryKey: ["my-tags", page],
    queryFn: () => api.myTags(page),
  });
  const [editing, setEditing] = useState<number | null>(null),
    [name, setName] = useState("");
  const [deleting, setDeleting] = useState<CustomTag | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false),
    dialog = useRef<HTMLDialogElement>(null),
    renameInput = useRef<HTMLInputElement>(null);
  const dismissDelete = useSurfaceDismiss(dialog, () => {
    setDeleting(null);
    setError("");
  });
  const items = tags.data?.items ?? [],
    shown = items.filter((t) =>
      (t.name ?? "")
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
    );
  useEffect(() => {
    if (deleting) dialog.current?.showModal();
  }, [deleting]);
  useEffect(() => {
    if (editing !== null) {
      renameInput.current?.focus();
      renameInput.current?.select();
    }
  }, [editing]);
  async function save(remove = false) {
    if (lock.current) return;
    const id = remove ? deleting?.id : editing;
    if (!Number.isSafeInteger(id) || (id ?? 0) < 1) return;
    if (
      !remove &&
      (!name.trim() || [...name.trim().replace(/\s+/gu, " ")].length > 10)
    ) {
      setError("标签名称需要 1–10 个字。");
      renameInput.current?.focus();
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (remove) await api.deleteTag(id!);
      else await api.renameTag(id!, name.trim());
      setEditing(null);
      setDeleting(null);
      dialog.current?.close();
      if (remove && items.length === 1 && page > 1) setPage(page - 1);
      await Promise.all(
        ["my-tags", "food-tags", "foods"].map((key) =>
          cache.invalidateQueries({ queryKey: [key] }),
        ),
      );
      toast(remove ? "标签已删除，收藏仍保留" : "标签名称已更新");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="pc-profile-content pc-library">
      <header className="pc-library-heading">
        <div>
          <h1>我的收藏</h1>
          <p>
            <Icon name="lock" size={14} />
            只有你自己看得见，删除标签不会删除菜品或收藏。
          </p>
        </div>
      </header>
      <ProfileSectionNav section="collections" />
      <div className="pc-library-toolbar">
        <span className="pc-small-note">
          共 {tags.data?.totalItems ?? "—"} 个标签
        </span>
        <label className="pc-library-search">
          <Icon name="search" size={17} />
          <input
            aria-label="筛选本页标签"
            placeholder="筛选本页标签"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {search && (
            <button
              type="button"
              aria-label="清除标签筛选"
              onClick={() => setSearch("")}
            >
              <Icon name="close" size={16} />
            </button>
          )}
        </label>
        <span>本页 {shown.length} 个标签</span>
      </div>
      {tags.error && (
        <Failure error={tags.error} retry={() => void tags.refetch()} />
      )}
      {tags.isPending ? (
        <ContentSkeleton kind="rows" count={4} />
      ) : !items.length ? (
        <Empty title="还没有自己的标签">
          <p>在菜品详情点击「加标签」，创建你的口味分类。</p>
          <Link className="pc-button" to="/">
            发现一道好吃的
            <Icon name="chevronRight" size={17} />
          </Link>
        </Empty>
      ) : !shown.length ? (
        <Empty title="这页没有找到匹配的标签">
          <p>换个关键词，或翻页继续找找。</p>
          <button className="pc-button light" onClick={() => setSearch("")}>
            清除筛选
          </button>
        </Empty>
      ) : (
        <div className="pc-tag-grid">
          {shown.map((tag, index) => (
            <article className="pc-tag-card" key={tag.id ?? index}>
              <div className="pc-tag-card-top">
                <span className={`pc-tag-symbol tone-${index % 4}`}>
                  <Icon name="tag" size={25} />
                </span>
                <div>
                  <h2>{tag.name ?? "未命名标签"}</h2>
                  <p>
                    <b>{tag.usageCount ?? "—"}</b> 道菜使用了这个标签
                  </p>
                </div>
              </div>
              {editing === tag.id ? (
                <form
                  className="pc-tag-rename"
                  aria-label={`重命名${tag.name}`}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void save();
                  }}
                >
                  <label htmlFor="pc-tag-rename">
                    标签名称<span>{[...name.trim()].length}/10</span>
                  </label>
                  <input
                    ref={renameInput}
                    id="pc-tag-rename"
                    maxLength={20}
                    value={name}
                    disabled={busy}
                    onChange={(event) => {
                      setName(event.target.value);
                      setError("");
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Escape" && !busy) {
                        setEditing(null);
                        setError("");
                      }
                    }}
                  />
                  <div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setEditing(null);
                        setError("");
                      }}
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      className="pc-button"
                      disabled={
                        busy || !name.trim() || name.trim() === tag.name
                      }
                    >
                      {busy ? "保存中…" : "保存名称"}
                      <Icon name="check" size={15} />
                    </button>
                  </div>
                  {error && !deleting && <p role="alert">{error}</p>}
                </form>
              ) : (
                <div className="pc-tag-card-actions">
                  <Link
                    to={`/me/tags/${tag.id}/foods`}
                    onClick={() => mobile.setTagId(tag.id ?? undefined)}
                  >
                    查看标签下的菜品
                    <Icon name="chevronRight" size={14} />
                  </Link>
                  <button
                    type="button"
                    aria-label={`重命名${tag.name}`}
                    disabled={busy || !tag.id}
                    onClick={() => {
                      setEditing(tag.id!);
                      setName(tag.name ?? "");
                      setError("");
                    }}
                  >
                    <Icon name="edit" size={16} />
                    重命名
                  </button>
                  <button
                    type="button"
                    aria-label={`删除${tag.name}`}
                    disabled={busy || !tag.id}
                    onClick={() => {
                      setDeleting(tag);
                      setError("");
                    }}
                  >
                    <Icon name="delete" size={16} />
                    删除
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      <Pager
        page={page}
        hasNext={tags.data?.hasNext}
        busy={tags.isFetching || busy}
        change={(next) => {
          setPage(next);
          setSearch("");
          setEditing(null);
          setError("");
          jumpToLibrary();
        }}
      />
      <div className="pc-library-note">
        <span className="pc-library-note-icon">
          <Icon name="tag" size={23} />
        </span>
        <div>
          <strong>新标签，从一道菜开始</strong>
          <p>在菜品详情添加标签，也可以用标签查询全部收藏。</p>
        </div>
        <Link to="/">
          去发现
          <Icon name="chevronRight" size={15} />
        </Link>
      </div>
      {deleting && (
        <dialog
          ref={dialog}
          className="pc-library-dialog"
          aria-labelledby="pc-delete-tag-title"
          onCancel={(event) => {
            event.preventDefault();
            if (!busy) dismissDelete();
          }}
        >
          <span className="pc-tag-symbol tone-1">
            <Icon name="tag" size={25} />
          </span>
          <h2 id="pc-delete-tag-title">删除「{deleting.name}」？</h2>
          <p>
            该标签会从关联菜品上移除，菜品和收藏会保留。删除后无法恢复这个标签。
          </p>
          {error && (
            <p className="pc-library-dialog-error" role="alert">
              {error}
            </p>
          )}
          <div>
            <button
              type="button"
              className="pc-button light"
              disabled={busy}
              onClick={dismissDelete}
            >
              保留标签
            </button>
            <button
              type="button"
              className="pc-button"
              disabled={busy}
              onClick={() => void save(true)}
            >
              {busy ? "正在删除…" : "删除标签"}
            </button>
          </div>
        </dialog>
      )}
    </section>
  );
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
      <header className="pc-library-heading">
        <div>
          <h1>浏览足迹</h1>
          <p>
            <Icon name="lock" size={14} />
            找回看过的菜品和店铺，浏览记录仅自己可见。
          </p>
        </div>
      </header>
      <div className="pc-history-tabs">
        <SlidingTabs label="足迹类型" active={kind}>
          {[
            { id: "food", name: "浏览的菜品", icon: "bowl" },
            { id: "restaurant", name: "浏览的店铺", icon: "store" },
          ].map((tab) => (
            <button
              role="tab"
              key={tab.id}
              aria-selected={kind === tab.id}
              tabIndex={kind === tab.id ? 0 : -1}
              onClick={() => select(tab.id as HistoryKind)}
            >
              <Icon name={tab.icon} size={17} />
              {tab.name}
            </button>
          ))}
        </SlidingTabs>
      </div>
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
          <div className="pc-history-failure" role="alert">
            <span className="pc-library-empty-symbol">
              <Icon name="history" size={32} />
            </span>
            <h2>暂时没能加载浏览记录</h2>
            <p>{errorMessage(query.error)}</p>
            <button
              type="button"
              className="pc-button light"
              onClick={() => void query.refetch()}
            >
              重新加载
            </button>
          </div>
        ) : !items.length ? (
          <Empty
            icon="history"
            illustration="baozi"
            title={
              page > 1
                ? "这一页没有浏览记录"
                : kind === "food"
                  ? "还没有浏览过的菜品"
                  : "还没有浏览过的店铺"
            }
          >
            <p>
              {page > 1
                ? "可以返回上一页，继续查找之前的足迹。"
                : `看过的${kind === "food" ? "菜品" : "店铺"}会出现在这里，下次想吃时不用重新找。`}
            </p>
            {page === 1 && (
              <Link
                className="pc-button light"
                to={kind === "food" ? "/" : "/nearby"}
              >
                {kind === "food" ? "发现好吃的" : "找一家店"}
                <Icon name="chevronRight" size={17} />
              </Link>
            )}
          </Empty>
        ) : !visible.length ? (
          <Empty title="这页没有找到匹配的足迹">
            <p>试试其他关键词，或翻页继续查找。</p>
            <button className="pc-button light" onClick={() => setSearch("")}>
              清除筛选
            </button>
          </Empty>
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
