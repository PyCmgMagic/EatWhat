import { useState, type MouseEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { verificationFailureMessage } from "../app/verification-return";
import type { V2Schema } from "../api/backend-v2";
import { isV2Demo, useV2 } from "./state";
import {
  dateTime,
  Form,
  Notice,
  QueryState,
  safeNext,
  useAction,
  value,
} from "./ui";

type VerificationLink = {
  kind: "sdu" | "email";
  secret?: string;
  error?: string;
};
let verificationLink: VerificationLink | undefined;
const ssoOwnerKey = isV2Demo
  ? "eatwhat-v2-demo-sso-owner"
  : "eatwhat-v2-sso-owner";

export function captureVerificationLink() {
  const url = new URL(location.href);
  const hash = new URLSearchParams(url.hash.split("?")[1]);
  const field = (key: string) => url.searchParams.get(key) ?? hash.get(key);
  const hashPath = url.hash.split("?")[0];
  const path = hashPath.startsWith("#/") ? hashPath.slice(1) : url.pathname;
  if (!/^\/(?:home|verify(?:\/email)?|(?:app\/)?auth\/callback)\/?$/.test(path))
    return;
  const ticket = field("ticket"),
    token = field("token"),
    result = field("result");
  if (!ticket && !token && result !== "success" && result !== "failure") return;
  const kind = token ? "email" : "sdu";
  const secret = token ?? ticket;
  verificationLink = {
    kind,
    ...(secret && result !== "failure"
      ? { secret }
      : { error: verificationFailureMessage(field("code") ?? "") }),
  };
  const display = new URLSearchParams();
  for (const name of ["demo", "persona", "view"]) {
    const param = url.searchParams.get(name);
    if (param !== null) display.set(name, param);
  }
  history.replaceState(
    history.state,
    "",
    "/" + (display.size ? "?" + display : "") + "#/verify",
  );
}

function usePolicy() {
  const { call } = useV2();
  return useQuery({
    queryKey: ["v2", "policy"],
    queryFn: ({ signal }) => call("currentPolicy", { public: true, signal }),
    staleTime: 0,
  });
}

export function PolicyDocuments({
  policy,
}: {
  policy: V2Schema["PublicConsentPolicy"];
}) {
  return (
    <div className="v2-documents">
      <details>
        <summary>隐私政策</summary>
        <p>{policy.privacyText}</p>
      </details>
      <details>
        <summary>数据跨境说明</summary>
        <p>{policy.crossBorderText}</p>
      </details>
    </div>
  );
}

export function PublicPolicy() {
  const policy = usePolicy();
  return (
    <section className="v2-panel">
      <h1>隐私政策和数据跨境说明</h1>
      <QueryState query={policy} empty={!policy.data?.version}>
        {policy.data && <PolicyDocuments policy={policy.data} />}
      </QueryState>
    </section>
  );
}

export function Reconsent() {
  const { agree, signOut } = useV2();
  const policy = usePolicy();
  const task = useAction();
  const nav = useNavigate();
  const { search } = useLocation();
  const next = safeNext(new URLSearchParams(search).get("next"));
  return (
    <section className="v2-panel v2-narrow">
      <h1>政策已更新</h1>
      <QueryState query={policy} empty={!policy.data?.version}>
        {policy.data?.version && (
          <Form
            label="同意并继续"
            submit={async () => {
              try {
                await agree(policy.data!.version!);
                nav(next, { replace: true });
              } catch (error) {
                if (error instanceof ApiError && Number(error.code) === 20009)
                  await policy.refetch();
                throw error;
              }
            }}
          >
            <PolicyDocuments policy={policy.data} />
            <label className="v2-check">
              <input type="checkbox" required key={policy.data.version} />
              我已阅读并同意以上两份文件
            </label>
          </Form>
        )}
      </QueryState>
      <button
        disabled={task.busy}
        onClick={() =>
          void task.run(async () => {
            await signOut();
            nav("/");
          })
        }
      >
        退出登录
      </button>
      <Notice {...task} />
    </section>
  );
}

function SmsButton({
  send,
  label = "发送验证码",
}: {
  send: (data: FormData, signal: AbortSignal) => Promise<unknown>;
  label?: string;
}) {
  const task = useAction();
  const [sent, setSent] = useState(false);
  const click = (event: MouseEvent<HTMLButtonElement>) => {
    const form = event.currentTarget.form;
    if (!form) return;
    const data = new FormData(form);
    void task.run(
      async (signal) => {
        await send(data, signal);
        if (!signal.aborted) setSent(true);
      },
      isV2Demo ? "演示验证码为 123456。" : "验证码已发送。",
    );
  };
  return (
    <div>
      <button type="button" disabled={task.busy} onClick={click}>
        {task.busy ? "正在发送…" : sent ? "重新发送验证码" : label}
      </button>
      <Notice {...task} />
    </div>
  );
}

function mobile(data: FormData) {
  const input = value(data, "mobile");
  if (!/^1[3-9]\d{9}$/.test(input))
    throw new Error("请输入有效的 11 位手机号。");
  return input;
}

function PhoneInput({ label = "手机号" }: { label?: string }) {
  return (
    <label>
      {label}
      <input
        name="mobile"
        type="tel"
        autoComplete="tel"
        inputMode="numeric"
        required
        pattern="1[3-9][0-9]{9}"
        maxLength={11}
      />
    </label>
  );
}

function CodeInput({
  name = "code",
  label = "短信验证码",
  required = true,
}: {
  name?: string;
  label?: string;
  required?: boolean;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        autoComplete="one-time-code"
        inputMode="numeric"
        required={required}
        pattern="[0-9]{6}"
        maxLength={6}
      />
    </label>
  );
}

function PasswordInput({
  name = "newPassword",
  label = "新密码",
  optional = false,
}: {
  name?: string;
  label?: string;
  optional?: boolean;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        type="password"
        autoComplete="new-password"
        minLength={6}
        maxLength={64}
        required={!optional}
      />
    </label>
  );
}

function password(data: FormData, key: string) {
  const raw = String(data.get(key) ?? "");
  if (new TextEncoder().encode(raw).length > 72)
    throw new Error("密码不能超过 72 字节。");
  return raw;
}

export function AuthPage() {
  const { call, signIn } = useV2();
  const route = useLocation();
  const nav = useNavigate();
  const byPassword = route.pathname === "/auth/password";
  const forgot = route.pathname === "/auth/forgot";
  const params = new URLSearchParams(route.search);
  const next = forgot ? "/settings/password" : safeNext(params.get("next"));
  const policy = usePolicy();
  return (
    <section className="v2-panel v2-narrow">
      <h1>
        {forgot ? "找回密码" : byPassword ? "密码登录" : "手机登录 / 注册"}
      </h1>
      {forgot && (
        <p>
          先用已绑定的手机号登录，再设置新密码。没有绑定手机号时，请联系管理员。
        </p>
      )}
      <nav className="v2-tabs" aria-label="登录方式">
        <Link
          aria-current={!byPassword ? "page" : undefined}
          to={"/auth?next=" + encodeURIComponent(next)}
        >
          手机验证码
        </Link>
        <Link
          aria-current={byPassword ? "page" : undefined}
          to={"/auth/password?next=" + encodeURIComponent(next)}
        >
          密码
        </Link>
      </nav>
      <Form
        key={route.pathname}
        label="登录"
        submit={async (data, signal) => {
          const version = policy.data?.version;
          const accepted = data.get("accept") === "on";
          if (!byPassword && (policy.isPending || policy.error))
            throw new Error("请先加载当前政策。");
          if (!byPassword && version && !accepted)
            throw new Error("请阅读并同意两份政策文件。");
          const policyVersion = accepted ? (version ?? undefined) : undefined;
          try {
            const token = byPassword
              ? await call("login", {
                  public: true,
                  signal,
                  body: {
                    userName: value(data, "userName"),
                    password: String(data.get("password") ?? ""),
                    device: "WEB",
                    policyVersion,
                  },
                })
              : await call("phoneLogin", {
                  public: true,
                  signal,
                  body: {
                    mobile: mobile(data),
                    code: value(data, "code"),
                    device: "WEB",
                    policyVersion,
                  },
                });
            signIn(token);
            nav(next, { replace: true });
          } catch (error) {
            if (
              error instanceof ApiError &&
              [20005, 20009].includes(Number(error.code))
            )
              await policy.refetch();
            throw error;
          }
        }}
      >
        {byPassword ? (
          <>
            <label>
              手机号或登录名
              <input name="userName" required autoComplete="username" />
            </label>
            <label>
              密码
              <input
                name="password"
                required
                type="password"
                autoComplete="current-password"
              />
            </label>
          </>
        ) : (
          <>
            <PhoneInput />
            <CodeInput />
            <SmsButton
              send={(data, signal) =>
                call("phoneCode", {
                  body: { mobile: mobile(data) },
                  public: true,
                  signal,
                })
              }
            />
          </>
        )}
        {policy.data?.version && (
          <>
            <PolicyDocuments policy={policy.data} />
            <label className="v2-check">
              <input
                key={policy.data.version}
                type="checkbox"
                name="accept"
                required={!byPassword}
              />
              我已阅读并同意以上两份文件
            </label>
          </>
        )}
        {!byPassword && policy.isPending && <p role="status">正在加载政策…</p>}
        {!byPassword && policy.error && (
          <button type="button" onClick={() => void policy.refetch()}>
            重新加载政策
          </button>
        )}
      </Form>
      {byPassword && <Link to="/auth/forgot">忘记密码</Link>}
    </section>
  );
}

export function Verification() {
  const { call, user, refreshIdentity } = useV2();
  const task = useAction();
  const verify = useQuery({
    queryKey: ["v2", "verify"],
    queryFn: ({ signal }) => call("verify", { signal }),
  });
  const [callback, setCallback] = useState(verificationLink);
  const [success, setSuccess] = useState(false);
  const refresh = async () => {
    await Promise.all([verify.refetch(), refreshIdentity()]);
  };
  const confirm = () =>
    void task.run(async (signal) => {
      if (!callback?.secret) return;
      if (callback.kind === "sdu") {
        let owner: string | null = null;
        try {
          owner = sessionStorage.getItem(ssoOwnerKey);
        } catch {
          /* Storage is optional. */
        }
        if (!user?.id || (owner && owner !== String(user.id)))
          throw new Error("请切换回发起认证的账号。");
        await call("sduConfirm", { body: { ticket: callback.secret }, signal });
        try {
          sessionStorage.removeItem(ssoOwnerKey);
        } catch {
          /* Storage is optional. */
        }
      } else
        await call("verifyEmail", { body: { token: callback.secret }, signal });
      verificationLink = undefined;
      setCallback(undefined);
      setSuccess(true);
      await refresh();
    });
  return (
    <section className="v2-panel v2-narrow">
      <h1>学生认证</h1>
      <QueryState query={verify}>
        <p>{verify.data?.verified ? "已通过学生认证" : "请选择一种认证方式"}</p>
      </QueryState>
      {success && <Notice message="认证成功。" />}
      {callback?.error && <Notice error={callback.error} />}
      {callback?.secret && (
        <button className="v2-primary" disabled={task.busy} onClick={confirm}>
          {callback.kind === "sdu" ? "确认学校认证" : "确认学校邮箱"}
        </button>
      )}
      <button
        disabled={task.busy}
        onClick={() =>
          void task.run(async (signal) => {
            const start = await call("startSso", {
              query: { client: "web" },
              signal,
            });
            if (!start?.url) throw new Error("认证地址不可用。");
            if (isV2Demo) {
              verificationLink = { kind: "sdu", secret: "demo-ticket" };
              setCallback(verificationLink);
            } else {
              const target = new URL(start.url);
              if (target.protocol !== "https:")
                throw new Error("认证地址无效。");
              try {
                if (user?.id)
                  sessionStorage.setItem(ssoOwnerKey, String(user.id));
              } catch {
                /* Storage is optional. */
              }
              location.assign(target.href);
            }
          })
        }
      >
        学校统一认证
      </button>
      <Notice {...task} />
      <Form
        label="发送认证邮件"
        success="请打开邮件中的链接完成认证。"
        submit={async (data, signal) => {
          await call("sendEmail", {
            body: { email: value(data, "email") },
            signal,
          });
          if (isV2Demo) {
            verificationLink = { kind: "email", secret: "demo-mail-token" };
            setCallback(verificationLink);
          }
        }}
      >
        <label>
          学校邮箱
          <input name="email" type="email" required autoComplete="email" />
        </label>
      </Form>
    </section>
  );
}

export function AccountSettings({ page }: { page: string }) {
  const { user, call, refreshIdentity } = useV2();
  const [step, setStep] = useState(1);
  const [newMobile, setNewMobile] = useState("");
  const sms = (signal: AbortSignal) => call("passwordCode", { signal });
  const refresh = async (work: Promise<unknown>) => {
    await work;
    await refreshIdentity();
  };
  let content: ReactNode;
  let title: string;
  if (page === "phone") {
    title = user?.phone ? "换绑手机号" : "绑定手机号";
    content = !user?.phone ? (
      <Form
        success="手机号已绑定。"
        submit={(data, signal) =>
          refresh(
            call("bindMobile", {
              body: { mobile: mobile(data), code: value(data, "code") },
              signal,
            }),
          )
        }
      >
        <PhoneInput />
        <CodeInput />
        <SmsButton
          send={(data, signal) =>
            call("userCode", { body: { mobile: mobile(data) }, signal })
          }
        />
      </Form>
    ) : (
      <Form
        key={step}
        label={step === 1 ? "验证旧号码" : "确认换绑"}
        submit={async (data, signal) => {
          if (step === 1) {
            const next = mobile(data);
            await call("changeNewCode", {
              body: { oldCode: value(data, "oldCode"), mobile: next },
              signal,
            });
            setNewMobile(next);
            setStep(2);
          } else {
            await refresh(
              call("changeCommit", {
                body: { mobile: newMobile, code: value(data, "code") },
                signal,
              }),
            );
            setNewMobile("");
            setStep(1);
          }
        }}
        success={step === 2 ? "手机号已换绑。" : undefined}
      >
        {step === 1 ? (
          <>
            <SmsButton
              label="向旧手机号发送验证码"
              send={(_, signal) => call("changeOldCode", { signal })}
            />
            <CodeInput name="oldCode" label="旧手机号验证码" />
            <PhoneInput label="新手机号" />
          </>
        ) : (
          <>
            <p>新手机号 {newMobile}</p>
            <CodeInput label="新手机号验证码" />
            <SmsButton
              send={(_, signal) =>
                call("changeNewCode", { body: { mobile: newMobile }, signal })
              }
            />
            <button type="button" onClick={() => setStep(1)}>
              修改新手机号
            </button>
          </>
        )}
      </Form>
    );
  } else if (page === "password") {
    title = "密码";
    content = (
      <>
        {user?.hasPassword && (
          <Form
            label="修改密码"
            success="密码已修改。"
            submit={(data, signal) =>
              call("changePassword", {
                body: {
                  oldPassword: String(data.get("oldPassword") ?? ""),
                  newPassword: password(data, "newPassword"),
                },
                signal,
              })
            }
          >
            <label>
              旧密码
              <input
                name="oldPassword"
                type="password"
                required
                autoComplete="current-password"
              />
            </label>
            <PasswordInput />
          </Form>
        )}
        {user?.phone ? (
          <Form
            label={user.hasPassword ? "用验证码重置密码" : "设置密码"}
            success="密码已保存。"
            submit={(data, signal) =>
              refresh(
                call("passwordReset", {
                  body: {
                    code: value(data, "code"),
                    newPassword: password(data, "newPassword"),
                  },
                  signal,
                }),
              )
            }
          >
            <CodeInput />
            <SmsButton send={(_, signal) => sms(signal)} />
            <PasswordInput />
          </Form>
        ) : (
          <Link to="/settings/phone">绑定手机号</Link>
        )}
      </>
    );
  } else {
    title = "登录名";
    content = user?.hasUsername ? (
      <p>{user.userName}</p>
    ) : user?.phone ? (
      <Form
        label="设置登录名"
        success="登录名已设置。"
        submit={async (data, signal) => {
          const userName = value(data, "userName");
          await call("checkUsername", {
            body: { userName },
            public: true,
            signal,
          });
          await refresh(
            call("usernameSet", {
              body: {
                userName,
                code: value(data, "code"),
                newPassword: user.hasPassword
                  ? undefined
                  : password(data, "newPassword") || undefined,
              },
              signal,
            }),
          );
        }}
      >
        <label>
          登录名
          <input name="userName" required autoComplete="username" />
        </label>
        <CodeInput />
        <SmsButton send={(_, signal) => sms(signal)} />
        {!user.hasPassword && (
          <PasswordInput optional label="同时设置密码（可选）" />
        )}
      </Form>
    ) : (
      <Link to="/settings/phone">绑定手机号</Link>
    );
  }
  return (
    <section className="v2-panel v2-narrow">
      <Link to="/settings">返回设置</Link>
      <h1>{title}</h1>
      {content}
    </section>
  );
}

export function Devices() {
  const { call, signOut } = useV2();
  const nav = useNavigate();
  const client = useQueryClient();
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const cursor = cursors.at(-1);
  const devices = useQuery({
    queryKey: ["v2", "devices", cursor],
    queryFn: ({ signal }) =>
      call("sessions", { query: { cursor, size: 20 }, signal }),
  });
  const task = useAction();
  const reload = async () => {
    setCursors([undefined]);
    await client.invalidateQueries({ queryKey: ["v2", "devices"] });
  };
  return (
    <section className="v2-panel">
      <Link to="/settings">返回设置</Link>
      <h1>登录设备</h1>
      <QueryState query={devices} empty={!devices.data?.devices?.length}>
        <ul className="v2-list">
          {devices.data?.devices?.map((device) => (
            <li key={device.sessionId}>
              <div>
                <strong>
                  {device.device || "设备"}
                  {device.current ? " · 当前设备" : ""}
                </strong>
                <p>{dateTime(device.issuedAt)}</p>
              </div>
              <button
                disabled={task.busy}
                onClick={() => {
                  if (!device.sessionId || !confirm("此设备将退出登录，继续？"))
                    return;
                  void task.run(async (signal) => {
                    await call("revoke", {
                      path: { sessionId: device.sessionId! },
                      signal,
                    });
                    if (device.current) {
                      await signOut();
                      nav("/auth", { replace: true });
                    } else await reload();
                  }, "设备已下线。");
                }}
              >
                下线
              </button>
            </li>
          ))}
        </ul>
      </QueryState>
      <div className="v2-actions">
        <button
          disabled={task.busy}
          onClick={() => {
            if (confirm("其他所有设备将退出登录，继续？"))
              void task.run(async (signal) => {
                await call("revokeOthers", { signal });
                await reload();
              }, "其他设备已下线。");
          }}
        >
          下线其他设备
        </button>
        {cursors.length > 1 && (
          <button onClick={() => setCursors((old) => old.slice(0, -1))}>
            上一页
          </button>
        )}
        {devices.data?.nextCursor && (
          <button
            onClick={() =>
              setCursors((old) => [
                ...old,
                devices.data?.nextCursor ?? undefined,
              ])
            }
          >
            下一页
          </button>
        )}
      </div>
      <Notice {...task} />
    </section>
  );
}
