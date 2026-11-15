import { useEffect, useRef, useState, type ReactNode } from "react";
import { UserTitle } from "../../components/UserTitle";
import { userTitle } from "../../api/growth";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useApp } from "../../app/state";
import { useArea } from "../../app/area";
import {
  removeDraft,
  useMemoryDraft,
  usePageLifetime,
  useSessionDraft,
} from "../../app/drafts";
import { codePoints, boundedText } from "../../api/content-rules";
import { validateFiles } from "../../api/validation";
import {
  commentBody,
  type CommentView,
  type CommentImage,
  type CommentSort,
  type CommentSubmission,
  type CommentVerdict,
} from "../../api/comments";
import { mediaUrl, parseId, type Food, type Page } from "../../api/models";
import { useActionAccess } from "../access";
import { DesignIcon as Icon } from "../../mobile/ui";
import { FoodCover } from "../../components/FoodCover";
import { ContentSkeleton } from "../../components/LoadingSkeleton";
import { Gate } from "../../components/ui";
import { useSurfaceDismiss } from "../../motion/hooks";
import {
  useCommentCommand,
  useRefreshComments,
  commentError,
  commentTime,
  commentStatus,
} from "./state";
import "./comments.css";

type ReplyTarget = { rootId: number; id: number; name: string };
type ImageValue = { slot?: number | null; url?: string | null };
const validPage = (raw: string | null) => {
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : 1;
};
const commentsHref = (foodId: number) => `/comments?foodId=${foodId}`;
function discussionScroll(behavior: ScrollBehavior = "smooth") {
  document.getElementById("food-discussion")?.scrollIntoView({
    block: "start",
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : behavior,
  });
}

