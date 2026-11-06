import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { useTask } from "../components/useTask";
import { errorMessage, unavailable } from "../api/client";
import { policyDocumentUrl } from "../api/consent";
import type { Schema } from "../api/models";
import { FeatureState } from "../features/Catalog";
import { useMobile } from "../mobile/ui";
import "../features/api-v2.css";

function Failure({ error }: { error: unknown }) {
  return error ? (
    <p className="ew-error" role="alert">
      {unavailable(error) ? "当前站点未开启此管理功能。" : errorMessage(error)}
    </p>
  ) : null;
}
export function AdminPolicy() {
  const { api } = useApp();
  const q = useQuery({
    queryKey: ["admin-policy"],
    queryFn: () => api.adminPolicy(),
    retry: false,
  });
  return (
    <section className="ew-feature">
      <h2>授权政策配置</h2>
      <p>维护政策版本与正文地址，仅权威站管理员可保存。</p>
      {q.isPending ? (
        <FeatureState loading />
      ) : q.isError ? (
        <>
          <Failure error={q.error} />
          <button className="ew-button light" onClick={() => void q.refetch()}>
            重新读取
          </button>
        </>
      ) : (
        <PolicyEditor initial={q.data} />
      )}
    </section>
  );
}
function PolicyEditor({
  initial,
}: {
  initial: Schema["ConsentPolicySettingsVOResponse"];
}) {
  const { api } = useApp(),
    cache = useQueryClient();
  const [version, setVersion] = useState(initial.version || ""),
    [url, setUrl] = useState(initial.url || ""),
    [revision, setRevision] = useState(initial.revision),
    [latest, setLatest] = useState(initial),
    [notice, setNotice] = useState("");
  const task = useTask(),
    reload = useTask();
  return (
    <div className="ew-v2-card ew-v2-account">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          task.run(async () => {
            if (revision == null)
              throw new Error("缺少当前修订号，请重新读取配置。");
            if (!policyDocumentUrl({ version, url }))
              throw new Error("正文地址需为 HTTPS URL 或站内绝对路径。");
            const saved = await api.saveAdminPolicy({
              version: version.trim(),
              url: url.trim(),
              expectedRevision: revision,
            });
            setRevision(saved.revision);
            setVersion(saved.version || "");
            setUrl(saved.url || "");
            setLatest(saved);
            setNotice("政策配置已保存。");
            cache.setQueryData(["admin-policy"], saved);
            await cache.invalidateQueries({ queryKey: ["consent-policy"] });
          });
        }}
      >
        <label>
          政策版本
          <input
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            pattern="[A-Za-z0-9][A-Za-z0-9._-]{0,63}"
            maxLength={64}
            required
          />
        </label>
        <label>
          完整政策正文地址
          <input
            aria-label="完整政策正文地址"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            maxLength={2048}
            required
            placeholder="/api/policies/政策版本.html"
          />
          <small>此处保存地址，请先在对应地址提供政策正文。</small>
        </label>
        <p className="ew-note">
          当前提交基于修订 {revision ?? "—"}
          。保存冲突时保留输入，重新读取后请比较服务端配置。
        </p>
        <details>
          <summary>最近读取的服务端配置</summary>
          <p>
            版本：{latest.version}
            <br />
            地址：{latest.url || "未配置"}
            <br />
            修订：{latest.revision}
          </p>
        </details>
        <Failure error={task.error || reload.error} />
        {notice && <p role="status">{notice}</p>}
        <div className="ew-inline">
          <button
            className="ew-button"
            disabled={task.isPending || reload.isPending || revision == null}
          >
            保存政策配置
          </button>
          <button
            type="button"
            className="ew-button light"
            disabled={task.isPending || reload.isPending}
            onClick={() =>
              reload.run(async () => {
                const current = await api.adminPolicy();
                setLatest(current);
                setRevision(current.revision);
                setNotice(
                  "已读取最新配置，输入已保留。请展开服务端配置核对后再保存。",
                );
              })
            }
          >
            重新读取并比较
          </button>
        </div>
      </form>
    </div>
  );
}
export function AccountReviews() {
  const { api } = useApp(),
    m = useMobile(),
    cache = useQueryClient();
  const q = useQuery({
    queryKey: ["account-reviews"],
    queryFn: () => api.accountReviews(),
    retry: false,
  });
  return (
    <section className="ew-feature">
      <h2>账号安全复核</h2>
      <p className="ew-note">
        核对账号同步事件后批准或驳回。密码冲突重置请到用户管理，按用户编号操作。
      </p>
      {q.isPending ? (
        <FeatureState loading kind="rows" />
      ) : q.isError ? (
        <>
          <Failure error={q.error} />
          <button className="ew-button light" onClick={() => void q.refetch()}>
            重新读取
          </button>
        </>
      ) : !q.data.length ? (
        <FeatureState empty="没有待复核的账号事件" />
      ) : (
        q.data.map((row) => (
          <article className="ew-v2-card" key={row.eventId}>
            <h3>
              {row.field || "账号字段"} · {row.state}
            </h3>
            <p className="ew-note" style={{ overflowWrap: "anywhere" }}>
              事件：{row.eventId}
              <br />
              账号主体：{row.subjectId}
            </p>
            <div className="ew-inline">
              {[true, false].map((approved) => (
                <button
                  key={String(approved)}
                  className={`ew-button ${approved ? "" : "light"}`}
                  disabled={!row.eventId}
                  onClick={() =>
                    m.confirm(
                      `${approved ? "批准" : "驳回"}这条账号安全事件？请确认已核对事件及主体。`,
                      async () => {
                        await api.decideAccountReview(row.eventId!, approved);
                        await cache.invalidateQueries({
                          queryKey: ["account-reviews"],
                        });
                      },
                      approved ? "确认批准" : "确认驳回",
                    )
                  }
                >
                  {approved ? "批准事件" : "驳回事件"}
                </button>
              ))}
            </div>
          </article>
        ))
      )}
    </section>
  );
}
export function AdminPasswordReset({
  userId,
  displayName,
  onDone,
}: {
  userId: number;
  displayName: string;
  onDone: () => void;
}) {
  const { api } = useApp(),
    task = useTask("密码冲突已重置", onDone, ["admin", "account-reviews"]);
  return (
    <div className="ew-feature">
      <form
        className="ew-v2-card"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget,
            data = new FormData(form);
          task.run(async () => {
            if (data.get("password") !== data.get("confirm"))
              throw new Error("两次密码不一致。");
            await api.resetAccountConflict(
              userId,
              String(data.get("password")),
            );
            form.reset();
          });
        }}
      >
        <p>
          为「{displayName}」处理密码冲突，用户编号 #{userId}
          。此操作将影响该账号的登录状态。
        </p>
        <label>
          新密码
          <input
            name="password"
            type="password"
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            required
          />
        </label>
        <label>
          确认新密码
          <input
            name="confirm"
            type="password"
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            required
          />
        </label>
        <label className="ew-inline">
          <input type="checkbox" required />
          已核对账号及用户编号，确认重置密码冲突
        </label>
        <Failure error={task.error} />
        <button className="ew-button" disabled={task.isPending}>
          确认重置密码冲突
        </button>
      </form>
    </div>
  );
}
