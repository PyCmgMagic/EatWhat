import { DesignIcon as Icon } from "../../mobile/ui";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApp } from "../../app/state";
import { useArea } from "../../app/area";
import type { Schema } from "../../api/models";
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
} from "./shared";
import { CaseContent, SubmissionContent } from "./Community";
import { useAdminReturnTo, useAdminState } from "../../app/admin-state";

import { EngagementStats } from "./Growth";

export default function V4Admin() {
  const { user } = useApp(),
    [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "feedback";
  const directoryReturnTo = useAdminReturnTo("/admin");
  const setTab = (value: string) => setParams({ tab: value });
  if (user?.role !== "admin")
    return (
      <Shell title="内容管理">
        <Card>此页面需要管理员身份。</Card>
      </Shell>
    );
  return (
    <Shell title="内容与运营管理" back={directoryReturnTo}>
      <div className="v4-admin-layout">
        <aside className="v4-admin-sidebar">
          <div className="v4-admin-nav-heading">
            <Icon name="tool" size={22} />
            <span>
              管理导航<small>维护校园好味道</small>
            </span>
          </div>
          <nav className="v4-admin-nav" aria-label="管理模块">
            {[
              ["feedback", "反馈举报", "feedback"],
              ["engagement", "活跃统计", "history"],
              ["moderation", "提交审核", "shield"],
              ["topics", "校园专题", "topic"],
              ["config", "远程配置", "settings"],
              ["announcements", "公告管理", "announce"],
              ["versions", "版本管理", "download"],
              ["audit", "配置审计", "history"],
            ].map(([id, label, icon]) => (
              <button
                key={id}
                aria-pressed={tab === id}
                onClick={() => setTab(id)}
              >
                <Icon name={icon} size={19} />
                <span>{label}</span>
                <Icon name="chevronRight" size={15} />
              </button>
            ))}
          </nav>
          <Link className="v4-admin-directory" to={directoryReturnTo}>
            <Icon name="store" size={17} />
            目录与账号管理
            <Icon name="chevronRight" size={14} />
          </Link>
        </aside>
        <div className="v4-admin-main">
          {tab === "engagement" ? (
            <EngagementStats />
          ) : tab === "feedback" ? (
            <FeedbackAdmin />
          ) : tab === "moderation" ? (
            <ModerationAdmin />
          ) : tab === "topics" ? (
            <TopicAdmin />
          ) : tab === "announcements" ? (
            <AnnouncementsAdmin />
          ) : tab === "audit" ? (
            <ConfigAudit />
          ) : (
            <RemoteAdmin versions={tab === "versions"} />
          )}
        </div>
      </div>
    </Shell>
  );
}

function FeedbackAdmin() {
  const { api } = useApp(),
    [page, setPage] = useAdminState("feedback.page", 1),
    [status, setStatus] = useAdminState<"OPEN" | "CLOSED">(
      "feedback.status",
      "OPEN",
    ),
    [selected, setSelected] = useAdminState<number | undefined>(
      "feedback.selected",
      undefined,
    ),
    [outcome, setOutcome] = useAdminState<"ACCEPTED" | "REJECTED" | "RESOLVED">(
      `feedback.${selected}.outcome`,
      "ACCEPTED",
    ),
    [reply, setReply] = useAdminState(`feedback.${selected}.reply`, ""),
    [note, setNote] = useAdminState(`feedback.${selected}.note`, ""),
    task = useCommand();
  const q = useQuery({
      queryKey: ["admin", "feedback", page, status],
      queryFn: () => api.adminFeedbackCases({ page, pageSize: 12, status }),
    }),
    detail = useQuery({
      queryKey: ["admin", "feedback", "detail", selected],
      queryFn: () => api.adminFeedbackCase(selected!),
      enabled: !!selected,
    });
  return (
    <>
      <Card>
        <Field label="处理状态">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as typeof status);
              setPage(1);
            }}
          >
            <option value="OPEN">待处理</option>
            <option value="CLOSED">已处理</option>
          </select>
        </Field>
        <QueryView query={q} empty={!q.data?.items?.length}>
          {q.data?.items?.map((item) => (
            <button
              className="v4-row"
              key={item.view?.id}
              onClick={() => {
                setSelected(item.view!.id!);
              }}
            >
              <span>
                {statusText(item.view?.kind)} ·{" "}
                {item.targetName ?? item.view?.text?.slice(0, 60) ?? "查看详情"}
              </span>
              <Badge value={item.view?.status} />
            </button>
          ))}
          <Pager page={page} hasNext={q.data?.hasNext} onChange={setPage} />
        </QueryView>
      </Card>
      {selected && (
        <QueryView query={detail}>
          {detail.data?.view && (
            <>
              <CaseContent value={detail.data.view} />
              {detail.data.targetUnavailable && <p>关联内容已不可见。</p>}
              {detail.data.catalogChangeRequired && (
                <p>
                  此案件还需通过餐厅维护更新目录。
                  <Link
                    to={`/admin?tab=restaurants&keyword=${encodeURIComponent(detail.data.targetName ?? "")}`}
                  >
                    进入目录维护 →
                  </Link>
                </p>
              )}
              {detail.data.view.status === "OPEN" && (
                <Card title="处理结论">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void task.run(
                        (id) =>
                          api.resolveFeedback(
                            selected,
                            {
                              outcome,
                              reply: reply.trim(),
                              internalNote: note.trim(),
                            },
                            id,
                          ),
                        async (r) => {
                          setReply("");
                          setNote("");
                          task.say(
                            `已记录${statusText(r.outcome)}，${r.notified ? "已生成通知" : "未生成通知"}。`,
                          );
                          await q.refetch();
                          await detail.refetch();
                        },
                      );
                    }}
                  >
                    <Field label="结论">
                      <select
                        value={outcome}
                        onChange={(e) =>
                          setOutcome(e.target.value as typeof outcome)
                        }
                      >
                        <option value="ACCEPTED">采纳或已核实</option>
                        <option value="REJECTED">驳回或未发现问题</option>
                        {detail.data.view.kind === "FEEDBACK" && (
                          <option value="RESOLVED">已处理</option>
                        )}
                      </select>
                    </Field>
                    <Field label="回复提交人">
                      <textarea
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                      />
                    </Field>
                    <Field label="内部备注">
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                      />
                    </Field>
                    <button
                      className="primary"
                      disabled={task.busy || task.uncertain}
                    >
                      确认提交结论
                    </button>
                  </form>
                </Card>
              )}
              <CommandState task={task} />
            </>
          )}
        </QueryView>
      )}
    </>
  );
}
function ModerationAdmin() {
  const { api } = useApp(),
    [page, setPage] = useAdminState("moderation.page", 1),
    [revision, setRevision] = useAdminState<string | undefined>(
      "moderation.selected",
      undefined,
    ),
    [verdict, setVerdict] = useAdminState<
      NonNullable<Schema["NativeModerationReviewsRequestRequest"]["verdict"]>
    >(`moderation.${revision}.verdict`, "APPROVE"),
    [reason, setReason] = useAdminState(`moderation.${revision}.reason`, ""),
    [ack, setAck] = useState(false),
    task = useCommand();
  const q = useQuery({
      queryKey: ["admin", "moderation", page],
      queryFn: () => api.moderationQueue({ page, pageSize: 12 }),
    }),
    detail = useQuery({
      queryKey: ["admin", "moderation", revision],
      queryFn: () => api.adminSubmission(revision!),
      enabled: !!revision,
    });
  return (
    <>
      <Card title="待审核提交">
        <QueryView query={q} empty={!q.data?.items?.length}>
          {q.data?.items?.map((item) => (
            <button
              className="v4-row"
              key={item.revisionId}
              onClick={() => {
                setRevision(item.revisionId!);
                setAck(false);
              }}
            >
              <span>
                {String(item.candidate?.name ?? statusText(item.kind))}
              </span>
              <Badge value={item.moderationStatus} />
            </button>
          ))}
          <Pager page={page} hasNext={q.data?.hasNext} onChange={setPage} />
        </QueryView>
      </Card>
      {revision && (
        <QueryView query={detail}>
          {detail.data && (
            <>
              <SubmissionContent item={detail.data} admin />
              <Card title="审核结论">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void task.run(
                      () =>
                        api.reviewSubmission({
                          revisionId: revision,
                          verdict,
                          reasonCode:
                            reason.trim() ||
                            (verdict === "APPROVE" ? "APPROVED" : ""),
                        }),
                      async (r) => {
                        setReason("");
                        task.say(`审核结果：${statusText(r.state)}。`);
                        await q.refetch();
                        await detail.refetch();
                        setAck(false);
                      },
                    );
                  }}
                >
                  <Field label="处理方式">
                    <select
                      value={verdict}
                      onChange={(e) => {
                        setVerdict(e.target.value as typeof verdict);
                        setAck(false);
                      }}
                    >
                      {[
                        ["APPROVE", "通过"],
                        ["REJECT", "驳回"],
                        ["HIDE", "隐藏"],
                        ["RESTORE", "恢复"],
                        ["DELETE", "删除"],
                      ].map(([id, label]) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="处理原因">
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      pattern="[A-Z0-9_]{1,64}"
                      title="使用 1–64 位大写字母、数字或下划线原因码"
                      required={verdict !== "APPROVE"}
                    />
                  </Field>
                  <label className="v4-check">
                    <input
                      type="checkbox"
                      checked={ack}
                      onChange={(e) => setAck(e.target.checked)}
                    />
                    我已核对候选内容及图片，确认执行此结论。
                  </label>
                  <button
                    disabled={!ack || task.busy || task.uncertain}
                    className="primary"
                  >
                    提交审核结论
                  </button>
                </form>
                <CommandState task={task} />
              </Card>
            </>
          )}
        </QueryView>
      )}
    </>
  );
}

