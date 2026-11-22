import { DesignIcon as Icon } from "../../mobile/ui";
import { useState, useEffect } from "react";
import { Modal } from "../../components/ui";
import "./confirm-dialog.css";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApp } from "../../app/state";
import { useSendSignal } from "../useSendSignal";
import { recoveryCommands } from "../../api/recovery";
import { resultUncertain } from "../../api/client";
import { saveDeletionKey } from "../../api/v2-bridge";
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

export function Devices() {
  const app = useApp(),
    cache = useQueryClient(),
    [cursor, setCursor] = useState<string>(),
    task = useCommand(),
    [confirm, setConfirm] = useState<string | null>(null),
    // Safari does not focus a clicked button; return focus to it explicitly
    // instead of to the focused page container (which then shows a ring).
    [trigger, setTrigger] = useState<HTMLElement | null>(null);
  const q = useQuery({
    queryKey: ["devices", cursor],
    queryFn: () => app.api.deviceSessions({ cursor, size: 20 }),
    enabled: !!app.session,
  });
  const target =
    confirm && confirm !== "others"
      ? q.data?.devices?.find((device) => device.sessionId === confirm)
      : undefined;
  const confirmDialog = confirm && (
    <Modal
      title={confirm === "others" ? "下线其他设备？" : "下线这台设备？"}
      className="v4-confirm-dialog"
      dismissible={!task.busy}
      returnFocus={trigger}
      onClose={() => setConfirm(null)}
    >
      <p>
        {confirm === "others"
          ? "除了这台设备，其他登录中的设备都会退出登录，这台设备不受影响。"
          : `${target ? `「${deviceName(target)}」` : "这台设备"}将退出登录，需要重新登录才能使用。`}
      </p>
      <div className="v4-confirm-actions">
        <button
          type="button"
          disabled={task.busy}
          onClick={() => setConfirm(null)}
        >
          取消
        </button>
        <button
          type="button"
          className="is-danger"
          disabled={task.busy || task.uncertain}
          onClick={() =>
            void task.run(
              (id) =>
                confirm === "others"
                  ? // The v4 contract still asks for these; backend v2 ignores them.
                    app.api.revokeOtherSessions({
                      commandId: id,
                      recoveryCapability: capability(),
                    })
                  : app.api.revokeSession(confirm),
              async () => {
                // Backend v2 signs devices out at once; say what happened.
                const name = target ? `「${deviceName(target)}」` : "这台设备";
                setConfirm(null);
                app.toast(
                  confirm === "others" ? "已下线其他设备" : `已下线${name}`,
                );
                await cache.invalidateQueries({ queryKey: ["devices"] });
              },
            )
          }
        >
          {task.busy ? "正在下线…" : "确认下线"}
        </button>
      </div>
    </Modal>
  );
  return (
    <Shell
      title="登录设备"
      back="/settings/account"
      detail="查看登录中的设备，发现陌生设备时可以把它下线。"
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
                    {deviceName(device)} {device.current && "· 当前设备"}
                  </strong>
                  <p>最近使用：{timeText(device.lastSeenAt)}</p>
                  <small>到期：{timeText(device.expiresAt)}</small>
                </div>
                <button
                  disabled={task.busy || task.uncertain}
                  onClick={(e) => {
                    setTrigger(e.currentTarget);
                    setConfirm(device.sessionId!);
                  }}
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
          disabled={!app.session || task.busy || task.uncertain}
          onClick={(e) => {
            setTrigger(e.currentTarget);
            setConfirm("others");
          }}
        >
          下线其他设备
        </button>
        {confirmDialog}
        <CommandState task={task} />
      </Card>
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
  const sendSignal = useSendSignal();
  const app = useApp(),
    hasPhone = !!app.user?.phone,
    [code, setCode] = useState(""),
    [password, setPassword] = useState(""),
    [deleteComments, setDeleteComments] = useState(false),
    [ack, setAck] = useState(false),
    [cooldown, setCooldown] = useState(0),
    [deleteAt, setDeleteAt] = useState<number>(),
    task = useCommand(),
    send = useCommand();
  useEffect(() => {
    const timer = setInterval(
      () => setCooldown((c) => Math.max(0, c - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, []);
  if (deleteAt)
    return (
      <Shell title="注销账号" back="/" advice={false}>
        <Card title="已申请注销">
          <p>
            账号已进入 7 天冷静期，将在 {timeText(deleteAt)}{" "}
            彻底删除。冷静期内账号不能使用，所有设备都已退出登录。
          </p>
          <p>改变主意的话，在冷静期内用这台设备重新登录，即可撤销注销。</p>
          <div className="v4-actions">
            {/* Every session already ended on the server; clear this one. */}
            <button
              className="primary"
              onClick={() => void app.signOut().catch(() => undefined)}
            >
              退出并返回
            </button>
          </div>
        </Card>
      </Shell>
    );
  return (
    <Shell title="注销账号" back="/settings/account" advice={false}>
      <div className="cancellation-layout">
        <section
          className="cancellation-impact"
          aria-labelledby="cancellation-impact-title"
        >
          <h2 id="cancellation-impact-title">
            <Icon name="info" size={20} />
            注销的影响
          </h2>
          <dl>
            <dt>提交申请后</dt>
            <dd>所有设备都会退出登录，账号暂停使用。</dd>
            <dt>7 天冷静期内</dt>
            <dd>用这台设备重新登录，即可撤销申请。</dd>
            <dt>冷静期结束后</dt>
            <dd>账号将被彻底删除，无法恢复。</dd>
          </dl>
        </section>
        <div className="cancellation-controls">
          <fieldset
            className="cancellation-options"
            disabled={task.busy || task.uncertain}
          >
            <legend>你发布的评论和回复如何处理？</legend>
            <label className="v4-check">
              <input
                type="radio"
                name="deleteComments"
                aria-labelledby="cancellation-keep-label"
                aria-describedby="cancellation-keep-detail"
                checked={!deleteComments}
                onChange={() => setDeleteComments(false)}
              />
              <span>
                <span id="cancellation-keep-label">匿名保留</span>
                <small id="cancellation-keep-detail">
                  显示为“已注销用户”，其他同学仍可看到和回复。
                </small>
              </span>
            </label>
            <label className="v4-check">
              <input
                type="radio"
                name="deleteComments"
                checked={deleteComments}
                onChange={() => setDeleteComments(true)}
              />
              随账号一并删除
            </label>
          </fieldset>
          {hasPhone ? (
            <div className="cancellation-verification">
              <label htmlFor="cancellation-code">
                短信验证码（尾号 {app.user?.phone?.slice(-4)}）
              </label>
              <div className="cancellation-code-row">
                <input
                  id="cancellation-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="6 位验证码"
                />
                <button
                  type="button"
                  disabled={send.busy || send.uncertain || cooldown > 0}
                  onClick={() =>
                    void send.run(
                      () => app.api.accountDeleteCode(sendSignal()),
                      () => {
                        setCooldown(60);
                        send.say("验证码已发送。");
                      },
                    )
                  }
                >
                  {cooldown > 0 ? `${cooldown} 秒后可重发` : "发送验证码"}
                </button>
              </div>
              <CommandState task={send} />
            </div>
          ) : (
            <Field label="登录密码">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </Field>
          )}
          <div className="cancellation-confirm">
            <label>
              <input
                type="checkbox"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
              />
              我已了解注销的影响，确认申请注销。
            </label>
            <button
              className="danger"
              disabled={
                !ack ||
                task.busy ||
                task.uncertain ||
                (hasPhone ? !/^\d{6}$/.test(code) : !password)
              }
              onClick={() =>
                void task.run(
                  () =>
                    app.api.deleteAccount({
                      ...(hasPhone ? { code } : { password }),
                      deleteComments,
                    }),
                  async (r) => {
                    saveDeletionKey(r.deletionKey);
                    setDeleteAt(r.deleteAt);
                  },
                )
              }
            >
              申请注销
            </button>
          </div>
          <CommandState task={task} />
        </div>
      </div>
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

const deviceTypes: Record<string, string> = {
  WEB: "网页浏览器",
  IOS: "iPhone / iPad",
  ANDROID: "安卓手机",
  APP: "手机 App",
};
/** v2 names the device (e.g. "Chrome · macOS"); fall back to its type. */
function deviceName(device: { device?: string | null; name?: string | null }) {
  return (
    device.name?.trim() ||
    deviceTypes[device.device ?? ""] ||
    device.device ||
    "未知设备"
  );
}