function QueryState({
  query,
  empty,
  children,
}: {
  query: {
    isPending: boolean;
    isError: boolean;
    error: unknown;
    refetch: () => unknown;
  };
  empty?: boolean;
  children: ReactNode;
}) {
  if (query.isPending) return <ContentSkeleton kind="rows" count={3} />;
  if (query.isError)
    return (
      <div className="comments-state" role="alert">
        <p>{commentError(query.error)}</p>
        <button type="button" onClick={() => void query.refetch()}>
          重新加载 <Icon name="refresh" size={16} />
        </button>
      </div>
    );
  if (empty)
    return (
      <div className="comments-state">
        <Icon name="comment" size={30} />
        <p>还没有评论，来说说你的用餐感受。</p>
      </div>
    );
  return <>{children}</>;
}
function Pager({
  page,
  hasNext,
  onChange,
  busy,
}: {
  page: number;
  hasNext?: boolean | null;
  onChange: (n: number) => void;
  busy?: boolean;
}) {
  if (page === 1 && !hasNext) return null;
  return (
    <nav className="comments-pager" aria-label="评论分页">
      <button disabled={page <= 1 || busy} onClick={() => onChange(page - 1)}>
        上一页
      </button>
      <span>第 {page} 页</span>
      <button disabled={!hasNext || busy} onClick={() => onChange(page + 1)}>
        下一页
      </button>
    </nav>
  );
}
function SignedImage({
  src,
  alt,
  refresh,
}: {
  src: string;
  alt: string;
  refresh: () => unknown;
}) {
  const failed = useRef(new Set<string>());
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => {
        if (!failed.current.has(src)) {
          failed.current.add(src);
          void refresh();
        }
      }}
    />
  );
}
function PhotoDialog({
  src,
  close,
  refresh,
}: {
  src: string;
  close: () => void;
  refresh: () => unknown;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const dismiss = useSurfaceDismiss(ref, close);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="comments-photo-dialog"
      aria-label="评论图片预览"
      onCancel={(e) => {
        e.preventDefault();
        dismiss();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <button
        className="comments-icon"
        onClick={dismiss}
        aria-label="关闭图片预览"
      >
        <Icon name="close" size={24} />
      </button>
      <SignedImage src={src} alt="评论实拍大图" refresh={refresh} />
    </dialog>
  );
}
function Pictures({
  images,
  refresh,
}: {
  images: ImageValue[];
  refresh: () => unknown;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const image = images.find((x, i) => (x.slot ?? i) === selected);
  return (
    <>
      <div className="comments-pictures">
        {images.map(
          (x, i) =>
            x.url && (
              <button
                key={x.slot ?? i}
                onClick={() => setSelected(x.slot ?? i)}
                aria-label={`查看评论图片 ${i + 1}`}
              >
                <SignedImage
                  src={x.url}
                  alt={`用餐实拍 ${i + 1}`}
                  refresh={refresh}
                />
              </button>
            ),
        )}
      </div>
      {selected !== null && image?.url && (
        <PhotoDialog
          src={image.url}
          close={() => setSelected(null)}
          refresh={refresh}
        />
      )}
    </>
  );
}

function Like({ comment }: { comment: CommentView }) {
  const { api, user, session } = useApp(),
    cache = useQueryClient(),
    access = useActionAccess();
  const ref = useRef<HTMLDivElement>(null),
    [visible, setVisible] = useState(false);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const key = ["comments", "like", user?.id ?? "guest", comment.id];
  const q = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => api.commentLike(comment.id!, signal),
    enabled: visible && !!session && !!user && !user.banned && !!comment.id,
    retry: false,
  });
  const task = useCommentCommand<
    boolean,
    Awaited<ReturnType<typeof api.likeComment>>
  >(
    `like:${comment.id}`,
    (liked, id) =>
      liked
        ? api.likeComment(comment.id!, id)
        : api.unlikeComment(comment.id!, id),
    (value) => {
      cache.setQueryData(key, value);
      void cache.invalidateQueries({ queryKey: ["user"] });
    },
  );
  const liked = q.data?.liked === true;
  return (
    <div ref={ref} className="comments-like">
      <button
        type="button"
        aria-label={liked ? "取消觉得有用" : "觉得这条评论有用"}
        aria-pressed={liked}
        disabled={task.busy || (!!session && (q.isPending || q.isError))}
        onClick={() => {
          if (access(false)) void task.run(!liked);
        }}
      >
        <Icon name={liked ? "heartOn" : "heart"} size={18} />
        <span>有用</span>
        <b>{q.data?.likesCount ?? comment.likesCount ?? "—"}</b>
      </button>
      {q.isError && (
        <button
          onClick={() => void q.refetch()}
          className="comments-retry-like"
        >
          重试点赞状态
        </button>
      )}
      {task.error && (
        <span className="comments-error" role="alert">
          {task.error}
        </span>
      )}
    </div>
  );
}

function CommentRow({
  comment,
  rootId,
  onReply,
  refresh,
  nested = false,
}: {
  comment: CommentView;
  rootId?: number;
  onReply: (target: ReplyTarget) => void;
  refresh: () => unknown;
  nested?: boolean;
}) {
  const { api, user } = useApp();
  const [expanded, setExpanded] = useState(false),
    [page, setPage] = useState(1);
  const replies = useQuery({
    queryKey: ["comments", "replies", user?.id ?? "guest", comment.id, page],
    queryFn: ({ signal }) => api.commentReplies(comment.id!, page, 20, signal),
    enabled: expanded && !nested && !!comment.id,
  });
  const name = comment.authorName || "匿名用户";
  return (
    <article
      className={`comments-row${nested ? " is-reply" : ""}`}
      aria-label={`${name}的${nested ? "回复" : "评论"}`}
    >
      <span className="comments-avatar" aria-hidden="true">
        {Array.from(name)[0]}
      </span>
      <div className="comments-row-body">
        <div className="comments-byline">
          <strong>
            {name}
            <UserTitle title={userTitle({ title: comment.authorTitle })} />
          </strong>
          <time dateTime={comment.createdAt ?? undefined}>
            {commentTime(comment.createdAt)}
          </time>
        </div>
        <p className="comments-text">{comment.text}</p>
        <Pictures images={comment.images ?? []} refresh={refresh} />
        <div className="comments-actions">
          <Like comment={comment} />
          <button
            type="button"
            onClick={() =>
              onReply({ rootId: rootId ?? comment.id!, id: comment.id!, name })
            }
          >
            <Icon name="comment" size={17} />
            回复
          </button>
          {!nested && (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded
                ? "收起回复"
                : replies.data?.totalItems != null
                  ? `查看回复 ${replies.data.totalItems}`
                  : "查看回复"}
              <Icon name={expanded ? "chevronUp" : "chevronDown"} size={15} />
            </button>
          )}
        </div>
        {expanded && !nested && (
          <div className="comments-replies">
            <QueryState query={replies}>
              {replies.data?.items?.length
                ? replies.data.items.map((reply) => (
                    <CommentRow
                      key={reply.id}
                      comment={reply}
                      rootId={comment.id!}
                      nested
                      onReply={onReply}
                      refresh={() => replies.refetch()}
                    />
                  ))
                : !replies.isPending &&
                  !replies.isError && (
                    <p className="comments-muted">还没有回复。</p>
                  )}
              <Pager
                page={page}
                hasNext={replies.data?.hasNext}
                onChange={setPage}
                busy={replies.isFetching}
              />
            </QueryState>
          </div>
        )}
      </div>
    </article>
  );
}

