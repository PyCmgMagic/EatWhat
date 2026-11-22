import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useApp } from "../../app/state";
import { useAdminState } from "../../app/admin-state";
import {
  feedbackCategoryLabel,
  feedbackReasons,
  type FeedbackCase,
} from "../../api/feedback";
import { mediaUrl } from "../../api/models";
import { statusText, useCommand } from "../../features/v4/shared";
import {
  Async,
  Drawer,
  Field,
  Icon,
  Meta,
  Notice,
  Pill,
  dateTime,
} from "../kit";

type Outcome = NonNullable<FeedbackCase["outcome"]>;
const targetNames: Record<string, string> = {
  FOOD: "菜品",
  RESTAURANT: "餐厅",
  COMMENT: "评论",
  USER: "用户",
};
const targetRoutes: Record<string, string> = {
  FOOD: "foods",
  RESTAURANT: "restaurants",
  USER: "users",
};

export default function FeedbackCaseDetail({
  id,
  onClose,
  onReturnToQueue,
}: {
  id: number;
  onClose: () => void;
  onReturnToQueue: () => void;
}) {
  const { api } = useApp();
  const cache = useQueryClient();
  const detail = useQuery({
    queryKey: ["admin", "feedback", "detail", id],
    queryFn: () => api.adminFeedbackCase(id),
  });
  const [outcome, setOutcome] = useAdminState<Outcome | "">(
    `feedback.${id}.outcome`,
    "",
  );
  const [reply, setReply] = useAdminState(`feedback.${id}.reply`, "");
  const [note, setNote] = useAdminState(`feedback.${id}.note`, "");
  const [showNote, setShowNote] = useState(Boolean(note));
  const task = useCommand();
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const data = detail.data;
  const view = data?.view;
  const open = view?.status === "OPEN";
  const report = view?.kind === "REPORT";
  const target = view?.target;
  const targetLabel =
    target &&
    (data?.targetName ||
      `${targetNames[target.type ?? ""] ?? "内容"} #${target.id}`);
  const targetRoute = target && targetRoutes[target.type ?? ""];
  const device = data?.submissionDevice;
  const choices: [Outcome, string][] = [
    ["ACCEPTED", report ? "举报属实" : "采纳"],
    ["REJECTED", report ? "举报不成立" : "不予采纳"],
  ];
  if (view?.kind === "FEEDBACK") choices.push(["RESOLVED", "已处理"]);
  const validOutcome = choices.some(([value]) => value === outcome);
  function resolve() {
    if (!open || !outcome || !validOutcome) return;
    void task.run(
      (commandId) =>
        api.resolveFeedback(
          id,
          { outcome, reply: reply.trim(), internalNote: note.trim() },
          commandId,
        ),
      async (result) => {
        setReply("");
        setNote("");
        setOutcome("");
        // Show a confirmed close even if the subsequent read is delayed.
        cache.setQueryData(["admin", "feedback", "detail", id], {
          ...data,
          internalNote: note.trim(),
          catalogChangeRequired: result.catalogChangeRequired,
          view: {
            ...view,
            status: "CLOSED",
            outcome: result.outcome ?? outcome,
            reply: reply.trim(),
          },
        });
        void cache.invalidateQueries({ queryKey: ["feedback", "mine"] });
        void cache.invalidateQueries({ queryKey: ["feedback", "detail", id] });
        task.say(
          `反馈 #${id} 已结案${result.notified ? "，已通知提交人" : ""}。`,
        );
        await cache.invalidateQueries({ queryKey: ["admin", "feedback"] });
        if (mounted.current && !result.catalogChangeRequired) onReturnToQueue();
      },
    );
  }

  return (
    <Drawer
      wide
      title={`反馈详情 #${id}`}
      onClose={() => {
        if (!task.busy) onClose();
      }}
      onSubmit={open ? resolve : undefined}
      footer={
        open ? (
          <>
            <span className="ew-feedback-finality">
              结案后无法修改，提交人可查看结果。
            </span>
            <button
              className="ew-admin-btn is-primary"
              type="submit"
              disabled={!validOutcome || task.busy || task.uncertain}
            >
              {task.busy ? "正在结案…" : "确认结案"}
            </button>
          </>
        ) : (
          <button className="ew-admin-btn" onClick={onClose}>
            返回列表
          </button>
        )
      }
    >
      <Async query={detail} rows={5} empty={!view} emptyTitle="暂无反馈详情">
        {view && data && (
          <article className="ew-admin-case">
            <header>
              <div>
                <Pill
                  tone={
                    view.kind === "REPORT"
                      ? "bad"
                      : view.kind === "CATALOG_ERROR"
                        ? "warn"
                        : "info"
                  }
                  dot={false}
                >
                  {feedbackCategoryLabel(view) ?? statusText(view.kind)}
                </Pill>
                <Pill tone={open ? "warn" : "good"}>
                  {open ? "待处理" : statusText(view.outcome ?? "RESOLVED")}
                </Pill>
              </div>
              <time>{dateTime(view.createdAt)} 提交</time>
            </header>
            <p className="ew-admin-case-body">
              {view.text ||
                (view.reason &&
                  (feedbackReasons[view.reason] ?? view.reason)) ||
                "未填写补充说明"}
            </p>
            {!!view.screenshots?.length && (
              <div className="ew-admin-shots">
                {view.screenshots.map((shot, i) => {
                  const url = mediaUrl(shot.url);
                  return (
                    url && (
                      <a key={i} href={url} target="_blank" rel="noreferrer">
                        <img
                          src={url}
                          alt={`反馈截图 ${i + 1}`}
                          loading="lazy"
                        />
                      </a>
                    )
                  );
                })}
              </div>
            )}
            <Meta
              items={[
                [
                  "提交人",
                  data.submitterId ? (
                    <Link
                      className="ew-admin-link"
                      to={`/users/${data.submitterId}`}
                    >
                      {data.submitterName || "用户"} #{data.submitterId}
                    </Link>
                  ) : (
                    "—"
                  ),
                ],
                ...(view.reason && view.text
                  ? [
                      [
                        "问题类型",
                        feedbackReasons[view.reason] ?? view.reason,
                      ] as const,
                    ]
                  : []),
                ...(target
                  ? [
                      [
                        "关联内容",
                        targetRoute && target.id && !data.targetUnavailable ? (
                          <Link
                            className="ew-admin-link"
                            to={`/${targetRoute}/${target.id}`}
                          >
                            {targetLabel}
                            <Icon name="external" size={13} />
                          </Link>
                        ) : (
                          targetLabel
                        ),
                      ] as const,
                    ]
                  : []),
              ]}
            />
            {data.targetUnavailable && (
              <Notice tone="warn">
                关联内容已不可见，可能已被删除或隐藏。
              </Notice>
            )}
            {device && (
              <details className="ew-feedback-disclosure">
                <summary>提交设备</summary>
                <Meta
                  items={[
                    ["平台", device.platform],
                    ["型号", device.model],
                    ["系统版本", device.osVersion],
                    ["应用版本", device.appVersion],
                    ["构建号", device.appBuild],
                  ]}
                />
              </details>
            )}
            {open ? (
              <section className="ew-admin-resolve">
                <fieldset
                  className="ew-feedback-outcomes"
                  disabled={task.busy || task.uncertain}
                >
                  <legend>处理结论</legend>
                  {choices.map(([value, label]) => (
                    <label key={value}>
                      <input
                        type="radio"
                        name="outcome"
                        value={value}
                        required
                        checked={outcome === value}
                        onChange={() => setOutcome(value)}
                      />
                      {label}
                    </label>
                  ))}
                </fieldset>
                <Field
                  label="回复提交人（选填）"
                  hint="提交人可见，最多 200 字"
                >
                  <textarea
                    rows={3}
                    maxLength={200}
                    value={reply}
                    disabled={task.busy || task.uncertain}
                    onChange={(event) => setReply(event.target.value)}
                  />
                </Field>
                <details
                  className="ew-feedback-disclosure"
                  open={showNote}
                  onToggle={(event) => setShowNote(event.currentTarget.open)}
                >
                  <summary>内部备注（仅管理员可见）</summary>
                  <textarea
                    aria-label="内部备注"
                    maxLength={500}
                    rows={2}
                    value={note}
                    disabled={task.busy || task.uncertain}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </details>
                {(task.uncertain || task.error) && (
                  <div role="alert">
                    <Notice tone="warn">
                      {task.uncertain
                        ? "提交结果尚未确认，请重新查询处理记录。"
                        : task.error}
                    </Notice>
                    <button
                      type="button"
                      className="ew-admin-link"
                      onClick={() => void detail.refetch()}
                    >
                      重新查询
                    </button>
                  </div>
                )}
              </section>
            ) : (
              <>
                {data.catalogChangeRequired && (
                  <Notice tone="warn">
                    已采纳纠错，餐厅资料仍需更新。{" "}
                    <Link
                      className="ew-admin-link"
                      to={`/admin/restaurants?keyword=${encodeURIComponent(data.targetName ?? "")}`}
                    >
                      去维护餐厅
                      <Icon name="chevronRight" size={13} />
                    </Link>
                  </Notice>
                )}
                {view.reply && (
                  <div className="ew-admin-quote">
                    <span>给提交人的回复</span>
                    <p>{view.reply}</p>
                  </div>
                )}
                <section className="ew-feedback-history">
                  <h3>处理记录</h3>
                  {data.actions?.length ? (
                    <ol className="ew-admin-timeline">
                      {data.actions.map((action, i) => (
                        <li key={action.decisionId ?? i}>
                          <strong>
                            {statusText(action.outcome ?? action.action)}
                          </strong>
                          <span>
                            {action.adminId
                              ? `管理员 #${action.adminId}`
                              : "管理员"}
                            {action.createdAt
                              ? ` · ${dateTime(action.createdAt)}`
                              : ""}
                          </span>
                          {action.internalNote && (
                            <p>内部备注：{action.internalNote}</p>
                          )}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <Meta
                      items={[
                        ["处理时间", dateTime(view.closedAt)],
                        ...(data.resolvedBy
                          ? [["处理人", `管理员 #${data.resolvedBy}`] as const]
                          : []),
                        ...(data.internalNote
                          ? [["内部备注", data.internalNote] as const]
                          : []),
                      ]}
                    />
                  )}
                </section>
              </>
            )}
          </article>
        )}
      </Async>
    </Drawer>
  );
}
