import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { useAdminState } from "../../app/admin-state";
import { useApp } from "../../app/state";
import { mediaUrl } from "../../api/models";
import { statusText, useCommand } from "../../features/v4/shared";
import {
  Async,
  Field,
  Icon,
  Meta,
  Notice,
  Pager,
  Pill,
  Segmented,
  ago,
  dateTime,
  type Tone,
} from "../kit";

type Status = "OPEN" | "CLOSED";
type Kind = "ALL" | "FEEDBACK" | "CATALOG_ERROR" | "REPORT";
type Outcome = "ACCEPTED" | "REJECTED" | "RESOLVED";
const kindTone: Record<string, Tone> = {
  FEEDBACK: "info",
  CATALOG_ERROR: "warn",
  REPORT: "bad",
};
const targetPath = (
  target?: { type?: string | null; id?: number | null } | null,
) =>
  target?.type === "FOOD"
    ? `/foods/${target.id}`
    : target?.type === "RESTAURANT"
      ? `/restaurants/${target.id}`
      : target?.type === "USER"
        ? `/users/${target.id}`
        : undefined;
const targetName: Record<string, string> = {
  FOOD: "菜品",
  RESTAURANT: "餐厅",
  COMMENT: "评论",
  USER: "用户",
};

export default function Feedback() {
  const { api } = useApp(),
    cache = useQueryClient(),
    location = useLocation(),
    [page, setPage] = useAdminState("feedback.page", 1),
    [status, setStatus] = useAdminState<Status>("feedback.status", "OPEN"),
    [kind, setKind] = useAdminState<Kind>("feedback.kind", "ALL"),
    [selected, setSelected] = useAdminState<number | undefined>(
      "feedback.selected",
      undefined,
    );
  // The overview links straight to one case.
  const linked = (location.state as { caseId?: number } | null)?.caseId;
  useEffect(() => {
    if (linked) setSelected(linked);
  }, [linked]);
  const counts = useQuery({
    queryKey: ["admin", "feedback", "counts"],
    queryFn: () => api.feedbackCounts(),
    staleTime: 60000,
    retry: false,
  }).data;
  const open = (n?: number) => (status === "OPEN" && n ? `（${n}）` : "");
  const q = useQuery({
    queryKey: ["admin", "feedback", page, status, kind],
    queryFn: () =>
      api.adminFeedbackCases({
        page,
        pageSize: 12,
        status,
        kind: kind === "ALL" ? undefined : kind,
      }),
  });
  return (
    <div className="ew-admin-split" data-open={selected ? "" : undefined}>
      <section className="ew-admin-split-list" aria-label="反馈列表">
        <header>
          <Segmented
            label="处理状态"
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            options={[
              ["OPEN", "待处理"],
              ["CLOSED", "已处理"],
            ]}
          />
          <select
            aria-label="类型"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as Kind);
              setPage(1);
            }}
          >
            <option value="ALL">全部类型{open(counts?.total)}</option>
            <option value="FEEDBACK">意见反馈{open(counts?.feedback)}</option>
            <option value="CATALOG_ERROR">
              店铺纠错{open(counts?.catalogError)}
            </option>
            <option value="REPORT">举报{open(counts?.report)}</option>
          </select>
        </header>
        <Async
          query={q}
          rows={6}
          empty={!q.data?.items?.length}
          emptyTitle={status === "OPEN" ? "都处理完了" : "还没有已处理的记录"}
          emptyHint={
            status === "OPEN" ? "新的反馈、纠错和举报会出现在这里。" : undefined
          }
        >
          <ul className="ew-admin-cases">
            {q.data?.items?.map((item) => (
              <li key={item.view?.id}>
                <button
                  aria-current={selected === item.view?.id || undefined}
                  onClick={() => setSelected(item.view!.id!)}
                >
                  <span className="ew-admin-case-top">
                    <Pill tone={kindTone[item.view?.kind ?? ""]} dot={false}>
                      {statusText(item.view?.kind)}
                    </Pill>
                    <time>{ago(item.view?.createdAt)}</time>
                  </span>
                  <strong>
                    {item.targetName || item.view?.text || "未填写说明"}
                  </strong>
                  {item.targetName && item.view?.text && (
                    <span className="ew-admin-case-text">{item.view.text}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </Async>
        <Pager
          page={page}
          total={q.data?.totalItems}
          totalPages={q.data?.totalPages}
          hasNext={q.data?.hasNext}
          onChange={setPage}
        />
      </section>
      <section className="ew-admin-split-detail" aria-label="反馈详情">
        {selected ? (
          <CaseDetail
            key={selected}
            id={selected}
            onBack={() => setSelected(undefined)}
            onResolved={() => {
              void q.refetch();
              void cache.invalidateQueries({
                queryKey: ["admin", "feedback", "counts"],
              });
            }}
          />
        ) : (
          <div className="ew-admin-state is-tall">
            <Icon name="feedback" size={30} />
            <strong>选择一条反馈查看详情</strong>
            <p>在左侧列表中选择后，可以在这里查看内容并给出处理结论。</p>
          </div>
        )}
      </section>
    </div>
  );
}

function CaseDetail({
  id,
  onBack,
  onResolved,
}: {
  id: number;
  onBack: () => void;
  onResolved: () => void;
}) {
  const { api } = useApp(),
    [outcome, setOutcome] = useAdminState<Outcome>(
      `feedback.${id}.outcome`,
      "ACCEPTED",
    ),
    [reply, setReply] = useAdminState(`feedback.${id}.reply`, ""),
    [note, setNote] = useAdminState(`feedback.${id}.note`, ""),
    task = useCommand();
  const detail = useQuery({
    queryKey: ["admin", "feedback", "detail", id],
    queryFn: () => api.adminFeedbackCase(id),
  });
  const data = detail.data,
    view = data?.view,
    path = targetPath(view?.target);
  return (
    <>
      <button className="ew-admin-btn is-ghost ew-admin-split-back" onClick={onBack}>
        <Icon name="back" size={16} />
        返回列表
      </button>
      <Async query={detail} rows={6}>
        {view && (
          <article className="ew-admin-case">
            <header>
              <div>
                <Pill tone={kindTone[view.kind ?? ""]} dot={false}>
                  {statusText(view.kind)}
                </Pill>
                <Pill tone={view.status === "OPEN" ? "warn" : "good"}>
                  {view.status === "OPEN"
                    ? "待处理"
                    : statusText(view.outcome ?? view.status)}
                </Pill>
              </div>
              <span>
                #{view.id} · {dateTime(view.createdAt)}
              </span>
            </header>
            <p className="ew-admin-case-body">{view.text || "未填写补充说明"}</p>
            {!!view.screenshots?.length && (
              <div className="ew-admin-shots">
                {view.screenshots.map(
                  (image, i) =>
                    mediaUrl(image.url) && (
                      <a
                        key={i}
                        href={mediaUrl(image.url)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img
                          src={mediaUrl(image.url)}
                          alt={`截图 ${i + 1}`}
                          loading="lazy"
                        />
                      </a>
                    ),
                )}
              </div>
            )}
            <Meta
              items={[
                [
                  "提交人",
                  data.submitterId ? (
                    <Link className="ew-admin-link" to={`/users/${data.submitterId}`}>
                      {(data as { submitterName?: string | null })
                        .submitterName || "用户"}{" "}
                      #{data.submitterId}
                    </Link>
                  ) : (
                    "—"
                  ),
                ],
                ["问题类型", view.reason || "—"],
                [
                  "关联内容",
                  view.target ? (
                    path && !data.targetUnavailable ? (
                      <Link className="ew-admin-link" to={path}>
                        {data.targetName ||
                          `${targetName[view.target.type ?? ""]} #${view.target.id}`}
                        <Icon name="external" size={13} />
                      </Link>
                    ) : (
                      `${data.targetName ?? ""} ${targetName[view.target.type ?? ""] ?? ""} #${view.target.id}`
                    )
                  ) : (
                    "无"
                  ),
                ],
                ["处理时间", view.closedAt ? dateTime(view.closedAt) : "—"],
              ]}
            />
            {data.targetUnavailable && (
              <Notice tone="warn">
                关联内容已不可见，可能已被删除或隐藏。
              </Notice>
            )}
            {data.catalogChangeRequired && (
              <Notice tone="warn">
                这条纠错还需要到餐厅管理中更新目录。
                <Link
                  className="ew-admin-link"
                  to={`/admin/restaurants?keyword=${encodeURIComponent(data.targetName ?? "")}`}
                >
                  去维护餐厅
                </Link>
              </Notice>
            )}
            {view.reply && (
              <div className="ew-admin-quote">
                <span>给提交人的回复</span>
                <p>{view.reply}</p>
              </div>
            )}
            {!!data.actions?.length && (
              <>
                <h3 className="ew-admin-subhead">处理记录</h3>
                <ol className="ew-admin-timeline">
                  {data.actions.map((a, i) => (
                    <li key={a.decisionId ?? i}>
                      <strong>{statusText(a.outcome ?? a.action)}</strong>
                      <span>
                        {a.adminId ? `管理员 #${a.adminId}` : "系统"}
                        {a.createdAt ? ` · ${dateTime(a.createdAt)}` : ""}
                      </span>
                      {a.internalNote && <p>内部备注：{a.internalNote}</p>}
                    </li>
                  ))}
                </ol>
              </>
            )}
            {view.status === "OPEN" && (
              <form
                className="ew-admin-resolve"
                onSubmit={(e) => {
                  e.preventDefault();
                  void task.run(
                    (commandId) =>
                      api.resolveFeedback(
                        id,
                        {
                          outcome,
                          reply: reply.trim(),
                          internalNote: note.trim(),
                        },
                        commandId,
                      ),
                    async (r) => {
                      setReply("");
                      setNote("");
                      task.say(
                        `已记录${statusText(r.outcome)}，${r.notified ? "已通知提交人" : "未生成通知"}。`,
                      );
                      onResolved();
                      await detail.refetch();
                    },
                  );
                }}
              >
                <h3 className="ew-admin-subhead">处理结论</h3>
                <Segmented
                  label="结论"
                  value={outcome}
                  onChange={setOutcome}
                  options={[
                    ["ACCEPTED", "采纳 / 已核实"],
                    ["REJECTED", "驳回 / 无问题"],
                    ...(view.kind === "FEEDBACK"
                      ? ([["RESOLVED", "已处理"]] as const)
                      : []),
                  ]}
                />
                <Field label="回复提交人" hint="对方会在反馈记录中看到">
                  <textarea
                    rows={3}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                  />
                </Field>
                <Field label="内部备注" hint="仅管理员可见">
                  <textarea
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </Field>
                {task.uncertain && (
                  <Notice tone="warn">
                    上次提交的结果尚未确认，请刷新查看处理记录，避免重复提交。
                  </Notice>
                )}
                <div className="ew-admin-form-actions">
                  <button
                    className="ew-admin-btn is-primary"
                    disabled={task.busy || task.uncertain}
                  >
                    {task.busy ? "提交中…" : "提交结论"}
                  </button>
                </div>
              </form>
            )}
          </article>
        )}
      </Async>
    </>
  );
}
