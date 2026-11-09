import { useFeedbackState } from "../components/feedback";
import { Select } from "../components/Select";
import { useContext, useEffect, useRef, useState, type FormEvent } from "react";
import { ProfileNavigationGuardContext } from "../app/profile-workspace";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { errorMessage } from "../api/client";
import { mediaUrl, type User } from "../api/models";
import { validateFiles } from "../api/validation";
import { DesignIcon as Icon, type Draft } from "../mobile/ui";
import { profileChanges, profileForm, profileClearError } from "./profile";
import CropDialog from "./CropDialog";
import { useSurfaceDismiss } from "../motion/hooks";
import { useMemoryDraft, useSessionDraft } from "../app/drafts";
import { useProfileReturnTo } from "../app/profile-navigation";
import { readSession, sessionSignal } from "../app/runtime";
import { PageHead, Section } from "./secondary";
import "./profile.css";

type Avatar = Draft["images"][number];

export default function DesktopProfile() {
  const returnTo = useProfileReturnTo();
  const returnLabel = returnTo.startsWith("/settings")
    ? "返回设置"
    : returnTo === "/me"
      ? "返回个人主页"
      : "返回原页面";
  const app = useApp(),
    cache = useQueryClient(),
    nav = useNavigate();
  const [saved, setSaved] = useState(() => profileForm(app.user!));
  const draftKey = `profile:${app.user?.id}`;
  const [form, setForm, clearFormDraft] = useSessionDraft(draftKey, saved);
  const [avatar, setAvatar, clearAvatarDraft] = useMemoryDraft<Avatar | null>(
    draftKey,
    null,
  );
  const [cropping, setCropping] = useState<Avatar | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false),
    [phase, setPhase] = useState("");
  const [error, setError] = useFeedbackState(),
    [notice, setNotice] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveTo, setLeaveTo] = useState(returnTo);
  const navigationGuard = useContext(ProfileNavigationGuardContext);
  const input = useRef<HTMLInputElement>(null),
    leaveDialog = useRef<HTMLDialogElement>(null);
  const dismissLeave = useSurfaceDismiss(leaveDialog, () => setLeaving(false));
  const saving = useRef(false),
    uploaded = useRef<{ file: File; key: string } | null>(null);
  const changes = profileChanges(form, saved);
  const dirty =
    !!avatar ||
    Object.keys(changes).length > 0 ||
    JSON.stringify(form) !== JSON.stringify(saved);
  const clearError = profileClearError(form, saved);
  const nameInvalid =
    form.name.trim().length < 2 || form.name.trim().length > 12;
  const provinces = useQuery({
    queryKey: ["provinces"],
    queryFn: () => app.api.provinces(),
  });
  const cities = useQuery({
    queryKey: ["cities", form.province],
    queryFn: () => app.api.cities(form.province!),
    enabled: form.province !== null,
  });
  const avatarUrl = avatar?.url || mediaUrl(app.user?.avatar);
  const unknownBirthday = form.birthday === undefined;
  const today = new Date(),
    maxDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  useEffect(() => {
    document.title = "编辑个人资料 · 山软今天吃什么";
  }, []);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    if (dirty || busy) window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy]);
  useEffect(() => {
    if (leaving) leaveDialog.current?.showModal();
  }, [leaving]);
  useEffect(() => {
    if (!navigationGuard) return;
    const guard = (destination: string) => {
      if (busy) return false;
      if (!dirty) return true;
      setLeaveTo(destination);
      setLeaving(true);
      return false;
    };
    navigationGuard.current = guard;
    return () => {
      if (navigationGuard.current === guard) navigationGuard.current = null;
    };
  }, [busy, dirty, navigationGuard]);

  function change(patch: Partial<typeof form>) {
    setForm((current) => ({ ...current, ...patch }));
    setNotice("");
    setError("");
  }
  function pick(files: File[]) {
    if (busy || !files.length) return;
    setError("");
    setNotice("");
    try {
      if (files.length !== 1) throw new Error("一次选择一张头像图片。");
      validateFiles(files, 0);
      setCropping({ file: files[0], original: files[0], url: "" });
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  function reset() {
    if (avatar?.url) URL.revokeObjectURL(avatar.url);
    setForm(saved);
    setAvatar(null);
    clearFormDraft();
    clearAvatarDraft();
    uploaded.current = null;
    setError("");
    setNotice("");
    setNameTouched(false);
  }
  function back() {
    if (busy) return;
    setLeaveTo(returnTo);
    if (dirty) setLeaving(true);
    else nav(returnTo);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || !dirty) return;
    setNameTouched(true);
    if (clearError) {
      setError(clearError);
      return;
    }
    if (nameInvalid) {
      document.getElementById("nick")?.focus();
      return;
    }
    if (form.signature.length > 30) {
      setError("个性签名最多填写 30 个字。");
      return;
    }
    if (form.birthday && form.birthday > maxDate) {
      setError("生日不能晚于今天。");
      return;
    }
    saving.current = true;
    const owner = sessionSignal(app.session);
    const checkOwner = () => {
      readSession();
      owner.throwIfAborted();
    };
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const body = { ...changes };
      if (avatar) {
        if (uploaded.current?.file !== avatar.file) {
          setPhase("正在上传头像…");
          const key = await app.upload(avatar.file, "avatar");
          uploaded.current = { file: avatar.file, key };
        }
        body.avatar = uploaded.current!.key;
      }
      setPhase("正在保存资料…");
      await app.api.updateProfile(body);
      // A successful PUT acknowledges these fields even if readback is offline.
      let user: User = { ...app.user, ...body };
      try {
        user = await app.api.me();
      } catch (error) {
        checkOwner();
        if (error instanceof Error && error.name === "AbortError") throw error;
        /* Keep acknowledged changes. */
      }
      checkOwner();
      cache.setQueryData(["me"], user);
      const next = profileForm(user);
      setSaved(next);
      setForm(next);
      if (avatar?.url) URL.revokeObjectURL(avatar.url);
      setAvatar(null);
      clearFormDraft();
      clearAvatarDraft();
      uploaded.current = null;
      setNotice("修改已保存，个人主页已同步更新。");
      app.toast("个人资料已更新");
      void cache.invalidateQueries({ queryKey: ["user"] });
    } catch (e) {
      if (!owner.aborted) setError(errorMessage(e));
    } finally {
      saving.current = false;
      setBusy(false);
      setPhase("");
    }
  }

  return (
    <div className="pc-profile-editor">
      <PageHead
        title="编辑个人资料"
        detail="管理头像、昵称和个人信息，保存后同步到个人主页。"
        crumb={returnLabel}
        onBack={back}
        backDisabled={busy}
      />
      <form
        className="pc-profile-form"
        onSubmit={save}
        noValidate
        aria-label="个人资料表单"
      >
        <fieldset disabled={busy}>
          <Section title="基本资料" detail="头像、昵称和签名会展示在个人主页。">
            <div className="pc-profile-avatar-row">
              <button
                type="button"
                className={`pc-profile-avatar-picker ${dragging ? "is-dragging" : ""}`}
                aria-label="选择头像图片"
                disabled={busy}
                onClick={() => input.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  pick(Array.from(e.dataTransfer.files));
                }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="头像预览" />
                ) : (
                  <span>{form.name.trim().slice(0, 1) || "食"}</span>
                )}
                <i>
                  <Icon name="camera" size={17} />
                </i>
              </button>
              <input
                ref={input}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                aria-label="上传头像"
                onChange={(e) => {
                  pick(Array.from(e.target.files ?? []));
                  e.target.value = "";
                }}
              />
              <div className="pc-profile-avatar-details">
                <b>头像</b>
                <p>点击或拖入图片，支持 JPG、PNG、WebP，10 MB 以内。</p>
                <div className="pc-profile-avatar-actions">
                  <button
                    type="button"
                    className="pc-button light"
                    disabled={busy}
                    onClick={() => input.current?.click()}
                  >
                    <Icon name="image" size={16} />
                    更换头像
                  </button>
                  {avatar && (
                    <button
                      type="button"
                      className="pc-profile-text-button"
                      disabled={busy}
                      onClick={() => setCropping(avatar)}
                    >
                      调整取景
                    </button>
                  )}
                </div>

                {avatar && (
                  <button
                    type="button"
                    className="pc-profile-undo"
                    disabled={busy}
                    onClick={() => {
                      setAvatar(null);
                      uploaded.current = null;
                    }}
                  >
                    撤销头像更换
                  </button>
                )}
              </div>
            </div>
            <div className="pc-profile-fields">
              <div className="pc-profile-field">
                <label htmlFor="nick">
                  昵称<span className="pc-profile-required">必填</span>
                  <small>{form.name.length} / 12</small>
                </label>
                <input
                  id="nick"
                  autoComplete="nickname"
                  maxLength={12}
                  value={form.name}
                  onChange={(e) => change({ name: e.target.value })}
                  onBlur={() => setNameTouched(true)}
                  aria-invalid={nameTouched && nameInvalid}
                  aria-describedby="pc-profile-name-hint"
                />
                <p
                  id="pc-profile-name-hint"
                  className={
                    nameTouched && nameInvalid ? "pc-profile-invalid" : ""
                  }
                >
                  {nameTouched && nameInvalid
                    ? "昵称需要 2–12 个字，请调整后再保存。"
                    : "2–12 个字，可以和其他食友重名。"}
                </p>
              </div>
              <div className="pc-profile-field">
                <label htmlFor="sign">
                  个性签名<span>选填</span>
                  <small>{form.signature.length} / 30</small>
                </label>
                <textarea
                  id="sign"
                  rows={2}
                  maxLength={30}
                  placeholder="一句话介绍自己，或写下你的口味"
                  value={form.signature}
                  onChange={(e) => change({ signature: e.target.value })}
                />
              </div>
            </div>
          </Section>
          <Section
            title="更多资料"
            detail="以下信息均为选填，可以按自己的意愿填写。"
          >
            <div className="pc-profile-fields">
              <div className="pc-profile-field">
                <label htmlFor="profile-gender">性别</label>
                <Select
                  id="profile-gender"
                  value={form.gender}
                  onChange={(e) => change({ gender: e.target.value })}
                >
                  <option value="">暂不填写</option>
                  <option value="male">男</option>
                  <option value="female">女</option>
                  <option value="other">其他</option>
                  {form.gender &&
                    !["male", "female", "other"].includes(form.gender) && (
                      <option value={form.gender}>已设置</option>
                    )}
                </Select>
              </div>
              <div className="pc-profile-field">
                <label htmlFor="profile-birthday">
                  生日
                  {(form.birthday || unknownBirthday) && (
                    <button
                      type="button"
                      className="pc-profile-text-button"
                      onClick={() => change({ birthday: "" })}
                    >
                      清除
                    </button>
                  )}
                </label>
                <input
                  id="profile-birthday"
                  type="date"
                  value={form.birthday ?? ""}
                  max={maxDate}
                  onChange={(e) => change({ birthday: e.target.value })}
                />
                {unknownBirthday && (
                  <p>已设置生日，重新选择可修改，留空会保留。</p>
                )}
              </div>
              <div className="pc-profile-field">
                <label htmlFor="home-province">家乡省份</label>
                <Select
                  id="home-province"
                  value={form.province ?? ""}
                  disabled={provinces.isPending || provinces.isError}
                  onChange={(e) =>
                    change({
                      province: Number(e.target.value) || null,
                      city: null,
                    })
                  }
                >
                  <option value="">暂不填写</option>
                  {form.province &&
                    !provinces.data?.some((p) => p.id === form.province) && (
                      <option value={form.province}>已保存的省份</option>
                    )}
                  {provinces.data
                    ?.filter((p) => p.id)
                    .map((p) => (
                      <option key={p.id} value={p.id!}>
                        {p.name}
                      </option>
                    ))}
                </Select>
              </div>
              <div className="pc-profile-field">
                <label htmlFor="home-city">家乡城市</label>
                <Select
                  id="home-city"
                  value={form.city ?? ""}
                  disabled={
                    !form.province || cities.isPending || cities.isError
                  }
                  onChange={(e) =>
                    change({ city: Number(e.target.value) || null })
                  }
                >
                  <option value="">
                    {form.province ? "选择城市（选填）" : "先选择省份"}
                  </option>
                  {form.city &&
                    !cities.data?.some((c) => c.id === form.city) && (
                      <option value={form.city}>已保存的城市</option>
                    )}
                  {cities.data
                    ?.filter((c) => c.id)
                    .map((c) => (
                      <option key={c.id} value={c.id!}>
                        {c.name}
                      </option>
                    ))}
                </Select>
              </div>
            </div>
            {(provinces.error || (form.province && cities.error)) && (
              <div className="pc-profile-dictionary-error" role="alert">
                {provinces.error
                  ? "省份列表暂时无法加载"
                  : "城市列表暂时无法加载"}
                ，已保存的家乡会保留。
                <button
                  type="button"
                  onClick={() =>
                    void (provinces.error
                      ? provinces.refetch()
                      : cities.refetch())
                  }
                >
                  重新加载
                </button>
              </div>
            )}
          </Section>
        </fieldset>
        <footer className="pc-profile-savebar">
          <div
            className={`pc-profile-save-status ${notice ? "is-saved" : ""}`}
            role="status"
          >
            <Icon
              name={notice ? "check" : dirty ? "edit" : "check"}
              size={18}
            />
            <span>
              {busy
                ? phase
                : notice || (dirty ? "有修改尚未保存" : "资料已是最新状态")}
            </span>
          </div>
          <div>
            <button
              type="button"
              className="pc-button light"
              disabled={busy || !dirty}
              onClick={reset}
            >
              取消修改
            </button>
            <button
              type="submit"
              className="pc-button"
              disabled={busy || !dirty}
            >
              {busy ? "正在保存…" : "保存修改"}
              <Icon name="check" size={17} />
            </button>
          </div>
        </footer>
      </form>
      {cropping && (
        <CropDialog
          variant="avatar"
          image={cropping}
          onClose={() => setCropping(null)}
          onApply={(result, framing) => {
            if (avatar?.url) URL.revokeObjectURL(avatar.url);
            setAvatar({
              file: result.file,
              original: cropping.original ?? cropping.file,
              url: URL.createObjectURL(result.file),
              framing,
            });
            uploaded.current = null;
            setCropping(null);
            setNotice("");
          }}
        />
      )}
      {leaving && (
        <dialog
          ref={leaveDialog}
          className="pc-profile-leave"
          aria-labelledby="pc-profile-leave-title"
          onCancel={(e) => {
            e.preventDefault();
            dismissLeave();
          }}
        >
          <h2 id="pc-profile-leave-title">还有修改未保存</h2>
          <p>离开当前页面会放弃这次修改，继续编辑可以保留当前内容。</p>
          <div>
            <button
              type="button"
              className="pc-button light"
              onClick={dismissLeave}
            >
              继续编辑
            </button>
            <button
              type="button"
              className="pc-button"
              onClick={() => {
                reset();
                nav(leaveTo);
              }}
            >
              放弃修改并离开
            </button>
          </div>
        </dialog>
      )}
    </div>
  );
}
