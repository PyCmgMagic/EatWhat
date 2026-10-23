import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { errorMessage } from "../api/client";
import { mediaUrl, type User } from "../api/models";
import { validateFiles } from "../api/validation";
import { DesignIcon as Icon, type Draft } from "../mobile/ui";
import { profileChanges, profileForm, profileClearError } from "./profile";
import CropDialog from "./CropDialog";
import "./profile.css";

type Avatar = Draft["images"][number];

export default function DesktopProfile() {
  const app = useApp(),
    cache = useQueryClient(),
    nav = useNavigate();
  const [saved, setSaved] = useState(() => profileForm(app.user!));
  const [form, setForm] = useState(saved);
  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const [cropping, setCropping] = useState<Avatar | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false),
    [phase, setPhase] = useState("");
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    leaveDialog = useRef<HTMLDialogElement>(null);
  const saving = useRef(false),
    uploaded = useRef<{ file: File; key: string } | null>(null);
  const changes = profileChanges(form, saved);
  const dirty = !!avatar || Object.keys(changes).length > 0;
  const clearError = profileClearError(form,saved);
  const nameInvalid =
    form.name.trim().length < 3 || form.name.trim().length > 10;
  const provinces = useQuery({
    queryKey: ["provinces"],
    queryFn: () => app.api.provinces(),
  });
  const cities = useQuery({
    queryKey: ["cities", form.province],
    queryFn: () => app.api.cities(form.province!),
    enabled: form.province !== null,
  });
  const provinceName = provinces.data?.find(
    (p) => p.id === form.province,
  )?.name;
  const cityName = cities.data?.find((c) => c.id === form.city)?.name;
  const avatarUrl = avatar?.url || mediaUrl(app.user?.avatar);
  const unknownBirthday = form.birthday === undefined;
  const today = new Date(),
    maxDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  useEffect(() => {
    document.title = "编辑个人资料 · 山软今天吃什么";
  }, []);
  useEffect(
    () => () => {
      if (avatar?.url) URL.revokeObjectURL(avatar.url);
    },
    [avatar],
  );
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
    setForm(saved);
    setAvatar(null);
    uploaded.current = null;
    setError("");
    setNotice("");
    setNameTouched(false);
  }
  function back() {
    if (busy) return;
    if (dirty) setLeaving(true);
    else nav("/me");
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || !dirty) return;
    setNameTouched(true);
    if (clearError) { setError(clearError); return; }
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
      } catch {
        /* Keep acknowledged changes. */
      }
      cache.setQueryData(["me"], user);
      const next = profileForm(user);
      setSaved(next);
      setForm(next);
      setAvatar(null);
      uploaded.current = null;
      setNotice("修改已保存，个人主页已同步更新。");
      app.toast("个人资料已更新");
      void cache.invalidateQueries({ queryKey: ["user"] });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      saving.current = false;
      setBusy(false);
      setPhase("");
    }
  }

  return (
    <div className="pc-profile-editor">
      <header className="pc-profile-heading">
        <div>
          <div className="pc-breadcrumb">
            <Link
              to="/me"
              onClick={(e) => {
                e.preventDefault();
                back();
              }}
            >
              我的主页
            </Link>
            <Icon name="chevronRight" size={13} />
            <span>编辑个人资料</span>
          </div>
          <h1>
            编辑个人资料<span>让食友认识你</span>
          </h1>
          <p>换个新头像，写下你的口味，分享每一份好吃的。</p>
        </div>
        <button
          type="button"
          className="pc-profile-back"
          onClick={back}
          disabled={busy}
        >
          返回个人主页
          <Icon name="chevronRight" size={16} />
        </button>
      </header>
      <div className="pc-profile-editor-layout">
        <aside className="pc-profile-preview" aria-label="个人主页实时预览">
          <div className="pc-profile-cover">
            <span>主页预览</span>
            <Icon name="bowl" size={100} />
          </div>
          <div className="pc-profile-preview-body">
            <button
              type="button"
              className={`pc-profile-editor-avatar ${dragging ? "is-dragging" : ""}`}
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
            <h2>{form.name.trim() || "你的昵称"}</h2>
            <p className="pc-profile-preview-sign">
              {form.signature || "好好吃饭，认真生活。"}
            </p>
            <div className="pc-profile-preview-meta">
              {app.user?.verified && (
                <span>
                  <Icon name="verify" size={14} />
                  学生认证
                </span>
              )}
              {(provinceName || cityName) && (
                <span>
                  <Icon name="pin" size={14} />
                  {cityName || provinceName}
                </span>
              )}
            </div>
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
            <small>
              也可以将图片拖到头像上
              <br />
              JPG、PNG 或 WebP，10 MB 以内
            </small>
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
          <div className="pc-profile-preview-caption">
            <Icon name="me" size={15} />
            <span>
              这里会随你的修改实时更新
              <br />
              点击保存后，食友才能看到新资料
            </span>
          </div>
        </aside>
        <form
          className="pc-profile-form"
          onSubmit={save}
          noValidate
          aria-label="个人资料表单"
        >
          <fieldset disabled={busy}>
            <section
              className="pc-profile-section"
              aria-labelledby="pc-profile-basic"
            >
              <div className="pc-profile-section-heading">
                <div>
                  <h2 id="pc-profile-basic">基本资料</h2>
                  <p>头像、昵称和签名，组成你的第一印象。</p>
                </div>
                <span>展示在个人主页</span>
              </div>
              <div className="pc-profile-fields">
                <div className="pc-profile-field">
                  <label htmlFor="nick">
                    昵称<span className="pc-profile-required">必填</span>
                    <small>{form.name.length} / 10</small>
                  </label>
                  <input
                    id="nick"
                    autoComplete="nickname"
                    maxLength={10}
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
                      ? "昵称需要 3–10 个字，请调整后再保存。"
                      : "3–10 个字，可以和其他食友重名。"}
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
            </section>
            <section
              className="pc-profile-section"
              aria-labelledby="pc-profile-more"
            >
              <div className="pc-profile-section-heading">
                <div>
                  <h2 id="pc-profile-more">更多资料</h2>
                  <p>再多认识你一点，这些信息都可以选填。</p>
                </div>
                <Icon name="leaf" size={25} />
              </div>
              <div className="pc-profile-fields">
                <div className="pc-profile-field">
                  <label htmlFor="profile-gender">性别</label>
                  <select
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
                  </select>
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
                  <select
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
                  </select>
                </div>
                <div className="pc-profile-field">
                  <label htmlFor="home-city">家乡城市</label>
                  <select
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
                  </select>
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
            </section>
          </fieldset>
          {error && (
            <div className="pc-profile-feedback is-error" role="alert">
              <Icon name="info" size={18} />
              <span>{error} 修改已保留，请调整后重试。</span>
            </div>
          )}
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
      </div>
      {cropping && (
        <CropDialog
          variant="avatar"
          image={cropping}
          onClose={() => setCropping(null)}
          onApply={(result, framing) => {
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
          onCancel={() => setLeaving(false)}
        >
          <h2 id="pc-profile-leave-title">还有修改未保存</h2>
          <p>返回主页会放弃这次修改，继续编辑可以保留当前内容。</p>
          <div>
            <button
              type="button"
              className="pc-button light"
              onClick={() => {
                leaveDialog.current?.close();
                setLeaving(false);
              }}
            >
              继续编辑
            </button>
            <button
              type="button"
              className="pc-button"
              onClick={() => nav("/me")}
            >
              放弃修改并返回
            </button>
          </div>
        </dialog>
      )}
    </div>
  );
}
