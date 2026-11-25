import { BRAND_NAME } from "../app/brand";
import { AvatarImage } from "../components/AvatarImage";
import { useFeedbackState } from "../components/feedback";
import { Select } from "../components/Select";
import { useContext, useEffect, useRef, useState, type FormEvent } from "react";
import { ProfileNavigationGuardContext } from "../app/profile-workspace";
import { useNavigate } from "react-router-dom";
import { Crop, Undo2 } from "lucide-react";
import { useApp } from "../app/state";
import { errorMessage } from "../api/client";
import { mediaUrl } from "../api/models";
import { validateFiles } from "../api/validation";
import { DesignIcon as Icon, type Draft } from "../mobile/ui";
import { PROFILE_SIGNATURE_LIMIT, profileClearError } from "./profile";
import CropDialog from "./CropDialog";
import { useSurfaceDismiss } from "../motion/hooks";
import { usePageLifetime } from "../app/drafts";
import { useProfileDraft } from "../app/profile-draft";
import { useProfileReturnTo } from "../app/profile-navigation";
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
    nav = useNavigate();
  const profile = useProfileDraft()!;
  const { form, saved, avatar, phase } = profile;
  const active = usePageLifetime();
  const [cropping, setCropping] = useState<Avatar | null>(null);
  const [dragging, setDragging] = useState(false);
  const busy = !!phase;
  const [, setError] = useFeedbackState(),
    [notice, setNotice] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveTo, setLeaveTo] = useState(returnTo);
  const navigationGuard = useContext(ProfileNavigationGuardContext);
  const input = useRef<HTMLInputElement>(null),
    changeAvatar = useRef<HTMLButtonElement>(null),
    saveBar = useRef<HTMLElement>(null),
    leaveDialog = useRef<HTMLDialogElement>(null);
  const dismissLeave = useSurfaceDismiss(leaveDialog, () => setLeaving(false));
  const dirty = !!avatar || JSON.stringify(form) !== JSON.stringify(saved);
  const clearError = profileClearError(form, saved);
  const nameInvalid =
    form.name.trim().length < 2 || form.name.trim().length > 12;
  const avatarUrl = avatar?.url || mediaUrl(app.user?.avatar);
  const saveStatus = busy ? phase : notice || (dirty ? "有修改尚未保存" : "");
  const unknownBirthday = form.birthday === undefined;
  const today = new Date(),
    maxDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  useEffect(() => {
    document.title = `编辑个人资料 · ${BRAND_NAME}`;
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
    profile.change(patch);
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
    profile.reset();
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
    if (busy || !dirty) return;
    setNameTouched(true);
    if (clearError) {
      setError(clearError);
      return;
    }
    if (nameInvalid) {
      document.getElementById("nick")?.focus();
      return;
    }
    if (form.signature.length > PROFILE_SIGNATURE_LIMIT) {
      setError(`个性签名最多填写 ${PROFILE_SIGNATURE_LIMIT} 个字。`);
      return;
    }
    if (form.birthday && form.birthday > maxDate) {
      setError("生日不能晚于今天。");
      return;
    }
    setError("");
    setNotice("");
    try {
      if (!(await profile.save())) return;
      setNotice("修改已保存，个人主页已同步更新。");
      app.toast("个人资料已更新");
    } catch (e) {
      if (!(e instanceof Error && e.name === "AbortError"))
        setError(errorMessage(e));
    }
  }

  return (
    <div className="pc-profile-editor">
      <PageHead
        title="编辑个人资料"
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
        <fieldset
          disabled={busy}
          onFocus={({ target }) => {
            const bar = saveBar.current;
            if (
              bar &&
              target.getBoundingClientRect().bottom >
                bar.getBoundingClientRect().top
            )
              target.scrollIntoView({ block: "nearest", behavior: "instant" });
          }}
        >
          <Section title="基本资料">
            <div className="pc-profile-basics">
              <div
                className={`pc-profile-avatar-row${dragging ? " is-dragging" : ""}`}
                onDragOver={(e) => {
                  if (busy || !e.dataTransfer.types.includes("Files")) return;
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={(e) => {
                  if (
                    !(e.relatedTarget instanceof Node) ||
                    !e.currentTarget.contains(e.relatedTarget)
                  )
                    setDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  pick(Array.from(e.dataTransfer.files));
                }}
              >
                <button
                  type="button"
                  className="pc-profile-avatar-picker"
                  aria-label="选择头像图片"
                  aria-describedby="pc-profile-avatar-hint"
                  onClick={() => input.current?.click()}
                >
                  <AvatarImage src={avatarUrl} alt="头像预览" />
                  <i aria-hidden="true">
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
                  <h3>头像</h3>
                  <div className="pc-profile-avatar-actions">
                    <button
                      ref={changeAvatar}
                      type="button"
                      className="pc-profile-action pc-profile-avatar-change"
                      onClick={() => input.current?.click()}
                    >
                      <Icon name="image" size={16} />
                      更换头像
                    </button>
                    {avatar && (
                      <>
                        <button
                          type="button"
                          className="pc-profile-action"
                          onClick={() => setCropping(avatar)}
                        >
                          <Crop size={14} aria-hidden="true" />
                          调整取景
                        </button>
                        <button
                          type="button"
                          className="pc-profile-action"
                          onClick={() => {
                            profile.setAvatar(null);
                            changeAvatar.current?.focus();
                          }}
                        >
                          <Undo2 size={14} aria-hidden="true" />
                          撤销头像更换
                        </button>
                      </>
                    )}
                  </div>
                  <p id="pc-profile-avatar-hint">
                    可拖入 JPG、PNG、WebP，最大 10 MB
                  </p>
                </div>
              </div>
              <div className="pc-profile-fields">
                <div className="pc-profile-field">
                  <label htmlFor="nick">
                    昵称
                    <small aria-hidden="true">{form.name.length} / 12</small>
                  </label>
                  <input
                    id="nick"
                    autoComplete="nickname"
                    required
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
                      ? "昵称需要 2–12 个字。"
                      : "2–12 个字"}
                  </p>
                </div>
                <div className="pc-profile-field">
                  <label htmlFor="sign">
                    个性签名
                    <small aria-hidden="true">
                      {form.signature.length} / {PROFILE_SIGNATURE_LIMIT}
                    </small>
                  </label>
                  <textarea
                    id="sign"
                    rows={2}
                    maxLength={PROFILE_SIGNATURE_LIMIT}
                    value={form.signature}
                    onChange={(e) => change({ signature: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </Section>
          <Section title="更多资料">
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
                <div className="pc-profile-field-heading">
                  <label htmlFor="profile-birthday">生日</label>
                  {(form.birthday || unknownBirthday) && (
                    <button
                      type="button"
                      className="pc-profile-action"
                      aria-label="清除生日"
                      onClick={() => change({ birthday: "" })}
                    >
                      清除
                    </button>
                  )}
                </div>
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
            </div>
          </Section>
        </fieldset>
        <footer ref={saveBar} className="pc-profile-savebar">
          <div
            className={`pc-profile-save-status ${notice ? "is-saved" : ""}`}
            role="status"
          >
            {saveStatus && (
              <>
                <Icon name={notice ? "check" : "edit"} size={16} />
                <span>{saveStatus}</span>
              </>
            )}
          </div>
          <div className="pc-profile-save-actions">
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
              className="pc-button pc-profile-primary"
              disabled={busy || !dirty}
            >
              <Icon name="check" size={17} />
              {busy ? "正在保存…" : "保存修改"}
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
            if (!active.current) return;
            profile.setAvatar({
              file: result.file,
              original: cropping.original ?? cropping.file,
              url: URL.createObjectURL(result.file),
              framing,
            });
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
          <p>离开后，本次修改将丢失。</p>
          <div>
            <button type="button" className="pc-button" onClick={dismissLeave}>
              继续编辑
            </button>
            <button
              type="button"
              className="pc-button light pc-profile-discard"
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
