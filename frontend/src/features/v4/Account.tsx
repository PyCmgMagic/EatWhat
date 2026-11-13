import { DesignIcon as Icon } from "../../mobile/ui";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApp } from "../../app/state";
import { useSendSignal } from "../useSendSignal";
import RecoveryFile from "./RecoveryFile";
import { recoveryCommands } from "../../api/recovery";
import { resultUncertain } from "../../api/client";
import type { Schema } from "../../api/models";
import type { PushCategory, PushCommand } from "../../api/v4-types";
import {
  Card,
  Shell,
  Field,
  Badge,
  QueryView,
  useCommand,
  CommandState,
  statusText,
  timeText,
  capability,
} from "./shared";

async function acceptReplacement(
  app: ReturnType<typeof useApp>,
  result: Schema["OutcomeResponse"] | null | undefined,
) {
  if (result?.status !== "READY") return false;
  if (!result.tokenName || !result.tokenValue)
    throw new Error("会话恢复结果不完整，请重新查询恢复状态。");
  await app.signIn({
    tokenName: result.tokenName,
    tokenValue: result.tokenValue,
  });
  return true;
}
export function Devices() {
  const app = useApp(),
    cache = useQueryClient(),
    [cursor, setCursor] = useState<string>(),
    [command, setCommand] = useState(() => recoveryCommands.get("devices")),
    [progress, setProgress] =
      useState<Schema["DeviceSessionRecoveryStatusResponse"]>(),
    task = useCommand(),
    lookup = useCommand(true),
    [confirm, setConfirm] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["devices", cursor],
    queryFn: () => app.api.deviceSessions({ cursor, size: 20 }),
    enabled: !!app.session,
  });
  return (
    <Shell
      title="登录设备"
      back="/settings/account"
      detail="查看有效会话，发现陌生设备时可以申请下线。"
    >
      {app.session && (
        <QueryView
          query={q}
          empty={!q.data?.devices?.length}
          emptyTitle="暂时没有可显示的设备"
          emptyDetail="有效的登录设备会显示在这里。"
        >
          <Card>
            {q.data?.devices?.map((device) => (
              <div className="v4-row v4-device-row" key={device.sessionId}>
                <span
                  className={`v4-icon-tile ${device.current ? "is-green" : "is-blue"}`}
                >
                  <Icon
                    name={
                      /phone|android|ios|手机/i.test(device.device ?? "")
                        ? "phone"
                        : "computer"
                    }
                    size={26}
                  />
                </span>
                <div>
                  <strong>
                    {device.device} {device.current && "· 当前设备"}
                  </strong>
                  <p>最近使用：{timeText(device.lastSeenAt)}</p>
                  <small>到期：{timeText(device.expiresAt)}</small>
                </div>
                <button
                  disabled={task.busy || task.uncertain}
                  onClick={() => setConfirm(device.sessionId!)}
                >
                  下线此设备
                </button>
              </div>
            ))}
            {q.data?.nextCursor && (
              <button onClick={() => setCursor(q.data!.nextCursor!)}>
                下一页设备
              </button>
            )}
          </Card>
        </QueryView>
      )}
      <Card>
        <button
          className="danger"
          disabled={!app.session || !!command || task.busy || task.uncertain}
          onClick={() => setConfirm("others")}
        >
          下线其他设备
        </button>
        {confirm && (
          <div className="v4-message">
            <p>
              {confirm === "others"
                ? "其他设备将收到下线请求，当前设备可能需要换发会话。确认继续？"
                : "此设备的登录会话将被撤销。确认下线？"}
            </p>
            <div className="v4-actions">
              <button
                disabled={task.busy || task.uncertain}
                onClick={() =>
                  void task.run(
                    async (id) => {
                      if (confirm === "others") {
                        const saved = {
                          commandId: id,
                          capability: capability(),
                        };
                        recoveryCommands.set("devices", saved);
                        setCommand(saved);
                        return app.api.revokeOtherSessions({
                          commandId: id,
                          recoveryCapability: saved.capability,
                        });
                      }
                      return app.api.revokeSession(confirm);
                    },
                    async (result) => {
                      setConfirm(null);
                      task.say(
                        `下线请求已受理，${statusText(result.status)}。`,
                      );
                      await cache.invalidateQueries({ queryKey: ["devices"] });
                    },
                  )
                }
              >
                确认下线
              </button>
              <button
                disabled={task.busy || task.uncertain}
                onClick={() => setConfirm(null)}
              >
                取消
              </button>
            </div>
          </div>
        )}
        <CommandState task={task} />
      </Card>
      {command && (
        <Card title="当前设备恢复">
          <RecoveryFile kind="devices" value={command} />
          <p>下线请求可能需要时间处理，请以查询结果为准。</p>
          {progress && (
            <p>
              当前设备：{statusText(progress.currentDevice)} · 其他设备：
              {statusText(progress.propagation)}
            </p>
          )}
          <div className="v4-actions">
            <button
              disabled={lookup.busy}
              onClick={() =>
                void lookup.run(
                  () =>
                    app.api.deviceSessionStatus(
                      command.commandId,
                      command.capability,
                    ),
                  (r) => setProgress(r),
                )
              }
            >
              查询恢复状态
            </button>
            <button
              disabled={lookup.busy || progress?.currentDevice !== "READY"}
              onClick={() =>
                void lookup.run(
                  () =>
                    app.api.resumeDeviceSessions(
                      command.commandId,
                      command.capability,
                    ),
                  async (r) => {
                    if (await acceptReplacement(app, r)) {
                      recoveryCommands.delete("devices");
                      setCommand(undefined);
                      app.toast("当前设备会话已恢复。");
                    } else
                      lookup.say(
                        `当前设备${statusText(r.status)}，请稍后查询。`,
                      );
                  },
                )
              }
            >
              恢复当前设备会话
            </button>
          </div>
          <CommandState task={lookup} />
        </Card>
      )}
    </Shell>
  );
}