const flagNames: Record<string, string> = {
  publish: "菜品发布",
  newShop: "新建店铺",
  comment: "评论",
  push: "推送",
  topic: "专题",
};
function RemoteAdmin({ versions = false }: { versions?: boolean }) {
  const cache = useQueryClient();
  const { api } = useApp(),
    q = useQuery({
      queryKey: ["admin", "remote-config"],
      queryFn: () => api.adminRemoteConfig(),
    });
  return (
    <QueryView query={q}>
      {q.data && (
        <>
          <Card>
            <p>
              当前站点：{q.data.siteMode} · 配置版本 {q.data.configVersion}
            </p>
            <button onClick={() => void q.refetch()}>重新读取配置</button>
          </Card>
          {versions
            ? q.data.versions?.map((line) => (
                <VersionEditor
                  key={`${line.platform}:${line.revision}`}
                  value={line}
                  refresh={async () => {
                    await q.refetch();
                    await cache.invalidateQueries({
                      queryKey: ["remote-config"],
                    });
                  }}
                />
              ))
            : q.data.settings && (
                <SettingsEditor
                  key={q.data.settings.revision}
                  value={q.data.settings}
                  refresh={async () => {
                    await q.refetch();
                    await cache.invalidateQueries({
                      queryKey: ["remote-config"],
                    });
                  }}
                />
              )}
        </>
      )}
    </QueryView>
  );
}
function SettingsEditor({
  value,
  refresh,
}: {
  value: Schema["SettingsResponse"];
  refresh: () => Promise<unknown>;
}) {
  const { api } = useApp(),
    [flags, setFlags] = useState(() =>
      Object.fromEntries(
        Object.keys(flagNames).map((key) => [
          key,
          {
            on: value.flags?.[key]?.on ?? true,
            reason: value.flags?.[key]?.reason ?? "",
          },
        ]),
      ),
    ),
    [params, setParams] = useState(JSON.stringify(value.params ?? {}, null, 2)),
    [mode, setMode] = useState<"NONE" | "READ_ONLY" | "DOWN">(
      value.maintenance?.mode ?? "NONE",
    ),
    [message, setMessage] = useState(value.maintenance?.message ?? ""),
    [until, setUntil] = useState(value.maintenance?.until ?? ""),
    task = useCommand();
  return (
    <Card title="功能与维护设置">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void task.run(
            () => {
              const parsed: unknown = JSON.parse(params);
              if (
                !parsed ||
                typeof parsed !== "object" ||
                Array.isArray(parsed)
              )
                throw new Error("运营参数需为对象。");
              if (value.revision == null)
                throw new Error("配置修订号缺失，请重新读取。");
              return api.saveRemoteSettings({
                flags,
                params: parsed,
                maintenance: {
                  mode,
                  message: message || undefined,
                  until: until || undefined,
                },
                expectedRevision: value.revision,
              });
            },
            async () => {
              task.say("配置已保存。");
              await refresh();
            },
          );
        }}
      >
        {Object.entries(flags).map(([key, v]) => (
          <div key={key} className="v4-row">
            <label className="v4-check">
              <input
                type="checkbox"
                checked={v.on}
                onChange={(e) =>
                  setFlags({ ...flags, [key]: { ...v, on: e.target.checked } })
                }
              />
              {flagNames[key] ?? key}
            </label>
            <input
              aria-label={`${flagNames[key] ?? key}关闭说明`}
              placeholder="关闭时显示的说明"
              value={v.reason}
              onChange={(e) =>
                setFlags({ ...flags, [key]: { ...v, reason: e.target.value } })
              }
            />
          </div>
        ))}
        <Field label="维护状态">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as typeof mode)}
          >
            <option value="NONE">正常运行</option>
            <option value="READ_ONLY">只读维护</option>
            <option value="DOWN">暂停服务</option>
          </select>
        </Field>
        <Field label="维护说明">
          <input value={message} onChange={(e) => setMessage(e.target.value)} />
        </Field>
        <Field label="预计恢复时间（ISO 8601，可选）">
          <input
            value={until}
            onChange={(e) => setUntil(e.target.value)}
            placeholder="2026-11-02T12:00:00+08:00"
          />
        </Field>
        <details>
          <summary>高级运营参数</summary>
          <Field
            label="运营参数"
            hint="保留未修改的已有键；支持饭点窗口、推荐批量、评分门槛、轮询、距离与分类顺序等已知配置。"
          >
            <textarea
              value={params}
              onChange={(e) => setParams(e.target.value)}
              rows={12}
            />
          </Field>
        </details>
        <button className="primary" disabled={task.busy || task.uncertain}>
          保存此组配置
        </button>
        <CommandState task={task} />
      </form>
    </Card>
  );
}
function VersionEditor({
  value,
  refresh,
}: {
  value: Schema["AdminVersionLineResponse"];
  refresh: () => Promise<unknown>;
}) {
  const { api } = useApp(),
    [min, setMin] = useState(value.minBuild ?? 0),
    [latest, setLatest] = useState(value.latestBuild ?? 0),
    [name, setName] = useState(value.latestVersionName ?? ""),
    [url, setUrl] = useState(value.storeUrl ?? ""),
    [notes, setNotes] = useState(value.releaseNotes ?? ""),
    task = useCommand();
  return (
    <Card title={`${value.platform} 版本线`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void task.run(
            () => {
              if (value.revision == null || !value.platform)
                throw new Error("版本修订信息缺失，请重新读取。");
              return api.saveVersionLine(value.platform, {
                minBuild: min,
                latestBuild: latest,
                latestVersionName: name || undefined,
                storeUrl: url || undefined,
                releaseNotes: notes || undefined,
                expectedRevision: value.revision,
              });
            },
            async () => {
              await refresh();
            },
          );
        }}
      >
        <div className="v4-grid">
          <Field label="最低可用构建号">
            <input
              type="number"
              min={0}
              step={1}
              value={min}
              onChange={(e) => setMin(Number(e.target.value))}
            />
          </Field>
          <Field label="最新构建号">
            <input
              type="number"
              min={min}
              step={1}
              value={latest}
              onChange={(e) => setLatest(Number(e.target.value))}
            />
          </Field>
        </div>
        <Field label="版本名称">
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="更新地址">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </Field>
        <Field label="更新说明">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <button disabled={task.busy || task.uncertain}>保存版本线</button>
        <CommandState task={task} />
      </form>
    </Card>
  );
}
function ConfigAudit() {
  const { api } = useApp(),
    [page, setPage] = useAdminState("config-audit.page", 1),
    q = useQuery({
      queryKey: ["admin", "config-audit", page],
      queryFn: () => api.configAudit({ page, pageSize: 20 }),
    });
  return (
    <Card title="配置修改记录">
      <QueryView query={q} empty={!q.data?.items?.length}>
        {q.data?.items?.map((item) => (
          <article className="v4-row" key={item.id}>
            <div>
              <strong>
                {item.target} · {item.action}
              </strong>
              <p>
                {item.targetKey} · 修订 {item.revisionBefore ?? "初始"} →{" "}
                {item.revisionAfter}
              </p>
              <small>{timeText(item.occurredAt)}</small>
            </div>
          </article>
        ))}
        <Pager page={page} hasNext={q.data?.hasNext} onChange={setPage} />
      </QueryView>
    </Card>
  );
}

