import { Select } from "../components/Select";
import { AvatarImage } from "../components/AvatarImage";
import { PROFILE_SIGNATURE_LIMIT, type ProfileForm } from "../desktop/profile";
import "./profile-editor.css";

export default function ProfileEditor({
  form,
  avatar,
  avatarOpen,
  busy,
  onChange,
  onAvatar,
  onUndoAvatar,
  onSave,
  onCancel,
}: {
  form: ProfileForm;
  avatar?: string;
  avatarOpen: boolean;
  busy: boolean;
  onChange: (patch: Partial<ProfileForm>) => void;
  onAvatar: () => void;
  onUndoAvatar?: () => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const today = new Date();
  const maxDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <section
      className="mobile-profile-editor"
      aria-labelledby="profile-editor-title"
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy) onSave();
        }}
      >
        <header className="mobile-profile-editor-header">
          <button type="button" disabled={busy} onClick={onCancel}>
            取消
          </button>
          <h1 id="profile-editor-title">编辑资料</h1>
          <button type="submit" className="mobile-profile-save" disabled={busy}>
            {busy ? "保存中…" : "保存"}
          </button>
        </header>
        <div className="mobile-profile-editor-avatar">
          <button
            type="button"
            className="mobile-profile-avatar-button"
            aria-label="换头像"
            aria-haspopup="dialog"
            aria-expanded={avatarOpen}
            disabled={busy}
            onClick={onAvatar}
          >
            <AvatarImage src={avatar} />
          </button>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={avatarOpen}
            disabled={busy}
            onClick={onAvatar}
          >
            换头像
          </button>
          {onUndoAvatar && (
            <button type="button" disabled={busy} onClick={onUndoAvatar}>
              撤销头像更换
            </button>
          )}
        </div>
        <fieldset className="mobile-profile-editor-fields" disabled={busy}>
          <div className="mobile-profile-editor-field">
            <label htmlFor="nick">
              昵称 <span>{form.name.length} / 12</span>
            </label>
            <input
              id="nick"
              autoComplete="nickname"
              value={form.name}
              maxLength={12}
              onChange={(event) => onChange({ name: event.target.value })}
            />
            <small>2–12 个字，可以和别人重名</small>
          </div>
          <div className="mobile-profile-editor-field">
            <label htmlFor="sign">
              签名，选填{" "}
              <span>
                {form.signature.length} / {PROFILE_SIGNATURE_LIMIT}
              </span>
            </label>
            <textarea
              id="sign"
              rows={3}
              placeholder="一句话介绍自己"
              value={form.signature}
              maxLength={PROFILE_SIGNATURE_LIMIT}
              onChange={(event) => onChange({ signature: event.target.value })}
            />
          </div>
          <div className="mobile-profile-editor-pair">
            <div className="mobile-profile-editor-field">
              <label htmlFor="profile-gender">性别，选填</label>
              <Select
                id="profile-gender"
                value={form.gender}
                onChange={(event) => onChange({ gender: event.target.value })}
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
            <div className="mobile-profile-editor-field">
              <label htmlFor="profile-birthday">生日，选填</label>
              <input
                id="profile-birthday"
                type="date"
                value={form.birthday ?? ""}
                max={maxDate}
                onChange={(event) => onChange({ birthday: event.target.value })}
              />
              {form.birthday === undefined && (
                <small>已有生日会保留，重新选择可修改。</small>
              )}
            </div>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