export function MobileChange() {
  const sendSignal = useSendSignal();
  const app = useApp(),
    hasPhone = !!app.user?.phone,
    [oldSent, setOldSent] = useState(false),
    [oldCode, setOldCode] = useState(""),
    [mobile, setMobile] = useState(""),
    [newSent, setNewSent] = useState(false),
    [newCode, setNewCode] = useState(""),
    [done, setDone] = useState(false),
    [cooldown, setCooldown] = useState({ old: 0, next: 0 }),
    task = useCommand(),
    send = useCommand();
  useEffect(() => {
    const timer = setInterval(
      () =>
        setCooldown((c) => ({
          old: Math.max(0, c.old - 1),
          next: Math.max(0, c.next - 1),
        })),
      1000,
    );
    return () => clearInterval(timer);
  }, []);
  const step = done ? 2 : newSent ? 1 : 0;
  return (
    <Shell
      title="更换手机号"
      back="/settings/account"
      detail="先验证原手机号，再验证新号码。"
    >
      <ol className="v4-steps" aria-label="换绑流程">
        {[
          ["验证原手机号", "接收原号码的验证码"],
          ["验证新手机号", "填写新号码并接收验证码"],
          ["完成", "新号码立即生效"],
        ].map(([name, desc], i) => (
          <li
            key={name}
            data-active={i === step || undefined}
            data-done={i < step || undefined}
          >
            <span>{i < step ? <Icon name="check" size={16} /> : i + 1}</span>
            <div>
              <b>{name}</b>
              <small>{desc}</small>
            </div>
          </li>
        ))}
      </ol>
      {!app.session ? null : done ? (
        <Card title="手机号已更换">
          <p>以后请用新的手机号 {mobile} 登录和接收验证码。</p>
        </Card>
      ) : !hasPhone ? (
        <Card>
          <p>当前账号还没有绑定手机号，请先绑定。</p>
          <div className="v4-actions">
            <Link to="/settings/bind-phone">去绑定手机号</Link>
          </div>
        </Card>
      ) : (
        <Card title="验证手机号">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void task.run(
                async () => {
                  if (!/^\d{6}$/.test(newCode))
                    throw new Error("请输入新手机号收到的 6 位验证码。");
                  await app.api.mobileChangeCommit(mobile, newCode);
                },
                () => {
                  setDone(true);
                  app.refreshMe();
                  task.say("手机号已更新。");
                },
              );
            }}
          >
            <Field label={`原手机号 ${app.user?.phone ?? ""} 的验证码`}>
              <input
                value={oldCode}
                onChange={(e) => setOldCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                disabled={newSent}
                required
              />
            </Field>
            {!newSent && (
              <button
                type="button"
                disabled={send.busy || send.uncertain || cooldown.old > 0}
                onClick={() =>
                  void send.run(
                    () => app.api.mobileChangeOldCode(sendSignal()),
                    () => {
                      setOldSent(true);
                      setCooldown((c) => ({ ...c, old: 60 }));
                      send.say("验证码已发送到原手机号。");
                    },
                  )
                }
              >
                {cooldown.old > 0
                  ? `${cooldown.old} 秒后可重发`
                  : oldSent
                    ? "重新发送原手机号验证码"
                    : "发送原手机号验证码"}
              </button>
            )}
            <Field label="新的手机号">
              <input
                inputMode="tel"
                autoComplete="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                maxLength={11}
                disabled={newSent}
                required
              />
            </Field>
            <button
              type="button"
              disabled={
                send.busy ||
                send.uncertain ||
                cooldown.next > 0 ||
                !/^\d{6}$/.test(oldCode)
              }
              onClick={() =>
                void send.run(
                  () =>
                    app.api.mobileChangeNewCode(mobile, oldCode, sendSignal()),
                  () => {
                    setNewSent(true);
                    setCooldown((c) => ({ ...c, next: 60 }));
                    send.say("验证码已发送到新手机号。");
                  },
                )
              }
            >
              {cooldown.next > 0
                ? `${cooldown.next} 秒后可重发`
                : newSent
                  ? "重新发送新手机号验证码"
                  : "发送新手机号验证码"}
            </button>
            {newSent && (
              <>
                <Field label="新手机号验证码">
                  <input
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                  />
                </Field>
                <button
                  className="primary"
                  disabled={task.busy || task.uncertain}
                >
                  确认更换手机号
                </button>
              </>
            )}
            <CommandState task={send} />
            <CommandState task={task} />
          </form>
        </Card>
      )}
    </Shell>
  );
}

