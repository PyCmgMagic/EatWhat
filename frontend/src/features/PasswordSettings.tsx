import { useEffect, useId, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { isDemo } from "../app/runtime";
import { useApp } from "../app/state";
import { useTask } from "../components/useTask";
import { DesignIcon as Icon } from "../mobile/ui";
import { useSendSignal } from "./useSendSignal";
import "./password-settings.css";

type Method = "password" | "sms";
type Problem = { field: "password" | "confirm"; message: string };

const methods = [
  { value: "password", label: "当前密码", icon: "key" },
  { value: "sms", label: "短信验证码", icon: "phone" },
] as const;

function PasswordField({
  name,
  label,
  hint,
  error,
}: {
  name: "old" | "password" | "confirm";
  label: string;
  hint?: string;
  error?: string;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-settings-field">
      <label htmlFor={id}>{label}</label>
      <div className="password-settings-password">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={name === "old" ? "current-password" : "new-password"}
          autoCapitalize="none"
          spellCheck={false}
          minLength={name === "old" ? undefined : 6}
          maxLength={name === "old" ? undefined : 64}
          aria-invalid={error ? true : undefined}
          aria-describedby={hint || error ? `${id}-note` : undefined}
          required
        />
        <button
          type="button"
          aria-label={`${visible ? "隐藏" : "显示"}${label}`}
          onClick={() => setVisible(!visible)}
        >
          <Icon name={visible ? "eyeOff" : "eye"} size={19} />
        </button>
      </div>
      {(hint || error) && (
        <small id={`${id}-note`} role={error ? "alert" : undefined}>
          {error || hint}
        </small>
      )}
    </div>
  );
}

export default function PasswordSettings() {
  const { api, user, refreshMe } = useApp();
  const getSignal = useSendSignal();
  const [method, setMethod] = useState<Method>("password");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [revision, setRevision] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const send = useTask();
  const save = useTask();
  const codeId = useId();
  const hasPassword = user?.hasPassword !== false;
  const phone = user?.phone;
  const bySms = !hasPassword || (!!phone && method === "sms");
  const busy = send.isPending || save.isPending;
  const success = typeof save.data === "string" ? save.data : undefined;

  useEffect(() => {
    if (!cooldown) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((cooldown - Date.now()) / 1000));
      setSeconds(remaining);
      if (!remaining) setCooldown(0);
    };
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  function choose(next: Method) {
    setMethod(next);
    setProblem(null);
    save.reset();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const newPassword = String(data.get("password") ?? "");
    const oldPassword = String(data.get("old") ?? "");
    const issue: Problem | null =
      newPassword !== data.get("confirm")
        ? { field: "confirm", message: "两次输入的新密码不一致。" }
        : !bySms && newPassword === oldPassword
          ? { field: "password", message: "新密码需要与当前密码不同。" }
          : null;
    setProblem(issue);
    if (issue) {
      const input = form.elements.namedItem(issue.field);
      if (input instanceof HTMLInputElement) input.focus();
      return;
    }
    save.run(async () => {
      if (bySms) {
        await api.resetPassword({
          code: String(data.get("code") ?? ""),
          newPassword,
        });
        setMethod("sms");
        refreshMe();
      } else {
        await api.changePassword({ oldPassword, newPassword });
      }
      setRevision((value) => value + 1);
      return hasPassword ? "密码已更新。" : "密码已设置。";
    });
  }

  if (!hasPassword && !phone)
    return (
      <div className="password-settings password-settings-binding">
        <span className="password-settings-binding-icon">
          <Icon name="phone" size={22} />
        </span>
        <div>
          <strong>先绑定手机号</strong>
          <p>绑定后可用短信验证码设置密码。</p>
        </div>
        <Link to="/settings/bind-phone" className="password-settings-bind-link">
          去绑定 <Icon name="chevronRight" size={15} />
        </Link>
      </div>
    );

  return (
    <div className="password-settings">
      {hasPassword && phone && (
        <fieldset className="password-settings-methods" disabled={busy}>
          <legend>验证方式</legend>
          <div>
            {methods.map(({ value, label, icon }) => (
              <label key={value}>
                <input
                  type="radio"
                  name="password-verification-method"
                  value={value}
                  checked={method === value}
                  onChange={() => choose(value)}
                />
                <Icon name={icon} size={17} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <form
        key={revision}
        className="password-settings-form"
        aria-label={hasPassword ? "修改密码表单" : "设置密码表单"}
        aria-busy={save.isPending}
        onSubmit={submit}
        onInput={() => {
          if (problem) setProblem(null);
          if (save.isSuccess) save.reset();
        }}
      >
        <fieldset
          className="password-settings-fields"
          disabled={save.isPending}
        >
          {bySms && phone ? (
            <div className="password-settings-field">
              <label htmlFor={codeId}>6 位验证码</label>
              <div className="password-settings-code-row">
                <input
                  id={codeId}
                  name="code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  autoComplete="one-time-code"
                  aria-describedby={`${codeId}-phone`}
                  required
                />
                <button
                  type="button"
                  disabled={send.isPending || seconds > 0}
                  onClick={() =>
                    send.run(async () => {
                      await api.passwordCode(getSignal());
                      setSeconds(60);
                      setCooldown(Date.now() + 60000);
                    })
                  }
                >
                  {send.isPending
                    ? "正在发送…"
                    : seconds > 0
                      ? `${seconds} 秒后重发`
                      : send.isSuccess
                        ? "重新获取验证码"
                        : "获取验证码"}
                </button>
              </div>
              <small id={`${codeId}-phone`} role="status">
                {send.isSuccess ? "已发送至" : "发送至"}绑定手机号（尾号{" "}
                {phone.slice(-4)}）{isDemo && " · 演示验证码 123456"}
              </small>
            </div>
          ) : (
            <PasswordField name="old" label="当前密码" />
          )}
          <PasswordField
            name="password"
            label="新密码"
            hint="6–64 个字符"
            error={problem?.field === "password" ? problem.message : undefined}
          />
          <PasswordField
            name="confirm"
            label="再次输入新密码"
            error={problem?.field === "confirm" ? problem.message : undefined}
          />
        </fieldset>
        <button
          className="password-settings-submit"
          type="submit"
          disabled={busy}
        >
          {save.isPending
            ? "正在保存…"
            : hasPassword
              ? "更新密码"
              : "保存新密码"}
        </button>
      </form>
      {success && (
        <p className="password-settings-success" role="status">
          <Icon name="checkCircle" size={16} /> {success}
        </p>
      )}
    </div>
  );
}
