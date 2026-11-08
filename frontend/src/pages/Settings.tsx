import { useSendSignal } from "../features/useSendSignal";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { isDemo } from "../app/runtime";
import {
  ErrorState,
  Gate,
  Icon,
  Intro,
  Loading,
  Modal,
} from "../components/ui";
import { useTask } from "../components/useTask";
import { validateFiles } from "../api/validation";
import { ProfileExtras, MobileBinding } from "./ProfileExtras";
export default function Settings() {
  return (
    <>
      <Intro
        title="关于你，还有这些小事。"
        subtitle="完善资料、管理隐私，放心分享每一顿。"
      />
      <Gate verified={false}>
        <SettingsContent />
      </Gate>
    </>
  );
}
function SettingsContent() {
  const getSignal = useSendSignal();
  const { api, user, refreshMe, upload, signOut, toast } = useApp(),
    navigate = useNavigate(),
    [avatar, setAvatar] = useState<File | null>(null),
    [privacy, setPrivacy] = useState(false);
  const task = useTask("个人资料已更新", refreshMe),
    authTask = useTask("验证邮件已发送，请到邮箱中完成验证"),
    logout = useTask(undefined, () => navigate("/auth"));
  function profile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    task.run(async () => {
      const displayName = String(d.get("displayName")).trim();
      if (displayName.length < 2 || displayName.length > 12)
        throw new Error("昵称需要 2–12 个字符。");
      let key: string | undefined;
      if (avatar) key = await upload(avatar, "avatar");
      await api.updateProfile({
        displayName,
        signature: String(d.get("signature") || "").trim(),
        avatar: key,
      });
      setAvatar(null);
    });
  }
  const sdu = import.meta.env.VITE_SDU_AUTH_URL;
  return (
    <div className="settings-layout">
      <section className="settings-card">
        <div className="section-title">
          <h2>让同学认识你</h2>
          <Icon name="user" />
        </div>
        {isDemo && (
          <div className="demo-personas">
            <span className="muted">演示身份：</span>
            <a href="/?demo=1#/settings">已认证同学</a>
            <a href="/?demo=1&persona=unverified#/settings">未认证同学</a>
            <a href="/?demo=1&persona=admin#/admin">管理员</a>
          </div>
        )}
        <form onSubmit={profile}>
          <div className="field-group">
            <label className="form-label" htmlFor="profile-name">
              昵称 <span className="optional">2–12 个字符</span>
            </label>
            <input
              className="field"
              id="profile-name"
              name="displayName"
              defaultValue={user?.displayName || ""}
              minLength={2}
              maxLength={12}
              required
            />
          </div>
          <div className="field-group">
            <label className="form-label" htmlFor="profile-signature">
              一句话介绍自己
            </label>
            <textarea
              className="field"
              id="profile-signature"
              name="signature"
              defaultValue={user?.signature || ""}
              maxLength={255}
            />
          </div>
          <div className="field-group">
            <label className="form-label" htmlFor="profile-avatar">
              更换头像 <span className="optional">选填</span>
            </label>
            <input
              className="field"
              id="profile-avatar"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f)
                  try {
                    validateFiles([f], 0);
                    setAvatar(f);
                  } catch (error) {
                    toast(
                      error instanceof Error ? error.message : "图片无效。",
                    );
                    e.currentTarget.value = "";
                  }
              }}
            />
            <p className="section-caption">
              JPG / PNG / WebP，单张最多 10 MB，保存时上传。
            </p>
          </div>
          {task.error && <ErrorState error={task.error} />}
          <button className="btn btn-primary" disabled={task.isPending}>
            {task.isPending ? "正在保存…" : "保存个人资料"}
            <Icon name="check" />
          </button>
        </form>
      </section>
      <section className="settings-card">
        <div className="section-title">
          <h2>校内身份认证</h2>
          <Icon name="shield" />
        </div>
        <div
          className={`verification-status ${user?.verified ? "verified" : ""}`}
        >
          <Icon name="shield" />
          <div>
            <strong>
              {user?.verified ? "校内身份已认证" : "尚未完成认证"}
            </strong>
            <p>完成认证后可以查看菜品、收藏和发布分享。</p>
          </div>
        </div>
        <button className="text-link" onClick={refreshMe}>
          我已完成认证，刷新状态 ↻
        </button>
        {sdu ? (
          <a
            className="btn btn-secondary"
            href={sdu}
            target="_blank"
            rel="noopener noreferrer"
          >
            前往学校统一认证 ↗
          </a>
        ) : (
          <p className="section-caption">
            统一认证正在准备中，敬请期待。你可以先使用邮箱认证，或联系管理员。
          </p>
        )}
        <form
          className="verification-form"
          onSubmit={(e) => {
            e.preventDefault();
            const email = String(
              new FormData(e.currentTarget).get("email") || "",
            ).trim();
            authTask.run(async () => {
              const domain = import.meta.env.VITE_VERIFY_EMAIL_DOMAIN;
              if (
                domain &&
                !email.toLowerCase().endsWith("@" + domain.toLowerCase())
              )
                throw new Error(`请使用 @${domain} 邮箱。`);
              await api.sendEmail(email, getSignal());
            });
          }}
        >
          <label className="form-label" htmlFor="verify-email">
            认证邮箱
          </label>
          <input
            className="field"
            id="verify-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="输入你的认证邮箱"
            required
          />
          <button
            className="btn btn-primary"
            disabled={authTask.isPending || isDemo}
          >
            {authTask.isPending ? "正在发送…" : "发送认证邮件"}
          </button>
          {isDemo && <p className="section-caption">演示模式不会发送邮件。</p>}
        </form>
        {authTask.error && <ErrorState error={authTask.error} />}
      </section>
      <ProfileExtras />
      <MobileBinding />
      <section className="settings-card">
        <div className="section-title">
          <h2>账号与隐私</h2>
          <Icon name="settings" />
        </div>
        <PasswordForm />
        {user?.role === "admin" && (
          <Link className="btn btn-secondary" to="/admin">
            <Icon name="settings" />
            进入内容管理后台
          </Link>
        )}
        <div className="settings-links">
          <button onClick={() => setPrivacy(true)}>
            <Icon name="users" />
            关注关系可见性
            <Icon name="right" />
          </button>
        </div>
        <button
          className="btn btn-secondary"
          disabled={logout.isPending}
          onClick={() => logout.run(signOut)}
        >
          <Icon name="logout" />
          退出登录
        </button>
        {logout.error && <ErrorState error={logout.error} />}
        <p className="section-caption">
          {isDemo
            ? "当前为隔离的本地演示账号。"
            : "登录凭证保存在当前标签页会话中，关闭后需重新登录。"}
        </p>
      </section>
      {privacy && (
        <Modal
          title="我的关注关系，谁可以看？"
          onClose={() => setPrivacy(false)}
        >
          <Privacy onClose={() => setPrivacy(false)} />
        </Modal>
      )}
    </div>
  );
}
function PasswordForm() {
  const { api } = useApp(),
    task = useTask("密码已更新");
  return (
    <details className="password-details">
      <summary>修改登录密码</summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget,
            d = new FormData(form);
          task.run(async () => {
            const oldPassword = String(d.get("old") || ""),
              newPassword = String(d.get("new") || "");
            if (newPassword !== String(d.get("confirm") || ""))
              throw new Error("两次输入的新密码不一致。");
            await api.changePassword({ oldPassword, newPassword });
            form.reset();
          });
        }}
      >
        <label className="form-label" htmlFor="password-old">
          当前密码
        </label>
        <input
          className="field"
          id="password-old"
          name="old"
          type="password"
          autoComplete="current-password"
          required
        />
        <label className="form-label" htmlFor="password-new">
          新密码
        </label>
        <input
          className="field"
          id="password-new"
          name="new"
          type="password"
          minLength={6}
          maxLength={64}
          autoComplete="new-password"
          required
        />
        <label className="form-label" htmlFor="password-confirm">
          再次输入新密码
        </label>
        <input
          className="field"
          id="password-confirm"
          name="confirm"
          type="password"
          minLength={6}
          maxLength={64}
          autoComplete="new-password"
          required
        />
        {task.error && <ErrorState error={task.error} />}
        <button className="btn btn-primary" disabled={task.isPending}>
          更新密码
        </button>
      </form>
    </details>
  );
}
function Privacy({ onClose }: { onClose: () => void }) {
  const { api, user } = useApp(),
    q = useQuery({
      queryKey: ["user", user?.id],
      queryFn: () => api.otherUser(user!.id!),
      enabled: !!user?.id,
    }),
    task = useTask("隐私设置已保存", onClose, ["user"]);
  if (q.isPending) return <Loading />;
  if (q.isError)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  if (q.data.fansVisible == null || q.data.followingsVisible == null)
    return <p className="muted">未能读取当前隐私状态，请稍后重试。</p>;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const d = new FormData(e.currentTarget);
        task.run(() =>
          api.privacy({
            following: d.has("following"),
            follower: d.has("follower"),
          }),
        );
      }}
    >
      <label className="checkbox-line">
        <input
          type="checkbox"
          name="following"
          defaultChecked={q.data.followingsVisible}
        />
        允许其他同学查看我的关注
      </label>
      <label className="checkbox-line">
        <input
          type="checkbox"
          name="follower"
          defaultChecked={q.data.fansVisible}
        />
        允许其他同学查看我的粉丝
      </label>
      {task.error && <ErrorState error={task.error} />}
      <button className="btn btn-primary" disabled={task.isPending}>
        保存可见性
      </button>
    </form>
  );
}