export function Cancellation() {
  const app = useApp(),
    [ack, setAck] = useState(false),
    [deleteContent, setDeleteContent] = useState(
      () =>
        recoveryCommands.get("cancellation")?.deletePostsAndComments === true,
    ),
    [progress, setProgress] =
      useState<Schema["LifecycleRequestStatusResponse"]>(),
    [command, setCommand] = useState(() =>
      recoveryCommands.get("cancellation"),
    ),
    task = useCommand();
  return (
    <Shell title="注销账号" back="/settings/account">
      <Card>
        <div className="v4-lifecycle-icon">
          <Icon name="document" size={30} />
        </div>
        <h2>离开前，请了解注销的影响</h2>
        <p>
          提交后账号会进入注销流程。处理进度、撤销期限与最终状态由服务端返回；受理不代表清理已经完成。
        </p>
        <fieldset
          className="v6-cancellation-options"
          disabled={task.busy || task.uncertain || !!progress || !!command}
        >
          <legend>已发布的帖子和评论如何处理？</legend>
          <label className="v4-check">
            <input
              type="radio"
              name="deleteContent"
              checked={!deleteContent}
              onChange={() => setDeleteContent(false)}
            />
            匿名保留正文和图片（默认）
          </label>
          <p>内容不再关联你的个人资料，其他用户仍可点赞和回复。</p>
          <label className="v4-check">
            <input
              type="radio"
              name="deleteContent"
              checked={deleteContent}
              onChange={() => setDeleteContent(true)}
            />
            删除我发布的帖子、评论及其图片
          </label>
          <p>此选择会绑定本次注销申请。提交后不能通过重试改变。</p>
        </fieldset>
        <label className="v4-check">
          <input
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
          />
          我已了解注销会限制账号使用，并可能清理相关数据。
        </label>
        <div className="v4-actions">
          <button
            className="danger"
            disabled={
              !ack || task.busy || task.uncertain || !!progress || !!command
            }
            onClick={() =>
              void task.run(
                (id) => {
                  const saved = {
                    commandId: id,
                    capability: capability(),
                    deletePostsAndComments: deleteContent,
                    identifier:
                      app.user?.userName ??
                      app.user?.phone ??
                      app.user?.email ??
                      undefined,
                  };
                  recoveryCommands.set("cancellation", saved);
                  setCommand(saved);
                  return app.api.requestCancellation({
                    requestId: id,
                    recoveryCapability: saved.capability,
                    deletePostsAndComments: saved.deletePostsAndComments,
                  });
                },
                (r) => {
                  setProgress(r);
                  task.say(
                    r.complete
                      ? "注销已完成。"
                      : "注销申请已受理，请查看阶段与撤销期限。",
                  );
                },
              )
            }
          >
            提交注销申请
          </button>
        </div>
        <CommandState task={task} />
      </Card>
      {progress && (
        <Card title="注销进度">
          <Badge value={progress.phase} />
          <p>撤销期限：{timeText(progress.deadline)}</p>
          <p>
            {progress.complete
              ? "服务端已确认注销完成。"
              : "当前流程尚未全部完成。"}
          </p>
        </Card>
      )}
      {command && (
        <Card>
          <RecoveryFile kind="cancellation" value={command} />
          <Link
            className="v4-button"
            aria-disabled={task.busy || task.uncertain}
            onClick={(e) => {
              if (task.busy) e.preventDefault();
            }}
            to="/auth/account-recovery"
          >
            验证身份并撤销注销 →
          </Link>
        </Card>
      )}
    </Shell>
  );
}
export function AccountRecovery() {
  const app = useApp(),
    [saved, setSaved] = useState(() => recoveryCommands.get("cancellation")),
    [importedDeletion, setImportedDeletion] = useState<boolean | undefined>(),
    [identifier, setIdentifier] = useState(saved?.identifier ?? ""),
    [subject, setSubject] = useState(saved?.subjectId ?? ""),
    [mode, setMode] = useState<"password" | "phone">("password"),
    [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [grant, setGrant] = useState<Schema["RecoveryGrantResponse"]>(),
    [progress, setProgress] =
      useState<Schema["LifecycleRequestStatusResponse"]>(),
    task = useCommand(),
    lookup = useCommand(true);
  if (!saved)
    return (
      <Shell title="恢复账号操作">
        <Card>
          <p>
            本页没有待恢复的操作。可以导入之前保存的恢复文件，或填写操作编号与恢复凭据继续。
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              void task.run(async () => {
                const kind = String(d.get("kind")),
                  commandId = String(d.get("commandId")).trim(),
                  proof = String(d.get("proof")).trim();
                if (
                  !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(
                    commandId,
                  ) ||
                  !/^[A-Za-z0-9_-]{43}$/.test(proof)
                )
                  throw new Error("请填写有效的操作编号与恢复凭据。");
                const value = {
                  commandId,
                  capability: proof,
                  subjectId:
                    String(d.get("subjectId") || "").trim() || undefined,
                  ...(kind === "cancellation" && importedDeletion !== undefined
                    ? { deletePostsAndComments: importedDeletion }
                    : {}),
                };
                recoveryCommands.set(kind, value);
                if (kind === "cancellation") {
                  setSaved(value);
                  setSubject(value.subjectId ?? "");
                } else
                  window.location.hash =
                    kind === "devices"
                      ? "/auth/device-recovery"
                      : "/auth/mobile-recovery";
              });
            }}
          >
            <Field label="恢复的操作">
              <select name="kind">
                <option value="cancellation">注销申请</option>
                <option value="devices">设备下线</option>
                <option value="mobile">手机号换绑</option>
              </select>
            </Field>
            <Field label="导入已保存的恢复文件">
              <input
                type="file"
                accept="application/json,.json"
                onChange={async (e) => {
                  try {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const x = JSON.parse(await file.text());
                    if (
                      !["cancellation", "devices", "mobile"].includes(x.kind) ||
                      typeof x.commandId !== "string" ||
                      typeof x.capability !== "string" ||
                      (x.deletePostsAndComments !== undefined &&
                        typeof x.deletePostsAndComments !== "boolean")
                    )
                      throw new Error();
                    setImportedDeletion(x.deletePostsAndComments);
                    const form = e.target.form!;
                    (
                      form.elements.namedItem("kind") as HTMLSelectElement
                    ).value = x.kind;
                    (
                      form.elements.namedItem("commandId") as HTMLInputElement
                    ).value = x.commandId;
                    (
                      form.elements.namedItem("proof") as HTMLInputElement
                    ).value = x.capability;
                    (
                      form.elements.namedItem("subjectId") as HTMLInputElement
                    ).value = x.subjectId ?? "";
                  } catch {
                    task.say("恢复文件格式不正确，请重新选择。");
                  }
                }}
              />
            </Field>
            <Field label="操作编号">
              <input name="commandId" required autoComplete="off" />
            </Field>
            <Field label="恢复凭据">
              <input name="proof" type="password" required autoComplete="off" />
            </Field>
            <Field label="账号恢复编号（可选）">
              <input name="subjectId" autoComplete="off" />
            </Field>
            <button disabled={task.busy || task.uncertain}>读取恢复信息</button>
            <CommandState task={task} />
          </form>
          <Link to="/auth/password">返回登录</Link>
        </Card>
      </Shell>
    );
  return (
    <Shell title="验证身份并撤销注销" back="/settings/delete">
      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void task.run(
              (operationId) =>
                mode === "password"
                  ? app.api.recoverCancellationPassword({
                      identifier,
                      requestId: saved.commandId,
                      subjectId: subject || undefined,
                      operationId,
                      recoveryCapability: saved.capability,
                      password,
                    })
                  : app.api.verifyCancellationPhone({
                      subjectId: subject,
                      requestId: saved.commandId,
                      operationId,
                      recoveryCapability: saved.capability,
                      code,
                    }),
              (r) => {
                setGrant(r);
                setSubject(r.subjectId ?? subject);
                saved.subjectId = r.subjectId ?? undefined;
                saved.operationId = r.operationId ?? undefined;
                setPassword("");
                setCode("");
              },
            );
          }}
        >
          <Field label="验证方式">
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as typeof mode)}
            >
              <option value="password">密码验证</option>
              <option value="phone">手机号验证</option>
            </select>
          </Field>
          {mode === "password" ? (
            <>
              <Field label="登录名、邮箱或手机号">
                <input
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="username"
                  required
                />
              </Field>
              <Field label="登录密码">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </Field>
            </>
          ) : (
            <>
              <Field
                label="账号恢复编号"
                hint="使用已有恢复信息中的账号标识，不是公开的数字用户编号。"
              >
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                />
              </Field>
              <Field label="手机验证码">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
              </Field>
              <button
                type="button"
                disabled={lookup.busy || !subject}
                onClick={() =>
                  void lookup.run(
                    (id) =>
                      app.api.cancellationPhoneChallenge({
                        subjectId: subject,
                        requestId: saved.commandId,
                        operationId: id,
                        recoveryCapability: saved.capability,
                      }),
                    (r) =>
                      lookup.say(
                        `验证码已发起，有效至 ${timeText(r.expiresAt)}。`,
                      ),
                  )
                }
              >
                发送恢复验证码
              </button>
            </>
          )}
          <button className="primary" disabled={task.busy || task.uncertain}>
            验证身份
          </button>
          <CommandState task={task} />
        </form>
      </Card>
      {grant && (
        <Card title="身份已验证">
          <p>
            恢复凭据有效至 {timeText(grant.expiresAt)}
            。验证结果只用于本次撤销，不代表已经登录。
          </p>
          <button
            disabled={lookup.busy}
            onClick={() =>
              void lookup.run(
                () =>
                  app.api.cancelCancellation(
                    grant.subjectId!,
                    saved.commandId,
                    { credentialOperation: grant.operationId ?? undefined },
                    saved.capability,
                  ),
                (r) => {
                  setProgress(r);
                  lookup.say(
                    r.phase === "ACTIVE"
                      ? "注销已撤销，请重新登录。"
                      : `当前阶段：${statusText(r.phase)}`,
                  );
                },
              )
            }
          >
            确认撤销注销
          </button>
        </Card>
      )}
      {subject && (
        <button
          disabled={lookup.busy}
          onClick={() =>
            void lookup.run(
              () =>
                app.api.cancellationStatus(
                  subject,
                  saved.commandId,
                  saved.capability,
                ),
              (r) => setProgress(r),
            )
          }
        >
          查询注销状态
        </button>
      )}
      {progress && (
        <Card>
          <Badge value={progress.phase} />
          <p>撤销期限：{timeText(progress.deadline)}</p>
          {progress.phase === "ACTIVE" && (
            <Link to="/auth/password">重新登录</Link>
          )}
        </Card>
      )}
      <CommandState task={lookup} />
    </Shell>
  );
}
const pushNames: Record<PushCategory, string> = {
  COMMENTS: "评论通知",
  LIKES_AND_FAVORITES: "点赞与收藏",
  FOLLOWS: "关注通知",
  SYSTEM: "系统通知",
};
let pushBinding:
  | {
      id: string;
      capability: string;
      generation: number;
      tokenGeneration: number;
    }
  | undefined;