type DraftPhoto = { url: string; file?: File; key?: string };
export function CommentComposer({
  food,
  target,
  cancelReply,
  after,
}: {
  food: Food & { id: number };
  target: ReplyTarget | null;
  cancelReply?: () => void;
  after?: () => void;
}) {
  const app = useApp(),
    { campusId } = useArea(),
    refresh = useRefreshComments(),
    access = useActionAccess();
  const active = usePageLifetime();
  const scope = `comments:draft:${app.user?.id ?? "guest"}:${food.id}:${target?.id ?? "root"}`;
  const [text, setText, clearText] = useSessionDraft(scope, "");
  const previousOwner = useRef({ id: app.user?.id, text });
  useEffect(() => {
    const previous = previousOwner.current;
    if (previous.id == null && app.user?.id && previous.text && !text) {
      setText(previous.text);
      removeDraft(`comments:draft:guest:${food.id}:${target?.id ?? "root"}`);
    }
    previousOwner.current = { id: app.user?.id, text };
  }, [app.user?.id, text, scope]);
  const [photos, setPhotos, clearPhotos] = useMemoryDraft<DraftPhoto[]>(
    scope,
    [],
  );
  const [uploading, setUploading] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false),
    input = useRef<HTMLInputElement>(null),
    textarea = useRef<HTMLTextAreaElement>(null);
  const task = useCommentCommand<
    {
      text: string;
      pictureKeys: string[];
      campusId?: number;
      replyToId?: number;
      rootId?: number;
    },
    Awaited<ReturnType<typeof app.api.createFoodComment>>
  >(
    `submit:${food.id}:${target?.id ?? "root"}`,
    (body, id) => {
      const { rootId, ...payload } = body;
      return rootId
        ? app.api.replyToComment(food.id, rootId, payload, id)
        : app.api.createFoodComment(food.id, payload, id);
    },
    async (value) => {
      setText("");
      clearText();
      photos.forEach((p) => {
        if (p.url.startsWith("blob:")) URL.revokeObjectURL(p.url);
      });
      setPhotos([]);
      clearPhotos();
      app.toast(
        value.moderationStatus === "APPROVED"
          ? "已发布"
          : value.moderationStatus === "REJECTED"
            ? "未通过审核，可在我的评论查看原因。"
            : "已提交，等待审核。",
      );
      await refresh();
      if (active.current) after?.();
    },
  );
  const busy = uploading || task.busy;
  useEffect(() => {
    if (target) textarea.current?.focus();
  }, [target?.id]);
  async function pick(files: File[]) {
    if (busy || task.pending || !files.length || !access(true)) return;
    try {
      if (photos.length + files.length > 3)
        throw new Error("每条评论最多添加 3 张图片。");
      validateFiles(files, photos.length);
      setPhotos((current) => [
        ...current,
        ...files.map((file) => ({ file, url: URL.createObjectURL(file) })),
      ]);
      setError("");
    } catch (failure) {
      setError(commentError(failure));
    }
  }
  async function submit() {
    if (lock.current || busy || !access(false)) return;
    lock.current = true;
    setError("");
    try {
      // A retry sends its frozen body, without uploading or reinterpreting the draft.
      if (task.pending) {
        await task.run({ text: "", pictureKeys: [] });
        return;
      }
      const content = boundedText(text, 200, "评论");
      if (photos.some((p) => !p.key) && !access(true)) return;
      setUploading(true);
      const next = [...photos];
      for (let i = 0; i < next.length; i++)
        if (!next[i].key) {
          if (!next[i].file) throw new Error("请重新选择尚未上传的图片。");
          const key = await app.upload(next[i].file!, "comments");
          next[i] = { ...next[i], key };
          setPhotos([...next]);
        }
      setUploading(false);
      const body = commentBody({
        text: content,
        pictureKeys: next.map((p) => p.key!),
        campusId,
        ...(target ? { replyToId: target.id } : {}),
      });
      await task.run({
        ...body,
        text: body.text,
        pictureKeys: body.pictureKeys,
        ...(target ? { rootId: target.rootId } : {}),
      });
    } catch (failure) {
      if (active.current) setError(commentError(failure));
    } finally {
      lock.current = false;
      if (active.current) setUploading(false);
    }
  }
  return (
    <aside
      className="comments-composer"
      aria-label={target ? "发表回复" : "发表评论"}
    >
      <div className="comments-compose-dish">
        {mediaUrl(food.pictureUrl?.[0]) && (
          <FoodCover
            src={mediaUrl(food.pictureUrl?.[0])}
            crop={food.coverCrop}
            alt=""
          />
        )}
        <div>
          <strong>{food.name || "这道菜"}</strong>
          {food.restaurantName && <span>{food.restaurantName}</span>}
        </div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="comments-compose-heading">
          <label htmlFor={`comment-text-${food.id}`}>
            {target ? `回复 ${target.name}` : "说说你的用餐感受"}
          </label>
          {target && cancelReply && (
            <button
              type="button"
              className="comments-icon"
              aria-label="取消回复"
              disabled={busy || task.pending}
              onClick={cancelReply}
            >
              <Icon name="close" size={18} />
            </button>
          )}
        </div>
        <textarea
          id={`comment-text-${food.id}`}
          aria-describedby={`comment-limit-${food.id}`}
          aria-invalid={codePoints(text.trim()) > 200}
          ref={textarea}
          placeholder="口味、分量，或一点用餐建议"
          value={text}
          disabled={busy || task.pending}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <div className="comments-draft-pictures">
          {photos.map((photo, i) => (
            <span key={photo.url}>
              <img src={photo.url} alt={`待发布图片 ${i + 1}`} />
              <button
                type="button"
                aria-label={`移除评论图片 ${i + 1}`}
                disabled={busy || task.pending}
                onClick={() => {
                  if (photo.url.startsWith("blob:"))
                    URL.revokeObjectURL(photo.url);
                  setPhotos(photos.filter((_, n) => n !== i));
                }}
              >
                <Icon name="close" size={14} />
              </button>
            </span>
          ))}
        </div>
        <div className="comments-compose-tools">
          <button
            type="button"
            disabled={busy || task.pending || photos.length >= 3}
            onClick={() => {
              if (access(true)) input.current?.click();
            }}
          >
            <Icon name="image" size={18} />
            添加图片 <span>{photos.length}/3</span>
          </button>
          <span
            id={`comment-limit-${food.id}`}
            className={codePoints(text.trim()) > 200 ? "comments-error" : ""}
          >
            {codePoints(text.trim())}/200
          </span>
        </div>
        <input
          ref={input}
          type="file"
          hidden
          multiple
          accept="image/jpeg,image/png,image/webp"
          aria-label="添加评论图片"
          onChange={(e) => {
            void pick(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        {(error || task.error) && (
          <p className="comments-error" role="alert">
            {error || task.error}
          </p>
        )}
        <button
          className="comments-primary"
          type="submit"
          disabled={
            busy ||
            (!task.pending && (!text.trim() || codePoints(text.trim()) > 200))
          }
        >
          {uploading
            ? "正在上传图片…"
            : task.busy
              ? "正在提交…"
              : task.pending
                ? "重试确认"
                : target
                  ? "发表回复"
                  : "发表评论"}
          <Icon name="chevronRight" size={17} />
        </button>
        <Link className="comments-mine-link" to="/me/shares?tab=comments">
          我的评论 <Icon name="chevronRight" size={14} />
        </Link>
      </form>
    </aside>
  );
}

export function FoodDiscussion({
  food,
  mobile = false,
}: {
  food: Food & { id: number };
  mobile?: boolean;
}) {
  const { api, user } = useApp(),
    access = useActionAccess(),
    nav = useNavigate(),
    loc = useLocation();
  const [params, setParams] = useSearchParams();
  const gallery = params.get("view") === "gallery";
  const Heading = mobile ? "h1" : "h2";
  const sort: CommentSort =
    params.get("sort") === "NEWEST" ? "NEWEST" : "MOST_USEFUL";
  const page = validPage(params.get("commentPage"));
  const [target, setTarget] = useState<ReplyTarget | null>(null);
  const composer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (mobile) return;
    const rootId = parseId(params.get("rootId") ?? undefined);
    const replyId = parseId(params.get("replyToId") ?? undefined);
    if (rootId)
      setTarget({
        rootId,
        id: replyId ?? rootId,
        name: params.get("name") || "食友",
      });
  }, [mobile, params.get("rootId"), params.get("replyToId")]);
  const q = useQuery({
    queryKey: ["comments", "list", user?.id ?? "guest", food.id, sort, page],
    queryFn: ({ signal }) => api.foodComments(food.id, sort, page, 20, signal),
    enabled: !gallery,
  });
  const g = useQuery({
    queryKey: ["comments", "gallery", user?.id ?? "guest", food.id, page],
    queryFn: ({ signal }) => api.foodCommentGallery(food.id, page, 20, signal),
    enabled: gallery,
  });
  const change = (patch: Record<string, string | null>) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const [k, v] of Object.entries(patch))
          v == null ? next.delete(k) : next.set(k, v);
        return next;
      },
      { replace: true },
    );
  const reply = (value: ReplyTarget) => {
    if (!access(false)) return;
    if (mobile)
      nav(
        `/comments/write?foodId=${food.id}&rootId=${value.rootId}&replyToId=${value.id}&name=${encodeURIComponent(value.name)}`,
      );
    else {
      setTarget(value);
      composer.current?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  };
  useEffect(() => {
    if (
      !mobile &&
      new URLSearchParams(loc.search).get("section") === "comments"
    ) {
      const frame = requestAnimationFrame(() => {
        discussionScroll("instant");
        if (new URLSearchParams(loc.search).get("compose") === "1")
          composer.current?.querySelector("textarea")?.focus();
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [food.id, mobile, loc.search]);
  return (
    <section
      className={`comments-surface${mobile ? " is-mobile" : ""}`}
      id="food-discussion"
      aria-labelledby="discussion-title"
    >
      <header className="comments-heading">
        <Heading id="discussion-title">
          吃过的人说
          {q.data?.totalItems != null && <span>{q.data.totalItems}</span>}
        </Heading>
        <div className="comments-tabs" aria-label="讨论内容">
          <button
            aria-pressed={!gallery}
            onClick={() => change({ view: null, commentPage: null })}
          >
            评论
          </button>
          <button
            aria-pressed={gallery}
            onClick={() => change({ view: "gallery", commentPage: null })}
          >
            晒图
          </button>
        </div>
      </header>
      <div className="comments-layout">
        <div className="comments-list">
          {gallery ? (
            <Gallery query={g} />
          ) : (
            <>
              <div className="comments-sort" aria-label="评论排序">
                {(
                  [
                    ["MOST_USEFUL", "最有用"],
                    ["NEWEST", "最新"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    aria-pressed={sort === value}
                    onClick={() => change({ sort: value, commentPage: null })}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <QueryState query={q} empty={!q.data?.items?.length}>
                {q.data?.items?.map((comment) => (
                  <CommentRow
                    key={comment.id}
                    comment={comment}
                    onReply={reply}
                    refresh={() => q.refetch()}
                  />
                ))}
              </QueryState>
            </>
          )}
          <Pager
            page={page}
            hasNext={gallery ? g.data?.hasNext : q.data?.hasNext}
            busy={gallery ? g.isFetching : q.isFetching}
            onChange={(n) => change({ commentPage: String(n) })}
          />
        </div>
        {!mobile && (
          <div ref={composer}>
            <CommentComposer
              key={target?.id ?? "root"}
              food={food}
              target={target}
              cancelReply={() => setTarget(null)}
              after={() => setTarget(null)}
            />
          </div>
        )}
      </div>
      {mobile && (
        <div className="comments-mobile-bar">
          <button
            className="comments-input-trigger"
            onClick={() => {
              if (access(false)) nav(`/comments/write?foodId=${food.id}`);
            }}
          >
            吃过的话，说两句
          </button>
          <button
            className="comments-icon"
            aria-label="发表带图片的评论"
            onClick={() => {
              if (access(true)) nav(`/comments/write?foodId=${food.id}`);
            }}
          >
            <Icon name="image" size={24} />
          </button>
        </div>
      )}
    </section>
  );
}

function Gallery({
  query,
}: {
  query: UseQueryResult<Page<CommentImage>, Error>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const rows = query.data?.items ?? [];
  const key = (row: CommentImage) => `${row.commentId}:${row.image?.slot}`;
  const image = rows.find((row) => key(row) === selected)?.image;
  return (
    <QueryState query={query}>
      {!rows.length ? (
        <div className="comments-state">
          <Icon name="image" size={30} />
          <p>还没有晒图。</p>
        </div>
      ) : (
        <div className="comments-gallery">
          {rows.map(
            (row) =>
              row.image?.url && (
                <button
                  key={key(row)}
                  aria-label="查看食友晒图"
                  onClick={() => setSelected(key(row))}
                >
                  <SignedImage
                    src={row.image.url}
                    alt="食友用餐实拍"
                    refresh={() => query.refetch()}
                  />
                </button>
              ),
          )}
        </div>
      )}
      {selected && image?.url && (
        <PhotoDialog
          src={image.url}
          close={() => setSelected(null)}
          refresh={() => query.refetch()}
        />
      )}
    </QueryState>
  );
}

export function FoodCommentPreview({ foodId }: { foodId: number }) {
  const { api, user } = useApp();
  const q = useQuery({
    queryKey: ["comments", "preview", user?.id ?? "guest", foodId],
    queryFn: ({ signal }) =>
      api.foodComments(foodId, "MOST_USEFUL", 1, 2, signal),
  });
  return (
    <section className="comments-preview">
      <div className="comments-preview-heading">
        <h2>
          吃过的人说
          {q.data?.totalItems != null && <span>{q.data.totalItems}</span>}
        </h2>
        <Link to={commentsHref(foodId)}>
          全部评论 <Icon name="chevronRight" size={16} />
        </Link>
      </div>
      {q.isPending ? (
        <ContentSkeleton kind="rows" count={2} />
      ) : q.isError ? (
        <p className="comments-muted">{commentError(q.error)}</p>
      ) : q.data?.items?.length ? (
        q.data.items.map((row) => (
          <Link
            className="comments-preview-row"
            key={row.id}
            to={commentsHref(foodId)}
          >
            <span className="comments-avatar">
              {Array.from(row.authorName || "匿名用户")[0]}
            </span>
            <span>
              <strong>
                {row.authorName || "匿名用户"}
                <UserTitle title={userTitle({ title: row.authorTitle })} />
              </strong>
              <span>{row.text}</span>
            </span>
          </Link>
        ))
      ) : (
        <Link className="comments-preview-empty" to={commentsHref(foodId)}>
          还没有评论，来说两句 <Icon name="chevronRight" size={16} />
        </Link>
      )}
    </section>
  );
}

export function MobileComments() {
  const { api } = useApp(),
    loc = useLocation(),
    nav = useNavigate();
  const params = new URLSearchParams(loc.search),
    foodId = parseId(params.get("foodId") ?? undefined);
  const rootId = parseId(params.get("rootId") ?? undefined),
    replyId = parseId(params.get("replyToId") ?? undefined);
  const writing = loc.pathname.endsWith("/write");
  const q = useQuery({
    queryKey: ["food", foodId],
    queryFn: () => api.food(foodId!),
    enabled: !!foodId,
  });
  const back = foodId
    ? writing
      ? commentsHref(foodId)
      : `/foods/${foodId}`
    : "/";
  useEffect(() => {
    document.title = `${writing ? "发表评论" : "菜品评论"} · 山软今天吃什么`;
  }, [writing]);
  if (!foodId)
    return (
      <main className="comments-mobile-page">
        <Link className="comments-back" to="/">
          返回发现
        </Link>
        <h1>请先选择一道菜</h1>
      </main>
    );
  const food = q.data ? { ...q.data, id: foodId } : undefined;
  const body = (
    <main className={`comments-mobile-page${writing ? " is-writing" : ""}`}>
      <Link to={back} className="comments-back" aria-label="返回">
        <Icon name="back" size={24} />
      </Link>
      {writing && <h1>{rootId ? "发表回复" : "说说这道菜"}</h1>}
      <QueryState query={q}>
        {food &&
          (writing ? (
            <CommentComposer
              food={food}
              target={
                rootId
                  ? {
                      rootId,
                      id: replyId ?? rootId,
                      name: params.get("name") || "食友",
                    }
                  : null
              }
              after={() => nav("/me/shares?tab=comments")}
            />
          ) : (
            <>
              <Link className="comments-food-context" to={`/foods/${foodId}`}>
                {food.name || "查看菜品"}
                {food.restaurantName && <span>{food.restaurantName}</span>}
              </Link>
              <FoodDiscussion food={food} mobile />
            </>
          ))}
      </QueryState>
    </main>
  );
  return writing ? <Gate verified={false}>{body}</Gate> : body;
}

function DeleteSubmission({ row }: { row: CommentSubmission }) {
  const { api } = useApp(),
    refresh = useRefreshComments();
  const [confirming, setConfirming] = useState(false);
  const task = useCommentCommand<
    null,
    Awaited<ReturnType<typeof api.deleteComment>>
  >(
    `delete:${row.id}`,
    (_, key) => api.deleteComment(row.id!, key),
    async () => {
      setConfirming(false);
      await refresh();
    },
  );
  if (row.moderationStatus === "DELETED" || !row.id) return null;
  return (
    <>
      {!confirming && !task.pending ? (
        <button className="comments-delete" onClick={() => setConfirming(true)}>
          删除
        </button>
      ) : (
        <div className="comments-confirm">
          <p>删除后，这条评论及其图片将不再展示。</p>
          <button disabled={task.busy} onClick={() => void task.run(null)}>
            {task.busy
              ? "正在删除…"
              : task.pending
                ? "重试确认删除"
                : "确认删除"}
          </button>
          {!task.pending && (
            <button disabled={task.busy} onClick={() => setConfirming(false)}>
              取消
            </button>
          )}
        </div>
      )}
      {task.error && (
        <p className="comments-error" role="alert">
          {task.error}
        </p>
      )}
    </>
  );
}
export function MyFoodComments({
  emptyState,
}: { emptyState?: ReactNode } = {}) {
  const { api, user } = useApp(),
    [params, setParams] = useSearchParams();
  const page = validPage(params.get("page"));
  const q = useQuery({
    queryKey: ["comments", "mine", user?.id, page],
    queryFn: ({ signal }) => api.myCommentSubmissions(page, 20, signal),
    enabled: !!user?.id,
  });
  return (
    <div className="comments-my-list">
      <QueryState query={q}>
        {!q.data?.items?.length
          ? (emptyState ?? (
              <div className="comments-state">
                <Icon name="comment" size={30} />
                <p>还没有评论记录。</p>
                <Link to="/">去发现好味道</Link>
              </div>
            ))
          : q.data.items.map((row) => (
              <article
                className="comments-submission"
                key={row.revisionId ?? row.id}
              >
                <div className="comments-submission-heading">
                  <span>{row.kind === "REPLY" ? "回复" : "评论"}</span>
                  <span
                    className="comments-status"
                    data-status={row.moderationStatus}
                  >
                    {commentStatus(row.moderationStatus)}
                  </span>
                  <time dateTime={row.createdAt ?? undefined}>
                    {commentTime(row.createdAt)}
                  </time>
                </div>
                <p className="comments-text">
                  {row.moderationStatus === "DELETED" ? "评论已删除" : row.text}
                </p>
                {!!row.imageCount && (
                  <span className="comments-muted">
                    <Icon name="image" size={15} /> {row.imageCount} 张图片
                  </span>
                )}
                {row.moderationStatus === "REJECTED" &&
                  (row.reasonMessage || row.reasonCode) && (
                    <p className="comments-rejection">
                      {row.reasonMessage || row.reasonCode}
                    </p>
                  )}
                <div className="comments-submission-actions">
                  {row.foodId && (
                    <Link to={`/foods/${row.foodId}?section=comments`}>
                      查看菜品 <Icon name="chevronRight" size={14} />
                    </Link>
                  )}
                  <DeleteSubmission row={row} />
                </div>
              </article>
            ))}
        <Pager
          page={page}
          hasNext={q.data?.hasNext}
          busy={q.isFetching}
          onChange={(n) =>
            setParams((prev) => {
              const next = new URLSearchParams(prev);
              next.set("page", String(n));
              return next;
            })
          }
        />
      </QueryState>
    </div>
  );
}
export function MobileMyComments() {
  return (
    <Gate verified={false}>
      <main className="comments-mobile-page comments-mobile-mine">
        <Link to="/me" className="comments-back" aria-label="返回我的">
          <Icon name="back" size={24} />
        </Link>
        <h1>我的评论</h1>
        <MyFoodComments />
      </main>
    </Gate>
  );
}

function ReviewRow({ row }: { row: CommentSubmission }) {
  const { api } = useApp(),
    refresh = useRefreshComments();
  const [verdict, setVerdict] = useState<CommentVerdict>("APPROVE"),
    [reason, setReason] = useState(""),
    [more, setMore] = useState(false),
    [confirmation, setConfirmation] = useState(false);
  const task = useCommentCommand<
    { verdict: CommentVerdict; reasonCode?: string; revisionId: string },
    Awaited<ReturnType<typeof api.reviewComment>>
  >(
    `review:${row.revisionId}`,
    (body, id) => api.reviewComment({ ...body, decisionId: id }),
    refresh,
  );
  return (
    <article className="comments-submission">
      <div className="comments-submission-heading">
        <span>{row.kind === "REPLY" ? "回复" : "评论"}</span>
        <span className="comments-status" data-status={row.moderationStatus}>
          {commentStatus(row.moderationStatus)}
        </span>
        <time dateTime={row.createdAt ?? undefined}>
          {commentTime(row.createdAt)}
        </time>
      </div>
      <p className="comments-text">{row.text || "正文已不可见"}</p>
      {!!row.imageCount && (
        <span className="comments-image-info">
          <Icon name="image" size={17} /> {row.imageCount} 张图片{" "}
          <span
            tabIndex={0}
            className="comments-info"
            role="note"
            aria-label="当前接口仅提供图片数量，暂不支持预览待审核图片。"
            title="当前接口仅提供图片数量，暂不支持预览待审核图片。"
          >
            i
          </span>
        </span>
      )}
      <div className="comments-review-actions">
        {row.foodId && (
          <Link to={`/foods/${row.foodId}`}>
            查看菜品 <Icon name="chevronRight" size={14} />
          </Link>
        )}
        <button
          disabled={task.busy || task.pending}
          aria-pressed={verdict === "APPROVE"}
          onClick={() => {
            setVerdict("APPROVE");
            setConfirmation(false);
          }}
        >
          通过
        </button>
        <button
          disabled={task.busy || task.pending}
          aria-pressed={verdict === "REJECT"}
          onClick={() => {
            setVerdict("REJECT");
            setConfirmation(false);
          }}
        >
          驳回
        </button>
        <button
          className="comments-icon"
          aria-label="更多审核操作"
          aria-expanded={more}
          onClick={() => setMore((v) => !v)}
        >
          <Icon name="more" size={20} />
        </button>
      </div>
      {more && (
        <div className="comments-review-more">
          {(
            [
              ["HIDE", "隐藏"],
              ["RESTORE", "恢复"],
              ["DELETE", "删除"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              disabled={task.busy || task.pending}
              aria-pressed={verdict === value}
              onClick={() => {
                setVerdict(value);
                setConfirmation(false);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {verdict === "REJECT" && (
        <label className="comments-reason">
          原因码
          <input
            value={reason}
            disabled={task.busy || task.pending}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
      )}
      {verdict === "DELETE" && (
        <label className="comments-confirm-check">
          <input
            type="checkbox"
            checked={confirmation}
            disabled={task.busy || task.pending}
            onChange={(e) => setConfirmation(e.target.checked)}
          />
          确认删除这条评论，删除后将不再公开展示。
        </label>
      )}
      <button
        className="comments-primary primary comments-review-submit"
        disabled={
          task.busy ||
          !row.revisionId ||
          (verdict === "DELETE" && !confirmation)
        }
        onClick={() =>
          void task.run({
            verdict,
            revisionId: row.revisionId!,
            ...(reason.trim() ? { reasonCode: reason.trim() } : {}),
          })
        }
      >
        {task.busy
          ? "正在处理…"
          : task.pending
            ? "重试确认"
            : `确认${{ APPROVE: "通过", REJECT: "驳回", HIDE: "隐藏", RESTORE: "恢复", DELETE: "删除" }[verdict]}`}
      </button>
      {task.error && (
        <p className="comments-error" role="alert">
          {task.error}
        </p>
      )}
    </article>
  );
}
export function CommentModeration() {
  const { api, user } = useApp(),
    [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["comments", "moderation", user?.id, page],
    queryFn: ({ signal }) => api.commentModerationQueue(page, 20, signal),
    enabled: user?.role === "admin",
  });
  return (
    <section className="comments-moderation">
      <h2>评论审核</h2>
      <QueryState query={q}>
        {q.data?.items?.length ? (
          q.data.items.map((row) => (
            <ReviewRow key={row.revisionId} row={row} />
          ))
        ) : (
          <div className="comments-state">
            <Icon name="shield" size={30} />
            <p>没有待审核评论。</p>
          </div>
        )}
        <Pager
          page={page}
          hasNext={q.data?.hasNext}
          onChange={setPage}
          busy={q.isFetching}
        />
      </QueryState>
    </section>
  );
}
