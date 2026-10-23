import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { isDemo } from "../app/runtime";
import { ErrorState, Icon } from "../components/ui";
import { useTask } from "../components/useTask";
export function ProfileExtras() {
  const { api, user, refreshMe } = useApp(),
    [province, setProvince] = useState<number | undefined>(
      user?.hometownProvinceId ?? undefined,
    ),
    [city, setCity] = useState<number | undefined>(
      user?.hometownCityId ?? undefined,
    );
  const provinces = useQuery({
      queryKey: ["provinces"],
      queryFn: () => api.provinces(),
    }),
    cities = useQuery({
      queryKey: ["cities", province],
      queryFn: () => api.cities(province!),
      enabled: !!province,
    }),
    task = useTask("个人资料已更新", refreshMe);
  return (
    <section className="settings-card">
      <div className="section-title">
        <h2>再多认识你一点</h2>
        <Icon name="leaf" />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          task.run(() =>
            api.updateProfile({
              gender: String(d.get("gender") || "") || undefined,
              birthday: String(d.get("birthday") || "") || undefined,
              hometownProvinceId: province,
              hometownCityId: city,
            }),
          );
        }}
      >
        <div className="form-two-cols">
          <div>
            <label className="form-label" htmlFor="profile-gender">
              性别 <span className="optional">选填</span>
            </label>
            <select
              className="field"
              id="profile-gender"
              name="gender"
              defaultValue={user?.gender || ""}
            >
              <option value="">暂不填写</option>
              <option value="male">男</option>
              <option value="female">女</option>
              <option value="other">其他</option>
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="profile-birthday">
              生日 <span className="optional">选填</span>
            </label>
            <input
              className="field"
              id="profile-birthday"
              name="birthday"
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              defaultValue={
                typeof user?.birthday === "string" ? user.birthday : ""
              }
            />
          </div>
        </div>
        {typeof user?.birthday === "number" && (
          <p className="section-caption">
            服务端生日采用时间戳。为避免跨时区偏移，留空将保留已有生日，重新选择才会更新。
          </p>
        )}
        <label className="form-label" htmlFor="home-province">
          家乡
        </label>
        <div className="form-two-cols">
          <select
            id="home-province"
            className="field"
            value={province ?? ""}
            onChange={(e) => {
              setProvince(Number(e.target.value) || undefined);
              setCity(undefined);
            }}
            disabled={provinces.isPending || provinces.isError}
          >
            <option value="">选择省份</option>
            {provinces.data?.map((p) => (
              <option key={p.id} value={p.id!}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            aria-label="家乡城市"
            className="field"
            value={city ?? ""}
            onChange={(e) => setCity(Number(e.target.value) || undefined)}
            disabled={!province || cities.isPending || cities.isError}
          >
            <option value="">选择城市</option>
            {cities.data?.map((c) => (
              <option key={c.id} value={c.id!}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {provinces.error && (
          <ErrorState
            error={provinces.error}
            retry={() => void provinces.refetch()}
          />
        )}
        {cities.error && (
          <ErrorState
            error={cities.error}
            retry={() => void cities.refetch()}
          />
        )}
        {task.error && <ErrorState error={task.error} />}
        <button className="btn btn-primary" disabled={task.isPending}>
          保存补充资料
        </button>
      </form>
    </section>
  );
}
export function MobileBinding() {
  const { api, user, refreshMe } = useApp(),
    [mobile, setMobile] = useState(""),
    [sentTo, setSentTo] = useState(""),
    [until, setUntil] = useState(0);
  const send = useTask("验证码已发送"),
    bind = useTask("手机号已绑定", refreshMe);
  return (
    <section className="settings-card">
      <div className="section-title">
        <h2>绑定手机号</h2>
        <Icon name="shield" />
      </div>
      <p className="section-caption">
        {user?.phone
          ? `当前手机号：${user.phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2")}`
          : "绑定后可在平台支持的场景中验证账号。"}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          bind.run(async () => {
            if (sentTo !== mobile)
              throw new Error("请先为当前手机号获取验证码。");
            await api.bindMobile(mobile, String(d.get("code") || ""));
            setSentTo("");
          });
        }}
      >
        <label className="form-label" htmlFor="bind-mobile">
          手机号
        </label>
        <input
          className="field"
          id="bind-mobile"
          type="tel"
          autoComplete="tel"
          pattern="1[3-9][0-9]{9}"
          maxLength={11}
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          required
        />
        <button
          type="button"
          className="text-link"
          disabled={
            isDemo ||
            send.isPending ||
            (until > Date.now() && sentTo === mobile)
          }
          onClick={() => {
            const input = document.getElementById(
              "bind-mobile",
            ) as HTMLInputElement;
            if (input.reportValidity())
              send.run(async () => {
                await api.sendMobileCode(mobile);
                setSentTo(mobile);
                setUntil(Date.now() + 60000);
                setTimeout(() => setUntil(0), 60000);
              });
          }}
        >
          发送验证码
        </button>
        <label className="form-label" htmlFor="bind-code">
          6 位验证码
        </label>
        <input
          className="field"
          name="code"
          id="bind-code"
          autoComplete="one-time-code"
          minLength={6}
          maxLength={6}
          required
        />
        {send.error && <ErrorState error={send.error} />}
        {bind.error && <ErrorState error={bind.error} />}
        <button
          className="btn btn-primary"
          disabled={isDemo || bind.isPending || !sentTo}
        >
          确认绑定手机号
        </button>
        {isDemo && (
          <p className="section-caption">
            演示模式不发送验证码，也不绑定真实手机号。
          </p>
        )}
      </form>
    </section>
  );
}