export function PushSettings() {
  const { api: sourceApi } = useApp();
  const [pending, setPending] = useState<PushCommand>();
  const lookup = useCommand(true);
  const api = {
    ...sourceApi,
    registerPush: (body: PushCommand) => {
      setPending(body);
      return sourceApi.registerPush(body);
    },
    refreshPush: (id: string, body: PushCommand) => {
      setPending(body);
      return sourceApi.refreshPush(id, body);
    },
    transferPush: (id: string, body: PushCommand) => {
      setPending(body);
      return sourceApi.transferPush(id, body);
    },
    unbindPush: (id: string, body: PushCommand) => {
      setPending(body);
      return sourceApi.unbindPush(id, body);
    },
    enablePush: (body: PushCommand) => {
      setPending(body);
      return sourceApi.enablePush(body);
    },
    disablePush: (body: PushCommand) => {
      setPending(body);
      return sourceApi.disablePush(body);
    },
  };
  const cache = useQueryClient(),
    q = useQuery({
      queryKey: ["push", "settings"],
      queryFn: () => api.pushSettings(),
    }),
    task = useCommand(),
    [binding, setBinding] = useState(pushBinding),
    [deviceToken, setDeviceToken] = useState("");
  return (
    <Shell title="通知偏好" back="/settings/account">
      {pending && (
        <Card title="通知操作进度">
          <button
            disabled={lookup.busy}
            onClick={() =>
              void lookup.run(
                () => api.pushCommandStatus(pending),
                async (r) => {
                  lookup.say(`通知操作${statusText(r.state)}。`);
                  if (r.state !== "PENDING") {
                    if (
                      r.bindingId &&
                      pending.operation !== "UNBIND" &&
                      (pending.capability || binding?.capability)
                    ) {
                      pushBinding = {
                        id: r.bindingId,
                        capability: pending.capability ?? binding!.capability,
                        generation: r.generation ?? 0,
                        tokenGeneration: r.tokenGeneration ?? 0,
                      };
                      setBinding(pushBinding);
                    }
                    if (pending.operation === "UNBIND") {
                      pushBinding = undefined;
                      setBinding(undefined);
                    }
                    await cache.invalidateQueries({ queryKey: ["push"] });
                  }
                },
              )
            }
          >
            查询上次操作结果
          </button>
          <CommandState task={lookup} />
        </Card>
      )}
      <QueryView query={q}>
        <Card title="通知栏目">
          {q.data?.map((setting) => (
            <div className="v4-row v4-preference-row" key={setting.category}>
              <span className="v4-icon-tile">
                <Icon
                  name={
                    setting.category === "COMMENTS"
                      ? "comment"
                      : setting.category === "LIKES_AND_FAVORITES"
                        ? "heart"
                        : setting.category === "FOLLOWS"
                          ? "follow"
                          : "bell"
                  }
                  size={22}
                />
              </span>
              <div>
                <strong>{pushNames[setting.category!] ?? "通知"}</strong>
                <p>{setting.enabled ? "已开启" : "已关闭"}</p>
              </div>
              <button
                className="v4-toggle"
                data-on={setting.enabled || undefined}
                aria-pressed={!!setting.enabled}
                disabled={
                  task.busy || task.uncertain || setting.revision == null
                }
                onClick={() =>
                  void task.run(
                    (id) => {
                      const body = {
                        commandId: id,
                        operation: setting.enabled
                          ? ("DISABLE" as const)
                          : ("ENABLE" as const),
                        category: setting.category!,
                        expectedPreferenceRevision: setting.revision!,
                        observedCloseFrontier:
                          setting.closeFrontier ?? undefined,
                      };
                      return setting.enabled
                        ? api.disablePush(body)
                        : api.enablePush(body);
                    },
                    async (r) => {
                      task.say(`栏目${statusText(r.state)}。`);
                      await cache.invalidateQueries({ queryKey: ["push"] });
                    },
                  )
                }
              >
                <span aria-hidden="true" />
                <b>{setting.enabled ? "关闭" : "开启"}</b>
              </button>
            </div>
          ))}
        </Card>
      </QueryView>
      <Card title="当前设备">
        <p>
          登记本机后，可关联设备通知令牌。网页没有可用推送令牌时，仅登记设备，不表示已能接收系统推送。
        </p>
        {!binding ? (
          <button
            disabled={task.busy || task.uncertain}
            onClick={() =>
              void task.run(
                async (id) => {
                  const proof = capability();
                  const result = await api.registerPush({
                    commandId: id,
                    operation: "CREATE",
                    capability: proof,
                  });
                  if (!result.bindingId)
                    throw new Error("设备登记结果不完整，请查看处理状态。");
                  pushBinding = {
                    id: result.bindingId,
                    capability: proof,
                    generation: result.generation ?? 0,
                    tokenGeneration: result.tokenGeneration ?? 0,
                  };
                  setBinding(pushBinding);
                  return result;
                },
                (r) => task.say(statusText(r.state)),
              )
            }
          >
            登记此设备
          </button>
        ) : (
          <>
            <p>当前设备已登记。</p>
            <details>
              <summary>更新设备通知连接</summary>
              <Field
                label="设备通知令牌"
                hint="由设备推送服务提供；未配置推送服务时可以留空。"
              >
                <input
                  value={deviceToken}
                  onChange={(e) => setDeviceToken(e.target.value)}
                  maxLength={4096}
                  autoComplete="off"
                />
              </Field>
              <div className="v4-actions">
                <button
                  disabled={!deviceToken || task.busy}
                  onClick={() =>
                    void task.run(
                      (id) =>
                        api.refreshPush(binding.id, {
                          commandId: id,
                          operation: "REFRESH",
                          bindingId: binding.id,
                          capability: binding.capability,
                          deviceToken,
                          expectedGeneration: binding.generation,
                          expectedTokenGeneration: binding.tokenGeneration,
                        }),
                      (r) => {
                        pushBinding = {
                          ...binding,
                          generation: r.generation ?? binding.generation,
                          tokenGeneration:
                            r.tokenGeneration ?? binding.tokenGeneration,
                        };
                        setBinding(pushBinding);
                        setDeviceToken("");
                        task.say(statusText(r.state));
                      },
                    )
                  }
                >
                  更新通知连接
                </button>
                <button
                  disabled={!deviceToken || task.busy}
                  onClick={() =>
                    void task.run(
                      (id) =>
                        api.transferPush(binding.id, {
                          commandId: id,
                          operation: "TRANSFER",
                          bindingId: binding.id,
                          capability: binding.capability,
                          deviceToken,
                          expectedGeneration: binding.generation,
                          expectedTokenGeneration: binding.tokenGeneration,
                        }),
                      (r) => {
                        pushBinding = {
                          ...binding,
                          generation: r.generation ?? binding.generation,
                          tokenGeneration:
                            r.tokenGeneration ?? binding.tokenGeneration,
                        };
                        setBinding(pushBinding);
                        setDeviceToken("");
                        task.say(statusText(r.state));
                      },
                    )
                  }
                >
                  转移到当前账号
                </button>
              </div>
            </details>
            <button
              disabled={task.busy || task.uncertain}
              onClick={() =>
                void task.run(
                  (id) =>
                    api.unbindPush(binding.id, {
                      commandId: id,
                      operation: "UNBIND",
                      bindingId: binding.id,
                      capability: binding.capability,
                      expectedGeneration: binding.generation,
                    }),
                  (r) => {
                    task.say(statusText(r.state));
                    if (r.state !== "PENDING") {
                      pushBinding = undefined;
                      setBinding(undefined);
                    }
                  },
                )
              }
            >
              解绑此设备
            </button>
          </>
        )}
        <CommandState task={task} />
      </Card>
    </Shell>
  );
}
export function TelemetrySettings() {
  const { api } = useApp(),
    cache = useQueryClient(),
    q = useQuery({
      queryKey: ["telemetry", "consent"],
      queryFn: () => api.telemetryConsent(),
    }),
    [ack, setAck] = useState(false),
    task = useCommand();
  return (
    <Shell title="使用统计" back="/settings/privacy">
      <QueryView query={q}>
        <Card>
          <div className="v4-privacy-hero">
            <span className="v4-icon-tile is-green">
              <Icon name="lock" size={27} />
            </span>
            <div>
              <span className="v4-kicker">选择权，一直在你手里</span>
              <h2>是否分享使用统计，由你决定。</h2>
            </div>
          </div>
          <p>
            仅在你明确开启后上报预设事件，不采集自由文本、网址或用户标识。保留时间：
            {q.data?.retentionDays ?? "待确认"} 天。
          </p>
          <p>政策版本：{q.data?.policyVersion}</p>
          <label className="v4-check">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
            />
            我了解并同意按此政策开启最小使用统计。
          </label>
          <div className="v4-actions">
            <button
              disabled={task.busy || !q.data || (!q.data.enabled && !ack)}
              onClick={() =>
                void task.run(
                  () => {
                    const body = {
                      policyVersion: q.data!.policyVersion!,
                      expectedRevision: q.data!.revision!,
                    };
                    return q.data!.enabled
                      ? api.disableTelemetry(body)
                      : api.saveTelemetryConsent({ ...body, enabled: true });
                  },
                  async (r) => {
                    await cache.invalidateQueries({ queryKey: ["telemetry"] });
                    task.say(
                      r.enabled ? "使用统计已开启。" : "使用统计已关闭。",
                    );
                    if (r.enabled && r.revision != null)
                      try {
                        await api.telemetryEvents({
                          consentRevision: r.revision,
                          events: [
                            {
                              eventId: crypto.randomUUID(),
                              properties: { event: "app_open" },
                            },
                          ],
                        });
                      } catch {
                        task.say("使用统计已开启，本次统计事件未能发送。");
                      }
                  },
                )
              }
            >
              {q.data?.enabled ? "关闭使用统计" : "开启使用统计"}
            </button>
          </div>
          <CommandState task={task} />
        </Card>
      </QueryView>
    </Shell>
  );
}