function AnnouncementsAdmin() {
  const { api } = useApp(),
    [page, setPage] = useAdminState("announcements.page", 1),
    [selected, setSelected] = useState<Schema["AdminAnnouncementResponse"]>(),
    [title, setTitle] = useState(""),
    [content, setContent] = useState(""),
    [link, setLink] = useState(""),
    [level, setLevel] = useState<"NORMAL" | "IMPORTANT">("NORMAL"),
    [enabled, setEnabled] = useState(true),
    [audience, setAudience] = useState('{"platforms":[],"campusIds":[]}'),
    [confirmDelete, setConfirmDelete] = useState<number>(),
    task = useCommand();
  const q = useQuery({
    queryKey: ["admin", "announcements", page],
    queryFn: () => api.adminAnnouncements({ page, pageSize: 12 }),
  });
  return (
    <>
      <Card title="公告列表">
        <QueryView query={q} empty={!q.data?.items?.length}>
          {q.data?.items?.map((item) => (
            <div className="v4-row" key={item.id}>
              <div>
                <strong>{item.title ?? "未命名公告"}</strong>
                <p>{item.content}</p>
                <small>{item.enabled ? "已启用" : "已停用"}</small>
              </div>
              <div className="v4-actions">
                <button
                  onClick={() => {
                    setSelected(item);
                    setTitle(item.title ?? "");
                    setContent(item.content ?? "");
                    setLink(item.linkUrl ?? "");
                    setLevel(item.level ?? "NORMAL");
                    setEnabled(item.enabled ?? false);
                    setAudience(
                      JSON.stringify(
                        {
                          platforms: item.platforms ?? [],
                          campusIds: item.campusIds ?? [],
                          minBuild: item.minBuild ?? undefined,
                          maxBuild: item.maxBuild ?? undefined,
                          startsAt: item.startsAt ?? undefined,
                          endsAt: item.endsAt ?? undefined,
                        },
                        null,
                        2,
                      ),
                    );
                  }}
                >
                  编辑
                </button>
                <button
                  className="danger"
                  onClick={() => setConfirmDelete(item.id!)}
                >
                  删除
                </button>
              </div>
              {confirmDelete === item.id && (
                <div>
                  <p>确认删除此公告？</p>
                  <button
                    disabled={task.busy || item.revision == null}
                    onClick={() =>
                      void task.run(
                        () =>
                          api.deleteAnnouncement(item.id!, {
                            expectedRevision: item.revision!,
                          }),
                        async () => {
                          setConfirmDelete(undefined);
                          await q.refetch();
                        },
                      )
                    }
                  >
                    确认删除公告
                  </button>
                  <button onClick={() => setConfirmDelete(undefined)}>
                    取消
                  </button>
                </div>
              )}
            </div>
          ))}
          <Pager page={page} hasNext={q.data?.hasNext} onChange={setPage} />
        </QueryView>
      </Card>
      <Card title={selected ? "编辑公告" : "新建公告"}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void task.run(
              () => {
                const filter = JSON.parse(audience) as Pick<
                  Schema["SaveAnnouncementRequest"],
                  | "platforms"
                  | "campusIds"
                  | "minBuild"
                  | "maxBuild"
                  | "startsAt"
                  | "endsAt"
                >;
                if (
                  !filter ||
                  typeof filter !== "object" ||
                  Array.isArray(filter) ||
                  Object.keys(filter).some(
                    (k) =>
                      ![
                        "platforms",
                        "campusIds",
                        "minBuild",
                        "maxBuild",
                        "startsAt",
                        "endsAt",
                      ].includes(k),
                  )
                )
                  throw new Error("公告范围包含未知设置。");
                const body: Schema["SaveAnnouncementRequest"] = {
                  level,
                  title: title || undefined,
                  content,
                  linkUrl: link || undefined,
                  enabled,
                  expectedRevision: selected?.revision ?? undefined,
                  ...filter,
                };
                return selected
                  ? api.editAnnouncement(selected.id!, body)
                  : api.createAnnouncement(body);
              },
              async () => {
                setSelected(undefined);
                setTitle("");
                setContent("");
                setLink("");
                await q.refetch();
              },
            );
          }}
        >
          <Field label="标题">
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="正文">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
          </Field>
          <details>
            <summary>发布范围与生效时间</summary>
            <Field
              label="发布范围"
              hint="可设置 platforms、campusIds、minBuild、maxBuild、startsAt、endsAt；空数组表示不限范围，省略时间和构建号表示不限。"
            >
              <textarea
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                rows={8}
              />
            </Field>
          </details>
          <Field label="公告级别">
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as typeof level)}
            >
              <option value="NORMAL">普通</option>
              <option value="IMPORTANT">重要</option>
            </select>
          </Field>
          <Field label="关联链接">
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
          </Field>
          <label className="v4-check">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            启用公告
          </label>
          <div className="v4-actions">
            <button disabled={task.busy || task.uncertain} className="primary">
              保存公告
            </button>
            {selected && (
              <button
                type="button"
                onClick={() => {
                  setSelected(undefined);
                  setTitle("");
                  setContent("");
                  setLink("");
                }}
              >
                取消编辑
              </button>
            )}
          </div>
          <CommandState task={task} />
        </form>
      </Card>
    </>
  );
}
function TopicAdmin() {
  const { api } = useApp(),
    { campusId } = useArea(),
    [topicId, setTopicId] = useState<string>(() => crypto.randomUUID()),
    [revision, setRevision] = useState(0),
    [name, setName] = useState(""),
    [intro, setIntro] = useState(""),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [foodIds, setFoodIds] = useState<number[]>([]),
    [cover, setCover] = useState<number>(),
    [page, setPage] = useState(1),
    task = useCommand(),
    lookup = useCommand(true);
  const history = useQuery({
      queryKey: ["admin", "topic-history", campusId],
      queryFn: () =>
        api.topicHistory({ campusId: campusId!, page: 1, pageSize: 100 }),
      enabled: !!campusId,
    }),
    foods = useQuery({
      queryKey: ["foods", "topic-pick", page],
      queryFn: () => api.foods(undefined, page),
    });
  return (
    <Card title="专题编辑">
      <p>专题按校区管理，保存草稿、发布与撤回均使用独立命令和当前修订号。</p>
      <Field label="编辑已有专题">
        <select
          value=""
          onChange={(e) => {
            const id = Number(e.target.value);
            if (!id) return;
            void lookup.run(
              () => api.topic(id),
              (r) => {
                setTopicId(r.topic!.gid!);
                setRevision(r.topic!.revision ?? 0);
                setName(r.topic!.name ?? "");
                setIntro(r.topic!.introduction ?? "");
                setStart(r.topic!.startsAt ?? "");
                setEnd(r.topic!.endsAt ?? "");
                setFoodIds(r.foods?.map((f) => f.id!).filter(Boolean) ?? []);
                setCover(r.topic?.coverFoodId ?? undefined);
              },
            );
          }}
        >
          <option value="">新建或选择专题</option>
          {history.data?.items?.map((item) => (
            <option key={item.id} value={item.id ?? undefined}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>
      <form onSubmit={(e) => e.preventDefault()}>
        <Field label="专题名称">
          <input
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </Field>
        <Field label="专题介绍">
          <textarea
            value={intro}
            maxLength={1000}
            onChange={(e) => setIntro(e.target.value)}
            required
          />
        </Field>
        <div className="v4-grid">
          <Field label="开始时间（ISO 8601）">
            <input
              value={start}
              onChange={(e) => setStart(e.target.value)}
              placeholder="2026-11-02T08:00:00+08:00"
            />
          </Field>
          <Field label="结束时间（ISO 8601）">
            <input
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              placeholder="2026-11-09T08:00:00+08:00"
            />
          </Field>
        </div>
        <QueryView query={foods}>
          {foods.data?.items?.map((food) => (
            <label className="v4-check" key={food.id}>
              <input
                type="checkbox"
                checked={foodIds.includes(food.id!)}
                onChange={(e) =>
                  setFoodIds((ids) =>
                    e.target.checked
                      ? [...ids, food.id!]
                      : ids.filter((id) => id !== food.id),
                  )
                }
              />
              {food.name}
            </label>
          ))}
          <Pager page={page} hasNext={foods.data?.hasNext} onChange={setPage} />
        </QueryView>
        <Field label="封面菜品">
          <select
            value={cover ?? ""}
            onChange={(e) => setCover(Number(e.target.value) || undefined)}
          >
            <option value="">不指定</option>
            {foodIds.map((id) => (
              <option key={id} value={id}>
                {foods.data?.items?.find((f) => f.id === id)?.name ??
                  `已选菜品 ${id}`}
              </option>
            ))}
          </select>
        </Field>
        <div className="v4-actions">
          {(
            [
              ["SAVE", "保存草稿"],
              ["PUBLISH", "发布专题"],
              ["WITHDRAW", "撤回专题"],
            ] as const
          ).map(([operation, label]) => (
            <button
              key={operation}
              disabled={task.busy || task.uncertain || !campusId}
              onClick={() =>
                void task.run(
                  (commandId) => {
                    if (
                      !name.trim() ||
                      !intro.trim() ||
                      !Number.isFinite(Date.parse(start)) ||
                      !Number.isFinite(Date.parse(end)) ||
                      Date.parse(end) <= Date.parse(start) ||
                      foodIds.length > 20
                    )
                      throw new Error(
                        "请填写专题名称、介绍、有效起止时间，并最多选择 20 道菜。",
                      );
                    return api.topicCommand({
                      commandId,
                      operation,
                      edit: {
                        topicId,
                        expectedRevision: revision,
                        campusId: campusId!,
                        name,
                        introduction: intro,
                        startsAt: start,
                        endsAt: end,
                        foodIds,
                        coverFoodId:
                          cover && foodIds.includes(cover) ? cover : undefined,
                      },
                    });
                  },
                  async (r) => {
                    setRevision(r.revision!);
                    task.say(`专题${statusText(r.state)}。`);
                    await history.refetch();
                  },
                )
              }
            >
              {label}
            </button>
          ))}
        </div>
        <CommandState task={task} />
        <CommandState task={lookup} />
      </form>
    </Card>
  );
}
