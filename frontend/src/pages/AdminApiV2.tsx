import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { useTask } from "../components/useTask";
import { errorMessage, unavailable } from "../api/client";
import { FeatureState } from "../features/Catalog";
import { useMobile } from "../mobile/ui";
import "../features/api-v2.css";
import { ToastError } from "../components/feedback";

function Failure({ error }: { error: unknown }) {
  return (
    <ToastError
      error={
        error && (unavailable(error) ? "当前站点未开启此管理功能。" : error)
      }
    />
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
