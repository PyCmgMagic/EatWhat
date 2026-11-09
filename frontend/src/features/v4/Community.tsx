import { DesignIcon as Icon } from "../../mobile/ui";
import { RestaurantCard, TopicCard, TopicHero } from "./Cards";
import { useEffect, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApp } from "../../app/state";
import {
  useMemoryDraft,
  usePageLifetime,
  useSessionDraft,
} from "../../app/drafts";
import { LoginLink } from "../../app/auth-dialog";
import { useArea } from "../../app/area";
import { type Schema, money, mediaUrl } from "../../api/models";
import { CatalogCard } from "../Catalog";
import { ProfileSectionNav } from "../ProfileSectionNav";
import "../profile-activity.css";
import {
  Card,
  Shell,
  Field,
  Badge,
  QueryView,
  Pager,
  useCommand,
  CommandState,
  statusText,
  timeText,
  safeLink,
} from "./shared";

type TargetType = "FOOD" | "RESTAURANT" | "COMMENT" | "USER";
const reasons = {
  WRONG_NAME: "店名不正确",
  WRONG_LOCATION: "位置不准确",
  CLOSED: "店铺已停业",
  DUPLICATE: "重复店铺",
  OTHER: "其他问题",
  NOT_REAL_PHOTO: "非真实照片",
  ADVERTISING: "广告信息",
  ILLEGAL_OR_UNFRIENDLY: "不友善或违规内容",
};
export function FeedbackForm({
  kind = "feedback",
}: {
  kind?: "feedback" | "report" | "catalog";
}) {
  const app = useApp(),
    nav = useNavigate(),
    location = useLocation(),
    [params] = useSearchParams(),
    task = useCommand();
  const targetId = Number(params.get("id") ?? params.get("restaurantId")),
    rawType = params.get("type"),
    targetType: TargetType = ["FOOD", "RESTAURANT", "COMMENT", "USER"].includes(
      rawType ?? "",
    )
      ? (rawType as TargetType)
      : kind === "catalog"
        ? "RESTAURANT"
        : "FOOD";
  const validTarget = Number.isSafeInteger(targetId) && targetId > 0;
  const active = usePageLifetime();
  const draftKey = `feedback:${app.user?.id}:${kind}:${targetType}:${validTarget ? targetId : "general"}`;
  const [draft, setDraft, clearDraft] = useSessionDraft(draftKey, {
    text: "",
    reason: kind === "catalog" ? "WRONG_NAME" : "OTHER",
  });
  const [attachments, setAttachments, clearAttachments] = useMemoryDraft<{
    files: File[];
    keys: string[];
  }>(draftKey, { files: [], keys: [] });
  const { text, reason } = draft;
  const textLimit = kind === "feedback" ? 500 : 2000;
  const { files, keys } = attachments;
  useEffect(() => {
    if (!files.length) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [files.length]);
  const setText = (text: string) => setDraft((d) => ({ ...d, text }));
  const setReason = (reason: string) => setDraft((d) => ({ ...d, reason }));
  const setFiles = (files: File[]) => setAttachments((d) => ({ ...d, files }));
  const setKeys = (keys: string[]) => setAttachments((d) => ({ ...d, keys }));
  const source = location.state?.returnTo;
  const back =
    typeof source === "string" && /^\/(?!\/)/.test(source)
      ? source
      : kind === "feedback"
        ? "/help"
        : validTarget
          ? `/${targetType === "RESTAURANT" ? "restaurants" : targetType === "USER" ? "users" : "foods"}/${targetId}`
          : "/";
  const options =
    kind === "catalog"
      ? ["WRONG_NAME", "WRONG_LOCATION", "CLOSED", "DUPLICATE", "OTHER"]
      : ["NOT_REAL_PHOTO", "ADVERTISING", "ILLEGAL_OR_UNFRIENDLY", "OTHER"];
  return (
    <Shell
      back={back}
      title={
        kind === "report"
          ? "举报内容"
          : kind === "catalog"
            ? "店铺信息有误"
            : "意见反馈"
      }
      detail="每一条建议都会进入你的反馈记录，处理后可查看回复。"
    >
      {kind === "feedback" && <ProfileSectionNav section="help" />}
      <Card>
        <div className="v4-form-intro">
          <div>
            <span className="v4-kicker">你的声音，我们认真听</span>
            <h2>{kind === "feedback" ? "说说你的想法" : "补充问题信息"}</h2>
          </div>
          {kind !== "feedback" && (
            <Link
              to="/feedback/mine"
              state={{
                feedbackReturnTo: location.pathname + location.search,
                feedbackSource: back,
              }}
            >
              <Icon name="document" size={16} />
              反馈记录
            </Link>
          )}
        </div>
        {kind !== "feedback" && !validTarget ? (
          <p>
            请从菜品、店铺或食友详情发起此操作。<Link to="/">返回发现</Link>
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void task.run(
                async (command) => {
                  if (kind === "feedback" && !text.trim())
                    throw new Error("请填写反馈内容。");
                  if ([...text].length > textLimit)
                    throw new Error(`内容最多填写 ${textLimit} 个字。`);
                  if (kind === "feedback") {
                    let uploaded = keys;
                    if (files.length && keys.length !== files.length) {
                      uploaded = await app.uploadMany(files, "feedback");
                      setKeys(uploaded);
                    }
                    return app.api.createFeedback(
                      {
                        text: text.trim(),
                        screenshotKeys: uploaded,
                        context: validTarget
                          ? { type: targetType, id: targetId }
                          : undefined,
                      },
                      command,
                    );
                  }
                  if (kind === "catalog")
                    return app.api.createCatalogError(
                      {
                        restaurantId: targetId,
                        errorType:
                          reason as Schema["CatalogErrorInputRequest"]["errorType"],
                        note: text.trim(),
                      },
                      command,
                    );
                  return app.api.createReport(
                    {
                      targetType,
                      targetId,
                      reason: reason as Schema["ReportInputRequest"]["reason"],
                      note: text.trim(),
                    },
                    command,
                  );
                },
                (result) => {
                  clearDraft();
                  clearAttachments();
                  if (active.current)
                    nav(`/feedback/mine/${result.id}`, {
                      state: {
                        feedbackReturnTo: location.pathname + location.search,
                        feedbackSource: back,
                      },
                    });
                },
              );
            }}
          >
            <fieldset disabled={task.busy || task.uncertain}>
              {kind !== "feedback" && (
                <Field label="问题类型">
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  >
                    {options.map((x) => (
                      <option key={x} value={x}>
                        {reasons[x as keyof typeof reasons]}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label={kind === "feedback" ? "反馈内容" : "补充说明"}>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={textLimit}
                  placeholder={
                    kind === "feedback"
                      ? "有什么建议，或遇到了什么问题？可以具体说说…"
                      : "补充一些细节，帮助我们更准确地了解问题…"
                  }
                  required={kind === "feedback"}
                />
              </Field>
              <span className="v4-field-counter">
                {[...text].length} / {textLimit}
              </span>
              {kind === "feedback" && (
                <Field label="截图（可选）" hint="最多 3 张图片。">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={(e) => {
                      const selected = [...(e.target.files ?? [])];
                      if (
                        selected.length > 3 ||
                        selected.some(
                          (f) =>
                            !f.type.startsWith("image/") ||
                            f.size > 8 * 1024 * 1024,
                        )
                      ) {
                        task.say("请选择最多 3 张、每张不超过 8MB 的图片。");
                        return;
                      }
                      setFiles(selected);
                      setKeys([]);
                    }}
                  />
                </Field>
              )}
              {!!files.length && (
                <div className="v4-upload-files">
                  {files.map((file, i) => (
                    <span key={i}>
                      <Icon name="image" size={15} />
                      {file.name}
                    </span>
                  ))}
                </div>
              )}
              <button className="primary" type="submit">
                {task.busy ? "正在提交…" : "提交"}
              </button>
            </fieldset>
            <CommandState task={task} />
          </form>
        )}
      </Card>
    </Shell>
  );
}
export function FeedbackRecords({ id }: { id?: number }) {
  const { api } = useApp(),
    location = useLocation(),
    [page, setPage] = useState(1),
    list = useQuery({
      queryKey: ["feedback", "mine", page],
      queryFn: () => api.myFeedback({ page, pageSize: 12 }),
      enabled: !id,
    }),
    detail = useQuery({
      queryKey: ["feedback", "detail", id],
      queryFn: () => api.feedbackCase(id!),
      enabled: !!id,
    });
  if (id)
    return (
      <Shell title="反馈处理进度" back="/feedback/mine">
        <ProfileSectionNav section="help" />
        <QueryView query={detail}>
          {detail.data && <CaseContent value={detail.data} />}
        </QueryView>
      </Shell>
    );
  return (
    <Shell
      title="反馈记录"
      back={
        typeof location.state?.feedbackReturnTo === "string" &&
        /^\/(?:feedback|reports\/new|restaurants\/correction)(?:\?|$)/.test(
          location.state.feedbackReturnTo,
        )
          ? location.state.feedbackReturnTo
          : "/feedback"
      }
    >
      <ProfileSectionNav section="help" />
      <QueryView
        query={list}
        empty={!list.data?.items?.length}
        emptyTitle="还没有留下反馈"
        emptyIllustration="yangzhi"
        emptyDetail="有建议或遇到问题时，随时告诉我们。提交后可以在这里查看进度与回复。"
      >
        <Card>
          {list.data?.items?.map((item) => (
            <Link
              className="v4-row"
              to={`/feedback/mine/${item.id}`}
              key={item.id}
            >
              <div>
                <strong>{statusText(item.kind)}</strong>
                <p>
                  {item.text ||
                    (item.reason &&
                      reasons[item.reason as keyof typeof reasons]) ||
                    "查看处理进度"}
                </p>
                <small>{timeText(item.createdAt)}</small>
              </div>
              <Badge value={item.status} />
            </Link>
          ))}
        </Card>
        <Pager page={page} hasNext={list.data?.hasNext} onChange={setPage} />
      </QueryView>
    </Shell>
  );
}
export function CaseContent({ value }: { value: Schema["CaseViewResponse"] }) {
  return (
    <Card title={statusText(value.kind)}>
      <Badge value={value.status} />
      <p>{value.text || "未填写补充说明"}</p>
      {value.reason && (
        <p>
          问题类型：
          {reasons[value.reason as keyof typeof reasons] ?? value.reason}
        </p>
      )}
      <div className="v4-images">
        {value.screenshots?.map(
          (image, i) =>
            mediaUrl(image.url) && (
              <img
                key={i}
                src={mediaUrl(image.url)}
                alt={`反馈截图 ${i + 1}`}
              />
            ),
        )}
      </div>
      <dl className="v4-details">
        <div>
          <dt>提交时间</dt>
          <dd>{timeText(value.createdAt)}</dd>
        </div>
        <div>
          <dt>处理结果</dt>
          <dd>{statusText(value.outcome)}</dd>
        </div>
      </dl>
      {value.reply && <p>处理回复：{value.reply}</p>}
    </Card>
  );
}

type PrivateImageProps = {
  revisionId: string;
  count: number;
  admin?: boolean;
};
export function PrivateImages(props: PrivateImageProps) {
  return (
    <RevisionImages key={`${props.revisionId}:${!!props.admin}`} {...props} />
  );
}
function RevisionImages({
  revisionId,
  count,
  admin = false,
}: PrivateImageProps) {
  const active = usePageLifetime();
  const { api } = useApp(),
    task = useCommand(true),
    [images, setImages] = useState<
      { slot: number; url: string; until: number }[]
    >([]);
  useEffect(() => {
    const timer = setInterval(
      () => setImages((items) => items.filter((x) => x.until > Date.now())),
      1000,
    );
    return () => clearInterval(timer);
  }, []);
  return (
    <div>
      <div className="v4-actions">
        {Array.from({ length: Math.min(count, 9) }, (_, slot) => (
          <button
            key={slot}
            disabled={task.busy}
            onClick={() =>
              void task.run(
                () =>
                  admin
                    ? api.adminSubmissionImage(revisionId, slot)
                    : api.submissionImage(revisionId, slot),
                (r) => {
                  if (!active.current) return;
                  const url = mediaUrl(r.url) ?? safeLink(r.url);
                  if (!url) throw new Error("图片地址无效，请重试。");
                  setImages((items) => [
                    ...items.filter((x) => x.slot !== slot),
                    {
                      slot,
                      url,
                      until: Date.now() + (r.expiresInSeconds ?? 30) * 1000,
                    },
                  ]);
                },
              )
            }
          >
            查看第 {slot + 1} 张照片
          </button>
        ))}
      </div>
      <div className="v4-images">
        {images.map((image) => (
          <img
            key={image.slot}
            src={image.url}
            alt={`提交照片 ${image.slot + 1}`}
          />
        ))}
      </div>
      <CommandState task={task} />
    </div>
  );
}
export function SubmissionContent({
  item,
  admin = false,
}: {
  item: Schema["SubmissionResponse"];
  admin?: boolean;
}) {
  const values = item.candidate ?? {},
    titles: Record<string, string> = {
      name: "名称",
      description: "说明",
      address: "地址",
      price: "价格",
      category: "分类",
      permanentlyClosed: "永久停业",
    };
  return (
    <Card title={typeof values.name === "string" ? values.name : "提交内容"}>
      <Badge value={item.moderationStatus} />
      <p>提交时间：{timeText(item.submittedAt)}</p>
      {item.reasonMessage && (
        <p role="status">处理说明：{item.reasonMessage}</p>
      )}
      <dl className="v4-details">
        {Object.entries(titles)
          .filter(([key]) => values[key] != null)
          .map(([key, label]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>
                {typeof values[key] === "boolean"
                  ? values[key]
                    ? "是"
                    : "否"
                  : String(values[key])}
              </dd>
            </div>
          ))}
      </dl>
      {item.revisionId && (
        <PrivateImages
          revisionId={item.revisionId}
          count={item.imageCount ?? 0}
          admin={admin}
        />
      )}
      <div className="v4-actions">
        {item.moderationStatus === "APPROVED" && item.id && (
          <Link
            className="v4-button"
            to={`/${item.kind === "RESTAURANT" ? "restaurants" : "foods"}/${item.id}`}
          >
            查看公开内容
          </Link>
        )}
        <button onClick={() => location.reload()}>刷新进度</button>
      </div>
    </Card>
  );
}
export function Submissions({ revisionId }: { revisionId?: string }) {
  const { api } = useApp(),
    [page, setPage] = useState(1),
    q = useQuery<
      Schema["SubmissionResponse"] | Schema["PageResult_SubmissionResponse"]
    >({
      queryKey: ["submissions", revisionId ?? "mine", page],
      queryFn: () =>
        revisionId
          ? api.mySubmission(revisionId)
          : api.mySubmissions({ page, pageSize: 12 }),
    });
  return (
    <Shell
      title={revisionId ? "提交详情" : "我的分享"}
      back={revisionId ? "/submissions" : "/me/shares"}
      detail="已受理的修改会在审核和同步后更新公开内容。"
    >
      <ProfileSectionNav section="shares" />
      <div className="profile-activity-toolbar">
        <div>
          <h2>{revisionId ? "提交内容与处理结果" : "审核进度"}</h2>
          <p>提交的菜品和修改，都可以在这里查看后续。</p>
        </div>
        {(revisionId ||
          !q.data ||
          !("items" in q.data) ||
          !!q.data.items?.length) && (
          <Link className="v4-button" to="/publish">
            <Icon name="add" size={17} />
            分享一道菜
          </Link>
        )}
      </div>
      <QueryView query={q}>
        {q.data &&
          ("items" in q.data ? (
            <>
              {q.data.items?.length ? (
                <section
                  className="profile-submissions-list"
                  aria-label="提交记录"
                >
                  <div
                    className="profile-submissions-columns"
                    aria-hidden="true"
                  >
                    <span>提交内容</span>
                    <span>提交时间</span>
                    <span>审核状态</span>
                  </div>
                  {q.data.items?.map((item) => (
                    <Link
                      className="profile-submission-row"
                      key={item.revisionId}
                      to={`/submissions/${item.revisionId}`}
                    >
                      <span
                        className="profile-activity-symbol"
                        data-kind={item.kind}
                      >
                        <Icon
                          name={item.kind === "RESTAURANT" ? "store" : "bowl"}
                          size={24}
                        />
                      </span>
                      <div className="profile-submission-copy">
                        <small>
                          {item.kind === "RESTAURANT" ? "餐厅信息" : "菜品分享"}
                        </small>
                        <strong>
                          {String(
                            item.candidate?.name ?? statusText(item.kind),
                          )}
                        </strong>
                        {item.reasonMessage && <p>{item.reasonMessage}</p>}
                      </div>
                      <time>{timeText(item.submittedAt)}</time>
                      <span className="profile-submission-status">
                        <Badge value={item.moderationStatus} />
                        <Icon name="chevronRight" size={17} />
                      </span>
                    </Link>
                  ))}
                </section>
              ) : (
                <div className="profile-activity-empty" role="status">
                  <span className="profile-activity-empty-symbol">
                    <Icon name="document" size={30} />
                  </span>
                  <h3>
                    {page > 1 ? "这一页没有提交记录" : "从分享一道菜开始"}
                  </h3>
                  <p>
                    {page > 1
                      ? "返回上一页，继续查看之前的提交。"
                      : "分享喜欢的味道，提交后可以在这里查看审核进度。"}
                  </p>
                  {page === 1 && (
                    <Link className="v4-button primary" to="/publish">
                      <Icon name="add" size={17} />
                      分享一道菜
                    </Link>
                  )}
                </div>
              )}
              <Pager page={page} hasNext={q.data.hasNext} onChange={setPage} />
            </>
          ) : (
            <SubmissionContent item={q.data as Schema["SubmissionResponse"]} />
          ))}
      </QueryView>
    </Shell>
  );
}

export function NotificationCards() {
  const { api } = useApp(),
    cache = useQueryClient(),
    [column, setColumn] = useState<
      "ALL" | "COMMENTS" | "INTERACTION" | "SYSTEM"
    >("ALL"),
    [page, setPage] = useState(1),
    task = useCommand(),
    q = useQuery({
      queryKey: ["notification-cards", column, page],
      queryFn: () => api.notificationCards({ column, page, pageSize: 20 }),
    }),
    unread = useQuery({
      queryKey: ["notification-cards", "unread"],
      queryFn: () => api.unreadCards(),
    });
  const targetLink = (item: Schema["CardResponse"]) => {
    const d = item.data?.detail;
    if (d?.type === "case_result" && d.caseId)
      return `/feedback/mine/${d.caseId}`;
    if (d?.type === "moderation_result" && d.revisionId)
      return `/submissions/${d.revisionId}`;
    const t = item.target;
    if (t?.unavailable || !t?.id) return null;
    const paths: Record<string, string> = {
      foods: "foods",
      restaurant: "restaurants",
      topics: "topics",
      users: "users",
    };
    return paths[t.domain ?? ""] ? `/${paths[t.domain ?? ""]}/${t.id}` : null;
  };
  return (
    <Shell title="消息通知">
      <ProfileSectionNav section="messages" />
      <div className="profile-message-tools">
        <div className="profile-message-filters" aria-label="通知分类">
          {(
            [
              ["ALL", "全部"],
              ["COMMENTS", "评论"],
              ["INTERACTION", "互动"],
              ["SYSTEM", "系统"],
            ] as const
          ).map(([key, name]) => (
            <button
              key={key}
              aria-pressed={column === key}
              onClick={() => {
                setColumn(key);
                setPage(1);
              }}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="profile-message-summary">
          {typeof unread.data?.members === "number" && (
            <span className="profile-message-unread-count">
              <i aria-hidden="true" />
              {unread.data.members > 0
                ? `${unread.data.members} 条未读`
                : "消息都已读完"}
            </span>
          )}
          <Link to="/settings/notifications">
            <Icon name="settings" size={16} />
            通知偏好
          </Link>
        </div>
      </div>
      <QueryView query={q}>
        {q.data?.items?.length ? (
          <section className="profile-message-list" aria-label="互动通知列表">
            {q.data?.items?.map((item) => {
              const link = targetLink(item),
                detail = item.data?.detail,
                systemTitle =
                  item.kind === "moderation_result"
                    ? "审核结果"
                    : item.kind === "case_result"
                      ? "反馈回复"
                      : item.kind === "topic_included"
                        ? "专题收录"
                        : "系统通知";
              return (
                <article
                  className="profile-message-row"
                  data-unread={!!item.unreadMemberCount || undefined}
                  key={item.id}
                >
                  <span
                    className="profile-activity-symbol"
                    data-kind={item.kind}
                  >
                    <Icon
                      name={
                        item.kind === "like"
                          ? "heart"
                          : item.kind === "favorite"
                            ? "bookmark"
                            : item.kind === "case_result"
                              ? "feedback"
                              : item.kind === "moderation_result"
                                ? "shield"
                                : item.kind === "follow"
                                  ? "follow"
                                  : "bell"
                      }
                      size={23}
                    />
                  </span>
                  <div className="profile-message-copy">
                    <div className="profile-message-heading">
                      <strong>
                        {item.actors
                          ?.map((a) => a.name ?? "校园食友")
                          .join("、") || systemTitle}
                      </strong>
                      {!!item.unreadMemberCount && (
                        <span className="profile-message-unread">未读</span>
                      )}
                    </div>
                    <p className="profile-message-meta">
                      {item.memberCount ?? 1} 条
                      {item.kind === "like"
                        ? "点赞"
                        : item.kind === "favorite"
                          ? "收藏"
                          : item.kind === "follow"
                            ? "关注"
                            : "消息"}{" "}
                      <span aria-hidden="true"> · </span>
                      <time>{timeText(item.latestAt)}</time>
                    </p>
                    {detail?.type === "case_result" && (
                      <p>
                        {statusText(detail.kind)}：{statusText(detail.outcome)}{" "}
                        {detail.reply}
                      </p>
                    )}
                    {detail?.type === "moderation_result" && (
                      <p>
                        提交审核：
                        {detail.verdict === "APPROVE"
                          ? "已通过"
                          : detail.verdict === "REJECT"
                            ? "已驳回"
                            : statusText(detail.verdict)}{" "}
                        {detail.reasonCode}
                      </p>
                    )}
                    {detail?.type === "topic_included" && (
                      <p>
                        {detail.foodName ?? "这道菜"} 已入选{" "}
                        {detail.topicName ?? "校园专题"}
                      </p>
                    )}
                    {item.target?.unavailable ? (
                      <small>关联内容已不可见</small>
                    ) : (
                      link && (
                        <Link className="profile-message-target" to={link}>
                          查看内容 <Icon name="chevronRight" size={15} />
                        </Link>
                      )
                    )}
                  </div>
                  {!!item.unreadMemberCount && (
                    <button
                      className="profile-message-read"
                      disabled={task.busy}
                      onClick={() =>
                        void task.run(
                          () => api.readCard(item.id!),
                          async () => {
                            await cache.invalidateQueries({
                              queryKey: ["notification-cards"],
                            });
                            await cache.invalidateQueries({
                              queryKey: ["notifications", "unread"],
                            });
                          },
                        )
                      }
                    >
                      <Icon name="check" size={15} />
                      标为已读
                    </button>
                  )}
                </article>
              );
            })}
          </section>
        ) : (
          <div className="profile-activity-empty" role="status">
            <span className="profile-activity-empty-symbol">
              <Icon name="bell" size={30} />
            </span>
            <h3>
              {column === "ALL" ? "暂时没有新消息" : "这个分类还没有消息"}
            </h3>
            <p>
              {column === "ALL"
                ? "食友互动和处理结果会出现在这里。先去看看大家都在吃什么。"
                : "可以切回全部消息，查看其他互动与处理结果。"}
            </p>
            {column === "ALL" ? (
              <Link className="v4-button" to="/">
                去发现好味道 <Icon name="chevronRight" size={16} />
              </Link>
            ) : (
              <button
                className="v4-button"
                onClick={() => {
                  setColumn("ALL");
                  setPage(1);
                }}
              >
                查看全部消息
              </button>
            )}
          </div>
        )}
        <Pager page={page} hasNext={q.data?.hasNext} onChange={setPage} />
      </QueryView>
      <CommandState task={task} />
    </Shell>
  );
}

export function Topics({
  id,
  current = false,
}: {
  id?: number;
  current?: boolean;
}) {
  const { api } = useApp(),
    { campusId } = useArea(),
    [page, setPage] = useState(1),
    q = useQuery<
      | Schema["DetailResponse"]
      | Schema["SummaryResponse"]
      | Schema["PageResult_SummaryResponse"]
      | null
    >({
      queryKey: [
        "topics",
        id ?? (current ? "current" : "history"),
        campusId,
        page,
      ],
      queryFn: () =>
        id
          ? api.topic(id)
          : current
            ? api.currentTopic({ campusId: campusId! })
            : api.topicHistory({ campusId: campusId!, page, pageSize: 12 }),
      enabled: !!id || !!campusId,
    });
  if (!id && !campusId)
    return (
      <Shell title="校园专题">
        <Card>
          先在发现页选择校区，再来查看这个校区的专题。
          <Link to="/">去选择校区 →</Link>
        </Card>
      </Shell>
    );
  return (
    <Shell title="校园专题" back="/features">
      <div className="v4-tabs">
        <Link
          className={current ? "v4-button primary" : "v4-button"}
          to="/topics/current"
        >
          本期专题
        </Link>
        <Link
          className={!current && !id ? "v4-button primary" : "v4-button"}
          to="/topics"
        >
          往期专题
        </Link>
      </div>
      <QueryView
        query={q}
        empty={
          !q.data || (!!q.data && "items" in q.data && !q.data.items?.length)
        }
        emptyTitle="新的校园专题，还在准备中"
        emptyIllustration="xiangguo"
        emptyDetail="先去发现页看看同学们分享的好味道，下次再来逛逛。"
      >
        {q.data &&
          ("foods" in q.data ? (
            <>
              <TopicHero topic={q.data.topic ?? {}} />
              <div className="v4-section-title v4-topic-food-heading">
                <h2>这一期的好味道</h2>
                <span className="v4-kicker">慢慢挑，总有喜欢的一口</span>
              </div>
              <div className="v4-topic-food-grid">
                {q.data.foods?.map((food) => (
                  <Link
                    className="v4-topic-food-card"
                    key={food.id}
                    to={`/foods/${food.id}`}
                  >
                    <div>
                      {mediaUrl(food.pictureUrl?.[0]) ? (
                        <img
                          src={mediaUrl(food.pictureUrl?.[0])}
                          alt=""
                          loading="lazy"
                        />
                      ) : (
                        <Icon name="bowl" size={44} />
                      )}
                    </div>
                    <section>
                      <span>{food.restaurantName}</span>
                      <h3>{food.name}</h3>
                      <footer>
                        <strong>{money(food.price)}</strong>
                        <Icon name="chevronRight" size={18} />
                      </footer>
                    </section>
                  </Link>
                ))}
              </div>
            </>
          ) : "items" in q.data ? (
            <>
              <div className="v4-topic-archive-grid">
                {q.data.items?.map((topic, i) => (
                  <TopicCard key={topic.id} topic={topic} index={i} />
                ))}
              </div>
              <Pager page={page} hasNext={q.data.hasNext} onChange={setPage} />
            </>
          ) : (
            <TopicHero
              topic={q.data as Schema["SummaryResponse"]}
              to={`/topics/${(q.data as Schema["SummaryResponse"]).id}`}
            />
          ))}
      </QueryView>
    </Shell>
  );
}
export function FavoriteRestaurants() {
  const { api } = useApp(),
    [page, setPage] = useState(1),
    q = useQuery({
      queryKey: ["restaurants", "favorites", page],
      queryFn: () => api.favoriteRestaurants({ page, pageSize: 12 }),
    });
  return (
    <Shell title="我的收藏">
      <ProfileSectionNav section="collections" />
      <div className="v4-list-toolbar">
        <span>想去的、常去的，都值得留一份位置。</span>
        <Link className="v4-button" to="/restaurants/directory">
          <Icon name="store" size={17} />
          再找一家店
        </Link>
      </div>
      <QueryView
        query={q}
        empty={!q.data?.items?.length}
        emptyTitle="把喜欢的店铺收藏起来"
        emptyIllustration="jiaozi"
        emptyDetail="从店铺详情收藏一家店，下次想吃时就能在这里找到它。"
      >
        <div className="v4-restaurant-grid">
          {q.data?.items?.map((shop) => (
            <RestaurantCard shop={shop} key={shop.id} />
          ))}
        </div>
        <Pager page={page} hasNext={q.data?.hasNext} onChange={setPage} />
      </QueryView>
    </Shell>
  );
}
export function TagFoods({ id }: { id: number }) {
  const { api } = useApp(),
    [page, setPage] = useState(1),
    q = useQuery({
      queryKey: ["foods", "my-tag", id, page],
      queryFn: () => api.tagFoods(id, { page, pageSize: 12 }),
    });
  return (
    <Shell title="标签里的菜品" back="/me/tags">
      <ProfileSectionNav section="collections" />
      <QueryView query={q} empty={!q.data?.items?.length}>
        <div className="v4-grid">
          {q.data?.items?.map((food) => (
            <CatalogCard key={food.id} food={food} />
          ))}
        </div>
        <Pager page={page} hasNext={q.data?.hasNext} onChange={setPage} />
      </QueryView>
    </Shell>
  );
}

export function RestaurantActions({
  id,
  hideFavorite = false,
}: {
  id: number;
  hideFavorite?: boolean;
}) {
  const { api, session } = useApp(),
    cache = useQueryClient(),
    task = useCommand(),
    q = useQuery({
      queryKey: ["restaurants", "detail", id],
      queryFn: () => api.restaurant(id),
    }),
    shop = q.data;
  const refresh = async () => {
    await cache.invalidateQueries({ queryKey: ["restaurants"] });
  };
  return (
    <div className="v4-inline">
      <div className="v4-actions">
        {session ? (
          <>
            {!hideFavorite && (
              <button
                disabled={
                  !shop ||
                  task.busy ||
                  task.uncertain ||
                  shop?.personalState === "SYNC_PENDING"
                }
                onClick={() =>
                  void task.run(
                    () =>
                      shop?.isFavorite
                        ? api.unfavoriteRestaurant(id)
                        : api.favoriteRestaurant(id),
                    refresh,
                  )
                }
              >
                {shop?.isFavorite ? "取消收藏店铺" : "收藏店铺"}
              </button>
            )}
            <select
              aria-label="我的店铺评分"
              value={shop?.myRating ?? ""}
              disabled={
                !shop ||
                task.busy ||
                task.uncertain ||
                shop?.personalState === "SYNC_PENDING"
              }
              onChange={(e) => {
                const rating = e.target.value;
                void task.run(
                  () =>
                    rating
                      ? api.rateRestaurant(id, {
                          rating: rating as NonNullable<
                            Schema["RestaurantRatingDTORequest"]["rating"]
                          >,
                        })
                      : api.unrateRestaurant(id),
                  refresh,
                );
              }}
            >
              <option value="">未评分</option>
              {["RECOMMEND", "GOOD", "AVERAGE", "NOT_RECOMMEND"].map((r) => (
                <option key={r} value={r}>
                  {statusText(r)}
                </option>
              ))}
            </select>
          </>
        ) : (
          <LoginLink to="/auth/password">登录后收藏与评分</LoginLink>
        )}
        <Link to={`/restaurants/correction?id=${id}`}>店铺信息有误</Link>
        <Link to={`/reports/new?type=RESTAURANT&id=${id}`}>举报</Link>
      </div>
      {shop?.ratingSummaryState === "READY" ? (
        <p>
          {shop.ratingCount ?? 0} 人评价 ·{" "}
          {shop.recommendationRate == null
            ? "评价人数不足，暂无推荐率"
            : `推荐率 ${shop.recommendationRate}%`}
        </p>
      ) : (
        shop?.ratingSummaryState && <p>评分汇总仍在同步。</p>
      )}
      {shop?.publicTastesState === "READY" && (
        <p>
          {shop.publicTastes
            ?.map((t) => t.name)
            .filter(Boolean)
            .join(" · ") || "暂无公开口味"}
        </p>
      )}
      <CommandState task={task} />
    </div>
  );
}
