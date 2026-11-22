import { BRAND_NAME } from "../../app/brand";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { PencilLine, Quote } from "lucide-react";
import { UserTitle } from "../../components/UserTitle";
import { userTitle } from "../../api/growth";
import {
  Link,
  Navigate,
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
import { DesignIcon as Icon, ReactionIcon } from "../../mobile/ui";
import { FoodCover } from "../../components/FoodCover";
import { ContentSkeleton } from "../../components/LoadingSkeleton";
import { Gate } from "../../components/ui";
import { ProfileEmpty, ProfilePageHead } from "../ProfilePage";
import { useSurfaceDismiss } from "../../motion/hooks";
import { CommentReactions } from "./CommentReactions";
import {
  useCommentCommand,
  useRefreshComments,
  commentError,
  commentTime,
  commentStatus,
} from "./state";
import "./comments.css";

type ReplyTarget = { rootId: number; id: number; name: string };
type ReplyEditor = {
  food: Food & { id: number };
  activeId?: number;
  open: (id: number) => void;
  close: () => void;
};
type ImageValue = { slot?: number | null; url?: string | null };
const validPage = (raw: string | null) => {
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : 1;
};
const commentsHref = (foodId: number) => `/comments?foodId=${foodId}`;
/**
 * A tapped tab keeps focus, and the browser's focus ring then hugs the 44px tap
 * target while the selected state only draws a 2px underline — together they read
 * as a stray box around the label. Pointer activations drop focus (keyboard ones
 * report detail === 0 and keep it, so the ring still works for Tab users).
 */
const dropPointerFocus = (event: MouseEvent<HTMLButtonElement>) => {
  if (event.detail > 0) event.currentTarget.blur();
};
function useCommentDetail(commentId: number) {
  const { api, user } = useApp();
  return useQuery({
    queryKey: ["comments", "detail", user?.id ?? "guest", commentId],
    queryFn: ({ signal }) => api.commentDetail(commentId, signal),
    retry: false,
  });
}

export function CommentDestination({
  commentId,
  desktop = false,
}: {
  commentId: number;
  desktop?: boolean;
}) {
  const query = useCommentDetail(commentId);
  const foodId = query.data?.foodId;
  return (
    <>
      <Link className="comments-back" to="/notifications">
        返回通知
      </Link>
      <QueryState query={query}>
        {foodId && (
          <Navigate
            replace
            to={
              desktop
                ? `/foods/${foodId}?section=comments&commentId=${commentId}`
                : `${commentsHref(foodId)}&commentId=${commentId}`
            }
          />
        )}
      </QueryState>
    </>
  );
}

function FocusedComment({
  commentId,
  foodId,
  editor,
  showAll,
}: {
  commentId: number;
  foodId: number;
  editor: ReplyEditor;
  showAll: () => void;
}) {
  const query = useCommentDetail(commentId);
  const item = query.data;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (item?.foodId === foodId)
      ref.current?.scrollIntoView?.({ block: "center" });
  }, [item?.id, foodId]);
  return (
    <div className="comments-focus" ref={ref}>
      <div className="comments-sort">
        <button onClick={showAll}>查看全部评论</button>
      </div>
      <QueryState query={query}>
        {item?.foodId === foodId && item.id === commentId ? (
          <CommentRow
            key={item.id}
            comment={item}
            rootId={item.rootId ?? undefined}
            nested={!!item.rootId}
            editor={editor}
            refresh={query.refetch}
          />
        ) : (
          <p className="comments-state">这条评论已删除或不可见</p>
        )}
      </QueryState>
    </div>
  );
}
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

export function defaultVisibleReplies(
  replyCount: number,
  contextCount = 2,
) {
  if (replyCount <= 0) return 0;
  if (contextCount <= 1) return replyCount <= 3 ? replyCount : 2;
  return replyCount <= 2 ? replyCount : 1;
}

