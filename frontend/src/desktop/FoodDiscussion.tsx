import { useFeedbackState } from "../components/feedback";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { isDemo } from "../app/runtime";
import { errorMessage } from "../api/client";
import { mediaUrl, type Food } from "../api/models";
import { validateFiles } from "../api/validation";
import {
  addMessage,
  readDiscussion,
  saveDiscussion,
  toggleHelpful,
  type Discussion,
  type Reply,
  type myCommentEntries,
} from "../demo/comments";
import { DesignIcon as Icon } from "../mobile/ui";
import { MotionRegion, SlidingTabs } from "./motion";
import { useSurfaceDismiss } from "../motion/hooks";
import "./discussion.css";

function timeLabel(time: number) {
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} 小时前`;
  return `${Math.floor(minutes / 1440)} 天前`;
}
export function discussionScroll(behavior: ScrollBehavior = "smooth") {
  document.getElementById("food-discussion")?.scrollIntoView({
    block: "start",
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : behavior,
  });
}
function Avatar({ entry }: { entry: Pick<Reply, "name" | "avatar"> }) {
  const src = mediaUrl(entry.avatar);
  return (
    <span className="food-comment-avatar">
      {src ? <img src={src} alt="" /> : entry.name.slice(0, 1)}
    </span>
  );
}

export default function FoodDiscussion({ food }: { food: Food }) {
  const app = useApp(),
    cache = useQueryClient(),
    location = useLocation();
  const key = ["demo-comments", food.id];
  const query = useQuery({
    queryKey: key,
    queryFn: () => readDiscussion(food),
    enabled: isDemo,
    retry: false,
  });
  const [sort, setSort] = useState("helpful"),
    [expanded, setExpanded] = useState<string[]>([]);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [text, setText] = useState(""),
    [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useFeedbackState(),
    [notice, setNotice] = useFeedbackState("success");
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null),
    input = useRef<HTMLInputElement>(null),
    photoDialog = useRef<HTMLDialogElement>(null);
  const lock = useRef(false);
  const dismissPhoto = useSurfaceDismiss(photoDialog, () => setViewPhoto(null));
  const discussion = query.data,
    comments = [...(discussion?.comments ?? [])].sort((a, b) =>
      sort === "newest"
        ? b.createdAt - a.createdAt
        : b.helpful - a.helpful || b.createdAt - a.createdAt,
    );
  const available =
    isDemo && !!app.user && app.user.verified === true && !app.user.banned;
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("section") !== "comments") return;
    const frame = requestAnimationFrame(() => {
      discussionScroll("instant");
      if (params.get("compose") === "1")
        textarea.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [location.search, location.key, food.id]);
  useEffect(() => {
    if (viewPhoto) photoDialog.current?.showModal();
  }, [viewPhoto]);

  function update(next: Discussion) {
    saveDiscussion(next);
    cache.setQueryData(key, next);
    void cache.invalidateQueries({ queryKey: ["demo-my-comments"] });
  }
  function reply(id: string, name: string) {
    setReplyTo({ id, name });
    setNotice("");
    textarea.current?.focus();
  }
  async function addPhotos(files: File[]) {
    if (!available || lock.current || !files.length) return;
    setError("");
    try {
      if (photos.length + files.length > 3)
        throw new Error("每条评论最多添加 3 张图片。");
      validateFiles(files, photos.length);
      lock.current = true;
      setBusy(true);
      const { demoUpload } = await import("../demo/transport");
      const images = await Promise.all(
        files.map((file) => demoUpload(file, "comments")),
      );
      setPhotos((current) => [...current, ...images]);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function images(items: string[], small = false) {
    return (
      items.length > 0 && (
        <div className={`food-comment-images ${small ? "is-small" : ""}`}>
          {items.map((src, index) => (
            <button
              key={index}
              type="button"
              aria-label={`查看评论图片 ${index + 1}`}
              onClick={() => setViewPhoto(src)}
            >
              <img
                src={mediaUrl(src)}
                alt={`用餐实拍 ${index + 1}`}
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )
    );
  }
  return (
    <section
      id="food-discussion"
      className="food-discussion"
      aria-labelledby="food-discussion-title"
    >
      <header className="food-discussion-heading">
        <div>
          <span className="pc-eyebrow">这道菜，听听食友怎么说</span>
          <h2 id="food-discussion-title">
            吃过的人说<span>{isDemo ? comments.length : "—"}</span>
            {isDemo && <small>本地演示</small>}
          </h2>
        </div>
        <SlidingTabs label="评论排序" active={sort}>
          {[
            { id: "helpful", name: "最有用" },
            { id: "newest", name: "最新" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={sort === tab.id}
              tabIndex={sort === tab.id ? 0 : -1}
              onClick={() => setSort(tab.id)}
            >
              {tab.name}
            </button>
          ))}
        </SlidingTabs>
      </header>
      <div className="food-discussion-layout">
        <div className="food-discussion-list">
          {!isDemo ? (
            <div className="food-comment-empty">
              <Icon name="comment" size={32} />
              <h3>食友讨论，敬请期待</h3>
              <p>先收藏这道菜，等你来分享吃过的感受。</p>
            </div>
          ) : query.error ? (
            <div className="pc-error" role="alert">
              {errorMessage(query.error)}
              <button type="button" onClick={() => void query.refetch()}>
                重新加载
              </button>
            </div>
          ) : (
            <MotionRegion
              changeKey={sort}
              order={sort === "helpful" ? 0 : 1}
              reserveSpace
            >
              {!comments.length && (
                <div className="food-comment-empty">
                  <Icon name="comment" size={32} />
                  <h3>这道菜还在等第一条评价</h3>
                  <p>口味、分量、排队时间，都可以聊聊。</p>
                  <button
                    type="button"
                    className="pc-small-link"
                    onClick={() => textarea.current?.focus()}
                  >
                    我来分享
                    <Icon name="edit" size={15} />
                  </button>
                </div>
              )}
              {comments.map((comment) => (
                <article
                  className="food-comment"
                  key={comment.id}
                  aria-label={`${comment.name}的评论`}
                >
                  <Avatar
                    entry={
                      comment.userId === app.user?.id
                        ? {
                            ...comment,
                            name: app.user.displayName ?? comment.name,
                            avatar: app.user.avatar,
                          }
                        : comment
                    }
                  />
                  <div className="food-comment-body">
                    <div className="food-comment-byline">
                      <strong>
                        {comment.userId === app.user?.id
                          ? (app.user?.displayName ?? comment.name)
                          : comment.name}
                      </strong>
                      {comment.userId === app.user?.id && <span>我</span>}
                      <time
                        dateTime={new Date(comment.createdAt).toISOString()}
                      >
                        {timeLabel(comment.createdAt)}
                      </time>
                    </div>
                    <p>{comment.text}</p>
                    {images(comment.images)}
                    <div className="food-comment-actions">
                      <button
                        type="button"
                        aria-label={`觉得${comment.name}的评论有用`}
                        aria-pressed={comment.liked}
                        disabled={!available}
                        onClick={() => {
                          try {
                            update(toggleHelpful(discussion!, comment.id));
                            setError("");
                          } catch (e) {
                            setError(errorMessage(e));
                          }
                        }}
                      >
                        <Icon
                          name={comment.liked ? "heartOn" : "heart"}
                          size={17}
                        />
                        有用<span>{comment.helpful}</span>
                      </button>
                      <button
                        type="button"
                        disabled={!available}
                        onClick={() =>
                          reply(
                            comment.id,
                            comment.userId === app.user?.id
                              ? (app.user.displayName ?? comment.name)
                              : comment.name,
                          )
                        }
                      >
                        <Icon name="comment" size={16} />
                        回复
                      </button>
                    </div>
                    {comment.replies.length > 0 && (
                      <div className="food-comment-replies">
                        {(expanded.includes(comment.id)
                          ? comment.replies
                          : comment.replies.slice(0, 2)
                        ).map((item) => (
                          <div key={item.id} className="food-comment-reply">
                            <p>
                              <strong>
                                {item.userId === app.user?.id
                                  ? (app.user.displayName ?? item.name)
                                  : item.name}
                              </strong>
                              <span>{item.text}</span>
                            </p>
                            {images(item.images, true)}
                          </div>
                        ))}
                        {comment.replies.length > 2 && (
                          <button
                            type="button"
                            className="food-comment-expand"
                            aria-expanded={expanded.includes(comment.id)}
                            onClick={() =>
                              setExpanded((current) =>
                                current.includes(comment.id)
                                  ? current.filter((id) => id !== comment.id)
                                  : [...current, comment.id],
                              )
                            }
                          >
                            {expanded.includes(comment.id)
                              ? "收起回复"
                              : `展开全部 ${comment.replies.length} 条回复`}
                            <Icon
                              name={
                                expanded.includes(comment.id)
                                  ? "chevronUp"
                                  : "chevronDown"
                              }
                              size={14}
                            />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </MotionRegion>
          )}
        </div>
        <aside className="food-comment-composer" aria-label="评论当前菜品">
          <div className="food-comment-dish">
            {mediaUrl(food.pictureUrl?.[0]) && (
              <img src={mediaUrl(food.pictureUrl?.[0])} alt="当前讨论的菜品" />
            )}
            <div>
              <small>正在聊这道菜</small>
              <strong>{food.name}</strong>
              <span>{food.restaurantName}</span>
            </div>
          </div>
          <form
            aria-label="发表评论"
            onSubmit={(event) => {
              event.preventDefault();
              if (!available || lock.current || !discussion) return;
              lock.current = true;
              setError("");
              try {
                update(
                  addMessage(discussion, app.user!, text, photos, replyTo?.id),
                );
                if (replyTo)
                  setExpanded((current) =>
                    current.includes(replyTo.id)
                      ? current
                      : [...current, replyTo.id],
                  );
                else setSort("newest");
                setNotice(
                  replyTo
                    ? "回复已保存在本地演示中。"
                    : "评论已保存在本地演示中。",
                );
                setText("");
                setPhotos([]);
                setReplyTo(null);
              } catch (e) {
                setError(errorMessage(e));
              } finally {
                lock.current = false;
              }
            }}
          >
            <div className="food-comment-compose-heading">
              <h3>
                {replyTo ? `回复 ${replyTo.name}` : "你觉得这道菜怎么样？"}
              </h3>
              {replyTo && (
                <button
                  type="button"
                  aria-label="取消回复"
                  onClick={() => setReplyTo(null)}
                >
                  <Icon name="close" size={17} />
                </button>
              )}
            </div>
            <textarea
              ref={textarea}
              aria-label="写下你的用餐感受"
              placeholder={
                isDemo
                  ? "聊聊口味、分量，或给下次来吃的食友一点建议…"
                  : "评论功能正在准备中，敬请期待"
              }
              maxLength={500}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              value={text}
              disabled={!available || busy}
              onChange={(event) => {
                setText(event.target.value);
                setNotice("");
              }}
            />
            <div className="food-comment-draft-images">
              {photos.map((src, index) => (
                <span key={index}>
                  <img src={src} alt={`待发布图片 ${index + 1}`} />
                  <button
                    type="button"
                    aria-label={`移除评论图片 ${index + 1}`}
                    disabled={busy}
                    onClick={() =>
                      setPhotos((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                  >
                    <Icon name="close" size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="food-comment-compose-tools">
              <button
                type="button"
                disabled={!available || busy || photos.length >= 3}
                onClick={() => input.current?.click()}
              >
                <Icon name="image" size={17} />
                添加图片<span>{photos.length}/3</span>
              </button>
              <span>{text.length}/500</span>
            </div>
            <input
              ref={input}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              hidden
              aria-label="添加评论图片"
              onChange={(event) => {
                void addPhotos(Array.from(event.target.files ?? []));
                event.target.value = "";
              }}
            />

            <button
              type="submit"
              className="pc-button"
              disabled={!available || busy || !text.trim()}
            >
              {busy ? "正在读取图片…" : replyTo ? "发表回复" : "发表评论"}
              <Icon name="chevronRight" size={17} />
            </button>
            <p className="food-comment-local-note">
              {isDemo
                ? "当前为本地演示，评论与图片仅保存在此浏览器，不会发送给其他人。"
                : "评论开放后，就能在这里分享用餐感受。"}
            </p>
          </form>
        </aside>
      </div>
      {viewPhoto && (
        <dialog
          ref={photoDialog}
          className="food-comment-photo-dialog"
          aria-label="评论图片预览"
          onCancel={(e) => {
            e.preventDefault();
            dismissPhoto();
          }}
        >
          <button
            type="button"
            className="pc-icon-button"
            aria-label="关闭评论图片"
            onClick={dismissPhoto}
          >
            <Icon name="close" size={23} />
          </button>
          <img src={mediaUrl(viewPhoto)} alt="用餐实拍大图" />
        </dialog>
      )}
    </section>
  );
}

export function MyFoodComments({
  entries,
}: {
  entries: ReturnType<typeof myCommentEntries>;
}) {
  if (!isDemo || !entries.length)
    return (
      <div className="food-comment-empty">
        <Icon name="comment" size={34} />
        <h3>{isDemo ? "还没有留下用餐感受" : "食友讨论，敬请期待"}</h3>
        <p>
          {isDemo
            ? "在菜品详情里评论、回复，会在这里留下记录。"
            : "评论功能正在准备中，可以先去发现一道好吃的。"}
        </p>
        <Link className="pc-button light" to="/">
          发现一道好吃的
        </Link>
      </div>
    );
  return (
    <div className="food-my-comments">
      <p className="pc-small-note">
        本地演示中的评论与回复，点击回到对应菜品。
      </p>
      {entries.map((entry) => (
        <Link to={`/foods/${entry.foodId}?section=comments`} key={entry.id}>
          <div className="food-my-comment-heading">
            {mediaUrl(entry.picture) && (
              <img src={mediaUrl(entry.picture)} alt="" />
            )}
            <span>
              <strong>{entry.foodName}</strong>
              <small>{entry.restaurantName}</small>
            </span>
            <Icon name="chevronRight" size={19} />
          </div>
          <p>{entry.text}</p>
          <small>
            {entry.reply ? "回复" : "评论"} · {timeLabel(entry.createdAt)}
          </small>
        </Link>
      ))}
    </div>
  );
}
