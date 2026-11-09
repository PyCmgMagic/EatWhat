import { useQuery } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { Select } from "../components/Select";
import type { ProfileForm } from "../desktop/profile";
import "./profile-editor.css";

export default function ProfileEditor({
  form,
  avatar,
  avatarOpen,
  busy,
  onChange,
  onAvatar,
  onSave,
  onCancel,
}: {
  form: ProfileForm;
  avatar?: string;
  avatarOpen: boolean;
  busy: boolean;
  onChange: (patch: Partial<ProfileForm>) => void;
  onAvatar: () => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { api } = useApp();
  const provinces = useQuery({
    queryKey: ["provinces"],
    queryFn: () => api.provinces(),
  });
  const cities = useQuery({
    queryKey: ["cities", form.province],
    queryFn: () => api.cities(form.province!),
    enabled: !!form.province,
  });
  const today = new Date();
  const maxDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <main
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
            {avatar ? (
              <img src={avatar} alt="" />
            ) : (
              form.name.slice(0, 1) || "食"
            )}
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
              签名，选填 <span>{form.signature.length} / 30</span>
            </label>
            <input
              id="sign"
              placeholder="一句话介绍自己"
              value={form.signature}
              maxLength={30}
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
          <div className="mobile-profile-editor-field">
            <label htmlFor="home-province">家乡，选填</label>
            <div className="mobile-profile-editor-pair">
              <Select
                id="home-province"
                aria-label="家乡省份"
                value={form.province ?? ""}
                disabled={provinces.isPending || provinces.isError}
                onChange={(event) =>
                  onChange({
                    province: Number(event.target.value) || null,
                    city: null,
                  })
                }
              >
                <option value="">选择省份</option>
                {form.province &&
                  !provinces.data?.some(
                    (province) => province.id === form.province,
                  ) && <option value={form.province}>已保存的省份</option>}
                {provinces.data
                  ?.filter((province) => province.id)
                  .map((province) => (
                    <option key={province.id} value={province.id!}>
                      {province.name}
                    </option>
                  ))}
              </Select>
              <Select
                aria-label="家乡城市"
                value={form.city ?? ""}
                disabled={!form.province || cities.isPending || cities.isError}
                onChange={(event) =>
                  onChange({ city: Number(event.target.value) || null })
                }
              >
                <option value="">
                  {form.province ? "选择城市" : "先选择省份"}
                </option>
                {form.city &&
                  !cities.data?.some((city) => city.id === form.city) && (
                    <option value={form.city}>已保存的城市</option>
                  )}
                {cities.data
                  ?.filter((city) => city.id)
                  .map((city) => (
                    <option key={city.id} value={city.id!}>
                      {city.name}
                    </option>
                  ))}
              </Select>
            </div>
            {(provinces.isError || (form.province && cities.isError)) && (
              <small className="mobile-profile-dictionary-status" role="status">
                {provinces.isError
                  ? "省份列表暂时无法加载"
                  : "城市列表暂时无法加载"}
                <button
                  type="button"
                  onClick={() =>
                    void (provinces.isError
                      ? provinces.refetch()
                      : cities.refetch())
                  }
                >
                  重试
                </button>
              </small>
            )}
          </div>
        </fieldset>
      </form>
    </main>
  );
}