export function fullReplyPreviewLimit(replyCount: number) {
  if (replyCount <= 0) return 0;
  return replyCount <= 3 ? replyCount : 2;
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
  const initialLiked = comment.isLiked;
  const q = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => api.commentLike(comment.id!, signal),
    enabled:
      visible &&
      !!session &&
      !!user &&
      !user.banned &&
      !!comment.id &&
      initialLiked == null,
    initialData:
      initialLiked == null || !comment.id
        ? undefined
        : {
            commentId: comment.id,
            liked: initialLiked === true,
            likesCount: comment.likesCount ?? 0,
            authorLikesCount: null,
          },
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
  const likes = q.data?.likesCount ?? comment.likesCount ?? 0;
  const toggleLike = async () => {
    if (!access(false) || !comment.id) return;
    const nextLiked = !liked;
    const previous = cache.getQueryData(key);
    cache.setQueryData(key, {
      commentId: comment.id,
      liked: nextLiked,
      likesCount: Math.max(0, likes + (nextLiked ? 1 : -1)),
      authorLikesCount: null,
    });
    const settled = await task.run(nextLiked);
    if (!settled) cache.setQueryData(key, previous);
  };
  return (
    <div ref={ref} className="comments-like">
      <button
        type="button"
        aria-label={liked ? "取消点赞" : "点赞"}
        aria-pressed={liked}
        disabled={
          task.busy ||
          (!!session && initialLiked == null && (q.isPending || q.isError))
        }
        onClick={() => void toggleLike()}
      >
        <ReactionIcon kind="like" size={17} />
        {likes > 0 && <b className="comments-like-count">{likes}</b>}
      </button>
      {q.isError && initialLiked == null && (
        <button
          type="button"
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

function CommentAuthor({
  comment,
  avatar = false,
}: {
  comment: CommentView;
  avatar?: boolean;
}) {
  const name = comment.authorName || "匿名用户";
  const authorId = parseId(String(comment.authorId));
  const src = avatar ? mediaUrl(comment.authorAvatar) : undefined;
  const [failedSrc, setFailedSrc] = useState<string>();
  const className = avatar ? "comments-avatar" : "comments-author";
  const content = avatar ? (
    src && src !== failedSrc ? (
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailedSrc(src)}
      />
    ) : (
      Array.from(name)[0]
    )
  ) : (
    <>
      {name}
      <UserTitle title={userTitle({ title: comment.authorTitle })} />
    </>
  );
  return authorId ? (
    <Link
      className={className}
      to={`/users/${authorId}`}
      aria-label={avatar ? `查看${name}的主页` : undefined}
    >
      {content}
    </Link>
  ) : (
    <span className={className} aria-hidden={avatar || undefined}>
      {content}
    </span>
  );
}

function CommentRow({
  comment,
  rootId,
  editor,
  refresh,
  nested = false,
}: {
  comment: CommentView;
  rootId?: number;
  editor: ReplyEditor;
  refresh: () => unknown;
  nested?: boolean;
}) {
  const { api, user } = useApp();
  const [expanded, setExpanded] = useState(false),
    [page, setPage] = useState(1);
  const knownReplyCount =
    !nested && typeof comment.replyCount === "number"
      ? comment.replyCount
      : null;
  const defaultLimit =
    knownReplyCount != null ? fullReplyPreviewLimit(knownReplyCount) : 0;
  const replies = useQuery({
    queryKey: ["comments", "replies", user?.id ?? "guest", comment.id, page],
    queryFn: ({ signal }) => api.commentReplies(comment.id!, page, 20, signal),
    enabled: !nested && !!comment.id && (expanded || defaultLimit > 0),
  });
  const totalReplies = replies.data?.totalItems ?? knownReplyCount;
  const items = replies.data?.items ?? [];
  const visibleReplies = expanded
    ? items
    : defaultLimit > 0
      ? items.slice(0, defaultLimit)
      : [];
  const hasCollapsedMore =
    !expanded && totalReplies != null && totalReplies > defaultLimit;
  const showToggle =
    !nested &&
    (knownReplyCount == null
      ? true
      : knownReplyCount > defaultLimit || expanded);
  const name = comment.authorName || "匿名用户";
  const replyButton = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const writing = comment.id != null && editor.activeId === comment.id;
  function closeReply() {
    editor.close();
    replyButton.current?.focus({ preventScroll: true });
  }
  return (
    <article
      className={`comments-row${nested ? " is-reply" : ""}`}
      aria-label={`${name}的${nested ? "回复" : "评论"}`}
    >
      <CommentAuthor comment={comment} avatar />
      <div className="comments-row-body">
        <div className="comments-byline">
          <strong>
            <CommentAuthor comment={comment} />
          </strong>
          <time dateTime={comment.createdAt ?? undefined}>
            {commentTime(comment.createdAt)}
          </time>
        </div>
        <p className="comments-text">
          {nested && comment.replyTo?.displayName && (
            <span className="comments-reply-target">
              回复 @{comment.replyTo.displayName}：
            </span>
          )}
          {comment.text}
        </p>
        <Pictures images={comment.images ?? []} refresh={refresh} />
        <div className="comments-actions">
          <Like comment={comment} />
          <button
            type="button"
            ref={replyButton}
            aria-expanded={writing}
            aria-controls={writing ? panelId : undefined}
            disabled={comment.id == null}
            onClick={() => (writing ? closeReply() : editor.open(comment.id!))}
          >
            <Icon name="comment" size={17} />
            回复
          </button>
          {comment.id != null && comment.reactions && (
            <CommentReactions
              commentId={comment.id}
              reactions={comment.reactions}
            />
          )}
          {showToggle && (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => {
                if (expanded) setPage(1);
                setExpanded((v) => !v);
              }}
            >
              {expanded
                ? defaultLimit > 0
                  ? "收起更多回复"
                  : "收起回复"
                : defaultLimit > 0 && hasCollapsedMore
                  ? `展开其余 ${totalReplies! - defaultLimit} 条回复`
                  : totalReplies != null
                    ? `查看回复 ${totalReplies}`
                    : "查看回复"}
              <Icon name={expanded ? "chevronUp" : "chevronDown"} size={15} />
            </button>
          )}
        </div>
        {writing && (
          <div id={panelId} className="comments-inline-editor">
            <CommentComposer
              embedded
              food={editor.food}
              target={{ rootId: rootId ?? comment.id!, id: comment.id!, name }}
              cancel={closeReply}
              after={closeReply}
            />
          </div>
        )}
        {!nested && (expanded || defaultLimit > 0) && (
          <div className="comments-replies">
            <QueryState query={replies}>
              {visibleReplies.length
                ? visibleReplies.map((reply) => (
                    <CommentRow
                      key={reply.id}
                      comment={reply}
                      rootId={comment.id!}
                      nested
                      editor={editor}
                      refresh={() => replies.refetch()}
                    />
                  ))
                : !replies.isPending &&
                  !replies.isError &&
                  expanded && <p className="comments-muted">还没有回复。</p>}
              {expanded && (
                <Pager
                  page={page}
                  hasNext={replies.data?.hasNext}
                  onChange={setPage}
                  busy={replies.isFetching}
                />
              )}
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
  embedded = false,
  cancel,
  after,
}: {
  food: Food & { id: number };
  target: ReplyTarget | null;
  embedded?: boolean;
  cancel?: () => void;
  after?: () => void;
}) {
  const app = useApp(),
    { campusId } = useArea(),
    refresh = useRefreshComments(),
    access = useActionAccess();
  const active = usePageLifetime();
  const fieldId = useId();
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
        {
          tone:
            value.moderationStatus === "APPROVED"
              ? "success"
              : value.moderationStatus === "REJECTED"
                ? "error"
                : "info",
        },
      );
      await refresh();
      if (active.current) after?.();
    },
  );
  const busy = uploading || task.busy;
  useEffect(() => {
    if (target || embedded) textarea.current?.focus();
  }, [target?.id, embedded]);
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
      const next = target ? [] : [...photos];
      if (next.some((p) => !p.key) && !access(true)) return;
      setUploading(true);
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
    <div className={`comments-composer${embedded ? " is-embedded" : ""}`}>
      {!embedded && (
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
      )}
      <form
        aria-label={target ? `回复 ${target.name}` : "发表评论"}
        onKeyDown={(e) => {
          if (
            e.key === "Escape" &&
            !e.nativeEvent.isComposing &&
            cancel &&
            !busy &&
            !task.pending
          ) {
            e.preventDefault();
            e.stopPropagation();
            cancel();
          }
        }}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="comments-compose-heading">
          <label htmlFor={fieldId}>
            {target ? `回复 ${target.name}` : "说说你的用餐感受"}
          </label>
          {cancel && (
            <button
              type="button"
              className="comments-icon"
              aria-label={target ? "取消回复" : "收起评论框"}
              disabled={busy || task.pending}
              onClick={cancel}
            >
              <Icon name="close" size={18} />
            </button>
          )}
        </div>
        <textarea
          id={fieldId}
          aria-describedby={`${fieldId}-limit`}
          aria-invalid={codePoints(text.trim()) > 200}
          ref={textarea}
          placeholder={target ? "写下你的回复…" : "口味、分量，或一点用餐建议"}
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
        {!target && (
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
                  <Icon name="close" size={18} />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="comments-compose-footer">
          <div className="comments-compose-tools">
            {!target && (
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
            )}
            <span
              id={`${fieldId}-limit`}
              className={codePoints(text.trim()) > 200 ? "comments-error" : ""}
            >
              {codePoints(text.trim())}/200
            </span>
          </div>
          {!target && (
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
        </div>
        {(error || task.error) && (
          <p className="comments-error" role="alert">
            {error || task.error}
          </p>
        )}
      </form>
    </div>
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
  const linkedRoot = parseId(params.get("rootId") ?? undefined);
  const replyId = parseId(params.get("replyToId") ?? undefined) ?? linkedRoot;
  const [entryKey] = useState(loc.key);
  // On a direct link or reload the recipient may be on another page or in a collapsed thread.
  const focused =
    parseId(params.get("commentId") ?? undefined) ??
    (linkedRoot || loc.key === entryKey ? replyId : undefined);
  const writingRoot = !mobile && !replyId && params.get("compose") === "1";
  const section = params.get("section");
  const writeButton = useRef<HTMLButtonElement>(null);
  const Heading = mobile ? "h1" : "h2";
  const sort: CommentSort =
    params.get("sort") === "NEWEST" ? "NEWEST" : "MOST_USEFUL";
  const page = validPage(params.get("commentPage"));
  const q = useQuery({
    queryKey: ["comments", "list", user?.id ?? "guest", food.id, sort, page],
    queryFn: ({ signal }) => api.foodComments(food.id, sort, page, 20, signal),
    enabled: !gallery && !focused,
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
        if (focused) next.set("commentId", String(focused));
        for (const key of ["rootId", "replyToId", "name", "compose"])
          next.delete(key);
        for (const [k, v] of Object.entries(patch))
          v == null ? next.delete(k) : next.set(k, v);
        return next;
      },
      {
        replace: true,
        preventScrollReset: true,
        state: { ...loc.state, preserveScroll: true },
      },
    );
  const editor: ReplyEditor = {
    food,
    activeId: replyId,
    open: (id) => {
      if (!access(false)) return;
      change({ replyToId: String(id) });
    },
    close: () => change({}),
  };
  const closeRoot = () => {
    change({});
    writeButton.current?.focus({ preventScroll: true });
  };
  useEffect(() => {
    if (
      !mobile &&
      !focused &&
      section === "comments" &&
      !writingRoot &&
      !replyId
    ) {
      const frame = requestAnimationFrame(() => discussionScroll("instant"));
      return () => cancelAnimationFrame(frame);
    }
  }, [food.id, mobile, section, focused]);
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
        {!mobile && (
          <button
            className="comments-write"
            type="button"
            ref={writeButton}
            aria-expanded={writingRoot}
            aria-controls={writingRoot ? "discussion-composer" : undefined}
            onClick={() =>
              writingRoot ? closeRoot() : change({ compose: "1" })
            }
          >
            <PencilLine size={16} aria-hidden="true" />
            写评论
          </button>
        )}
      </header>
      {writingRoot && (
        <div id="discussion-composer">
          <CommentComposer
            embedded
            food={food}
            target={null}
            cancel={closeRoot}
            after={closeRoot}
          />
        </div>
      )}
      <div className="comments-layout">
        <div className="comments-toolbar">
          <div className="comments-tabs" role="group" aria-label="讨论内容">
            <button
              aria-pressed={!gallery}
              onClick={(event) => {
                dropPointerFocus(event);
                change({ view: null, commentPage: null, commentId: null });
              }}
            >
              评论
            </button>
            <button
              aria-pressed={gallery}
              onClick={(event) => {
                dropPointerFocus(event);
                change({ view: "gallery", commentPage: null, commentId: null });
              }}
            >
              晒图
            </button>
          </div>
          {!gallery && !focused && (
            <div className="comments-sort" role="group" aria-label="评论排序">
              {(
                [
                  ["MOST_USEFUL", "最热"],
                  ["NEWEST", "最新"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  aria-pressed={sort === value}
                  onClick={(event) => {
                    dropPointerFocus(event);
                    change({ sort: value, commentPage: null });
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="comments-list">
          {gallery ? (
            <Gallery query={g} />
          ) : focused ? (
            <FocusedComment
              foodId={food.id}
              commentId={focused}
              editor={editor}
              showAll={() => change({ commentId: null })}
            />
          ) : (
            <QueryState query={q} empty={!q.data?.items?.length}>
              {q.data?.items?.map((comment) => (
                <CommentRow
                  key={comment.id}
                  comment={comment}
                  editor={editor}
                  refresh={() => q.refetch()}
                />
              ))}
            </QueryState>
          )}
          {!focused && (
            <Pager
              page={page}
              hasNext={gallery ? g.data?.hasNext : q.data?.hasNext}
              busy={gallery ? g.isFetching : q.isFetching}
              onChange={(n) => change({ commentPage: String(n) })}
            />
          )}
        </div>
      </div>
      {mobile && (
        <div className="comments-mobile-bar">
          <button
            className="comments-input-trigger"
            onClick={() => {
              if (access(false))
                nav(`/comments/write?foodId=${food.id}`, {
                  state: { commentList: loc.pathname + loc.search },
                });
            }}
          >
            吃过的话，说两句
          </button>
          <button
            className="comments-icon"
            aria-label="发表带图片的评论"
            onClick={() => {
              if (access(true))
                nav(`/comments/write?foodId=${food.id}`, {
                  state: { commentList: loc.pathname + loc.search },
                });
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

function PreviewReplies({
  foodId,
  comment,
  rootCount,
}: {
  foodId: number;
  comment: CommentView;
  rootCount: number;
}) {
  const { api, user } = useApp();
  const replyCount = comment.replyCount ?? 0;
  const limit = defaultVisibleReplies(replyCount, rootCount);
  const q = useQuery({
    queryKey: ["comments", "replies", user?.id ?? "guest", comment.id, "preview"],
    queryFn: ({ signal }) => api.commentReplies(comment.id!, 1, 3, signal),
    enabled: limit > 0 && !!comment.id,
  });
  if (limit <= 0) return null;
  const shown = (q.data?.items ?? []).slice(0, limit);
  const total = q.data?.totalItems ?? replyCount;
  if (!shown.length && q.isError) return null;
  if (!shown.length && !q.isPending) return null;
  return (
    <div className="comments-preview-replies">
      {shown.map((reply) => (
        <div className="comments-preview-reply" key={reply.id}>
          <div className="comments-preview-reply-copy">
            <strong>
              <CommentAuthor comment={reply} />
            </strong>
            <Link className="comments-preview-reply-text" to={commentsHref(foodId)}>
              {reply.replyTo?.displayName &&
                reply.replyTo.id !== comment.authorId && (
                  <span className="comments-reply-target">
                    回复 @{reply.replyTo.displayName}：
                  </span>
                )}
              {reply.text}
            </Link>
          </div>
          <div className="comments-preview-actions">
            <Like comment={reply} />
          </div>
        </div>
      ))}
      {total > shown.length && (
        <Link className="comments-preview-more-replies" to={commentsHref(foodId)}>
          查看全部 {total} 条回复 <Icon name="chevronRight" size={14} />
        </Link>
      )}
    </div>
  );
}

export function FoodCommentPreview({ foodId }: { foodId: number }) {
  const { api, user } = useApp();
  const q = useQuery({
    queryKey: ["comments", "preview", user?.id ?? "guest", foodId],
    queryFn: ({ signal }) =>
      api.foodComments(foodId, "MOST_USEFUL", 1, 2, signal),
  });
  const items = q.data?.items ?? [];
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
      ) : items.length ? (
        items.map((row) => (
          <div className="comments-preview-item" key={row.id}>
            <div className="comments-preview-row">
              <div className="comments-preview-main">
                <CommentAuthor comment={row} avatar />
                <div className="comments-preview-body">
                  <strong>
                    <CommentAuthor comment={row} />
                  </strong>
                  <Link
                    className="comments-preview-text"
                    to={commentsHref(foodId)}
                  >
                    {row.text}
                  </Link>
                </div>
              </div>
              <div className="comments-preview-actions">
                <Like comment={row} />
              </div>
            </div>
            {row.id != null && row.reactions && (
              <CommentReactions commentId={row.id} reactions={row.reactions} />
            )}
            <PreviewReplies
              foodId={foodId}
              comment={row}
              rootCount={items.length}
            />
          </div>
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
  const commentId = parseId(params.get("commentId") ?? undefined);
  const rootId = parseId(params.get("rootId") ?? undefined),
    replyId = parseId(params.get("replyToId") ?? undefined);
  const writing = loc.pathname.endsWith("/write");
  const source =
    typeof loc.state?.commentList === "string" ? loc.state.commentList : "";
  const sourceParams = new URLSearchParams(source.split("?")[1]);
  const fromComments =
    source.split("?")[0] === "/comments" &&
    parseId(sourceParams.get("foodId") ?? undefined) === foodId;
  const q = useQuery({
    queryKey: ["food", foodId],
    queryFn: () => api.food(foodId!),
    enabled: !!foodId,
  });
  const back = foodId
    ? writing
      ? fromComments
        ? source
        : commentsHref(foodId)
      : `/foods/${foodId}`
    : "/";
  useEffect(() => {
    document.title = `${writing ? "发表评论" : "菜品评论"} · ${BRAND_NAME}`;
  }, [writing]);
  if (!foodId && commentId && !writing)
    return (
      <main className="comments-mobile-page">
        <CommentDestination commentId={commentId} />
      </main>
    );
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
              after={() => {
                if (fromComments) nav(-1);
                else nav(commentsHref(foodId), { replace: true });
              }}
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

function DeleteSubmission({
  row,
  showIcon = false,
}: {
  row: CommentSubmission;
  showIcon?: boolean;
}) {
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
          {showIcon && <Icon name="delete" size={15} />}
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

function MyCommentRecord({
  row,
  journal,
}: {
  row: CommentSubmission;
  journal: boolean;
}) {
  const reply = row.kind === "REPLY";
  const reason = row.reasonMessage || row.reasonCode;
  const time = (
    <time dateTime={row.createdAt ?? undefined}>
      {commentTime(row.createdAt)}
    </time>
  );
  const content = (
    <>
      <p className="comments-text">
        {row.moderationStatus === "DELETED" ? "评论已删除" : row.text}
      </p>
      {!!row.imageCount && (
        <span className="comments-muted">
          <Icon name="image" size={15} /> {row.imageCount} 张图片
        </span>
      )}
      {row.moderationStatus === "REJECTED" && reason && (
        <p className="comments-rejection">
          {journal && <strong>未通过原因</strong>}
          {reason}
        </p>
      )}
    </>
  );
  return (
    <article
      className={`comments-submission${journal ? " comments-journal-note" : ""}`}
    >
      <header className="comments-submission-heading">
        {journal && time}
        {(!journal || reply) && <span>{reply ? "回复" : "评论"}</span>}
        <span className="comments-status" data-status={row.moderationStatus}>
          {commentStatus(row.moderationStatus)}
        </span>
        {!journal && time}
      </header>
      {journal ? (
        <div className="comments-journal-body">
          <Quote aria-hidden="true" size={24} />
          <div>{content}</div>
        </div>
      ) : (
        content
      )}
      <footer className="comments-submission-actions">
        {row.foodId && (
          <Link to={`/foods/${row.foodId}?section=comments`}>
            {journal && <Icon name="bowl" size={17} />}
            查看菜品 <Icon name="chevronRight" size={14} />
          </Link>
        )}
        <DeleteSubmission row={row} showIcon={journal} />
      </footer>
    </article>
  );
}

export function MyFoodComments({
  emptyState,
  journal = false,
}: { emptyState?: ReactNode; journal?: boolean } = {}) {
  const { api, user } = useApp(),
    [params, setParams] = useSearchParams();
  const page = validPage(params.get("page"));
  const q = useQuery({
    queryKey: ["comments", "mine", user?.id, page],
    queryFn: ({ signal }) => api.myCommentSubmissions(page, 20, signal),
    enabled: !!user?.id,
  });
  const items = q.data?.items ?? [];
  const total = q.data?.totalItems;
  const records = items.map((row) => (
    <MyCommentRecord key={row.revisionId ?? row.id} row={row} journal={journal} />
  ));
  return (
    <div className={`comments-my-list${journal ? " comments-journal" : ""}`}>
      {journal && (
        <ProfilePageHead
          title="我的评论"
          count={total && total > 0 ? `${total} 条` : undefined}
        />
      )}
      <QueryState query={q}>
        {items.length ? (
          journal ? (
            <div className="comments-journal-grid">{records}</div>
          ) : (
            records
          )
        ) : (
          emptyState ??
          (journal ? (
            <ProfileEmpty
              illustration="jiaozi"
              title={page > 1 ? "这一页没有评论" : "还没写过评论"}
            >
              {page === 1 && <Link className="pp-button" to="/">去发现</Link>}
            </ProfileEmpty>
          ) : (
            <div className="comments-state">
              <Icon name="comment" size={30} />
              <p>还没有评论记录。</p>
              <Link to="/">去发现好味道</Link>
            </div>
          ))
        )}
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
