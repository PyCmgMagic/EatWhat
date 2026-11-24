import { Select } from "../../components/Select";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAdminState } from "../../app/admin-state";
import { useApp } from "../../app/state";
import type { Schema } from "../../api/models";
import type { AdminUserFilters } from "../../api/service";
import { networkName, operatorName } from "../../api/admin-analytics";
import { useTask } from "../../components/useTask";
import {
  Async,
  Avatar,
  Confirm,
  Drawer,
  Field,
  Icon,
  Meta,
  Notice,
  Pager,
  Panel,
  Pill,
  dateTime,
  fromLocalInput,
  toLocalInput,
} from "../kit";

type Row = Schema["UserListItemVOResponse"];
const banned = (u: Row) =>
  !!u.accountStatus?.bannedAt ||
  /ban/i.test(u.accountStatus?.accountStatus ?? "");
const statusLabel = (u: Row) => {
  const raw = u.accountStatus?.accountStatus;
  return banned(u)
    ? "已封禁"
    : !raw || /^(active|normal)$/i.test(raw)
      ? "正常"
      : raw;
};

export default function Users() {
  const { api } = useApp(),
    [page, setPage] = useAdminState("users.page", 1),
    [filters, setFilters] = useAdminState<AdminUserFilters>(
      "users.filters",
      {},
    ),
    [selected, setSelected] = useState<Row | null>(null),
    q = useQuery({
      queryKey: ["admin", "users", page, filters],
      queryFn: () => api.adminUsers(page, filters),
    });
  const filtered = Object.values(filters).some((v) => v !== undefined);
  // Keep the open drawer in step with refreshed list data.
  const current =
    selected && (q.data?.items?.find((u) => u.id === selected.id) ?? selected);
  return (
    <>
      <form
        className="ew-admin-toolbar"
        key={JSON.stringify(filters)}
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget),
            flag = (name: string) =>
              d.get(name) === "" ? undefined : d.get(name) === "true";
          setFilters({
            keyword: String(d.get("keyword") || "").trim() || undefined,
            role: (String(d.get("role") || "") ||
              undefined) as AdminUserFilters["role"],
            verified: flag("verified"),
            banned: flag("banned"),
          });
          setPage(1);
        }}
      >
        <label className="ew-admin-search">
          <Icon name="search" size={17} />
          <input
            name="keyword"
            aria-label="搜索用户"
            placeholder="昵称，或完整的登录名 / 手机号 / 邮箱 / 学号"
            defaultValue={filters.keyword}
          />
        </label>
        <Select inline motionDuration={200} closeDuration={100} name="role" aria-label="角色" defaultValue={filters.role ?? ""}>
          <option value="">全部角色</option>
          <option value="user">用户</option>
          <option value="admin">管理员</option>
        </Select>
        <Select inline motionDuration={200} closeDuration={100}
          name="verified"
          aria-label="学生认证"
          defaultValue={String(filters.verified ?? "")}
        >
          <option value="">认证不限</option>
          <option value="true">已认证</option>
          <option value="false">未认证</option>
        </Select>
        <Select inline motionDuration={200} closeDuration={100}
          name="banned"
          aria-label="账号状态"
          defaultValue={String(filters.banned ?? "")}
        >
          <option value="">状态不限</option>
          <option value="false">正常</option>
          <option value="true">封禁中</option>
        </Select>
        <button className="ew-admin-btn is-primary">查询</button>
        {filtered && (
          <button
            type="button"
            className="ew-admin-btn is-ghost"
            onClick={() => {
              setFilters({});
              setPage(1);
            }}
          >
            清除筛选
          </button>
        )}
      </form>
      <Panel flush>
        <Async
          query={q}
          rows={10}
          empty={!q.data?.items?.length}
          emptyTitle={filtered ? "没有符合条件的用户" : "暂无用户"}
          emptyHint={
            filtered
              ? "登录名、手机号、邮箱和学号需要输入完整内容。"
              : undefined
          }
        >
          <div className="ew-admin-table-wrap">
            <table className="ew-admin-table is-clickable">
              <thead>
                <tr>
                  <th>用户</th>
                  <th>角色</th>
                  <th>学生认证</th>
                  <th>联系方式</th>
                  <th>注册时间</th>
                  <th>状态</th>
                  <th aria-label="操作" />
                </tr>
              </thead>
              <tbody>
                {q.data?.items?.map((u) => (
                  <tr key={u.id} onClick={() => setSelected(u)}>
                    <td>
                      <div className="ew-admin-cell-main">
                        <Avatar src={u.avatar} name={u.displayName} />
                        <span>
                          <strong>{u.displayName || "校园食友"}</strong>
                          <small>
                            #{u.id}
                            {u.userName ? ` · ${u.userName}` : ""}
                          </small>
                        </span>
                      </div>
                    </td>
                    <td>
                      {u.role === "admin" ? (
                        <Pill tone="accent" dot={false}>
                          管理员
                        </Pill>
                      ) : (
                        "用户"
                      )}
                    </td>
                    <td>
                      <Pill tone={u.verified ? "good" : "neutral"}>
                        {u.verified ? "已认证" : "未认证"}
                      </Pill>
                    </td>
                    <td className="is-muted">{u.phone || u.email || "—"}</td>
                    <td className="is-muted">{dateTime(u.createdAt)}</td>
                    <td>
                      <Pill tone={banned(u) ? "bad" : "good"}>
                        {statusLabel(u)}
                      </Pill>
                    </td>
                    <td>
                      <div className="ew-admin-row-actions">
                        <button
                          className="ew-admin-btn is-small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(u);
                          }}
                        >
                          管理
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Async>
        <Pager
          page={page}
          total={q.data?.totalItems}
          totalPages={q.data?.totalPages}
          hasNext={q.data?.hasNext}
          onChange={setPage}
        />
      </Panel>
      {current && (
        <UserDrawer user={current} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

function UserDrawer({ user: u, onClose }: { user: Row; onClose: () => void }) {
  const { api, user: me } = useApp(),
    network = useQuery({
      queryKey: ["admin", "user-network", u.id],
      queryFn: () => api.adminUserNetwork(u.id!),
      retry: false,
    }),
    [confirmUnban, setConfirmUnban] = useState(false),
    ban = useTask("账号已封禁", undefined, ["admin"]),
    unban = useTask("已解除封禁", () => setConfirmUnban(false), ["admin"]),
    password = useTask("临时密码已设置，对方所有设备已下线", undefined, [
      "admin",
    ]);
  const isBanned = banned(u),
    self = me?.id === u.id;
  return (
    <Drawer
      title={u.displayName || "校园食友"}
      subtitle={`#${u.id}${u.userName ? ` · 登录名 ${u.userName}` : ""}`}
      onClose={onClose}
    >
      <div className="ew-admin-profile">
        <Avatar src={u.avatar} name={u.displayName} size={56} />
        <div>
          <Pill tone={isBanned ? "bad" : "good"}>{statusLabel(u)}</Pill>
          {u.role === "admin" && (
            <Pill tone="accent" dot={false}>
              管理员
            </Pill>
          )}
          <Pill tone={u.verified ? "good" : "neutral"}>
            {u.verified ? "已认证" : "未认证"}
          </Pill>
        </div>
        <Link className="ew-admin-link" to={`/users/${u.id}`}>
          前台主页
          <Icon name="external" size={14} />
        </Link>
      </div>
      <Meta
        items={[
          ["手机", u.phone],
          ["邮箱", u.email],
          ["认证方式", u.method],
          ["学号", u.studentId],
          ["姓名", u.realName],
          ["认证邮箱", u.verifiedEmail],
          ["注册时间", dateTime(u.createdAt)],
          ["最近更新", dateTime(u.updatedAt)],
        ]}
      />

      <h3 className="ew-admin-subhead">网络来源</h3>
      <Async query={network} rows={3}>
        <Meta
          items={[
            ["注册 IP", network.data?.registrationIp],
            ["注册网络", networkName(network.data?.registrationNetwork)],
            ["注册运营商", operatorName(network.data?.registrationOperator)],
            ["最近使用 IP", network.data?.lastIp],
            ["最近使用网络", networkName(network.data?.lastNetwork)],
            ["最近使用运营商", operatorName(network.data?.lastOperator)],
            ["最近使用时间", dateTime(network.data?.lastUsedAt)],
          ]}
        />
      </Async>

      <h3 className="ew-admin-subhead">账号状态</h3>
      {isBanned ? (
        <>
          <Notice tone="bad">
            已封禁
            {u.accountStatus?.bannedAt
              ? `（${dateTime(u.accountStatus.bannedAt)}）`
              : ""}
            {u.accountStatus?.banReason ? `：${u.accountStatus.banReason}` : ""}
            {u.accountStatus?.banExpireAt
              ? ` · 至 ${dateTime(u.accountStatus.banExpireAt)}`
              : " · 未设置截止时间"}
          </Notice>
          <button className="ew-admin-btn" onClick={() => setConfirmUnban(true)}>
            解除封禁
          </button>
        </>
      ) : self ? (
        <Notice>不能封禁当前登录的管理员账号。</Notice>
      ) : (
        <form
          className="ew-admin-form"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget,
              d = new FormData(form),
              reason = String(d.get("reason") || "").trim(),
              until = String(d.get("until") || "");
            ban.run(async () => {
              if (!reason) throw new Error("请填写封禁原因。");
              await api.ban(u.id!, reason, fromLocalInput(until));
              form.reset();
            });
          }}
        >
          <Field label="封禁原因" wide>
            <textarea name="reason" rows={3} maxLength={255} required />
          </Field>
          <Field label="截止时间" hint="留空为永久封禁" wide>
            <input
              name="until"
              type="datetime-local"
              min={toLocalInput(new Date().toISOString())}
            />
          </Field>
          <div className="ew-admin-form-actions">
            <button className="ew-admin-btn is-danger" disabled={ban.isPending}>
              {ban.isPending ? "处理中…" : "封禁账号"}
            </button>
          </div>
        </form>
      )}

      <h3 className="ew-admin-subhead">临时密码</h3>
      <form
        className="ew-admin-form"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget,
            d = new FormData(form),
            next = String(d.get("password") ?? "");
          password.run(async () => {
            if (next !== String(d.get("again") ?? ""))
              throw new Error("两次输入的密码不一致。");
            await api.adminSetPassword(u.id!, next);
            form.reset();
          });
        }}
      >
        <Field label="临时密码（6–64 位）">
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={6}
            maxLength={64}
            required
          />
        </Field>
        <Field label="再输入一次">
          <input
            name="again"
            type="password"
            autoComplete="new-password"
            minLength={6}
            maxLength={64}
            required
          />
        </Field>
        <p className="ew-admin-form-note">
          设置后对方的所有设备都会下线。请通过可靠渠道告知，并提醒登录后尽快修改。
        </p>
        <div className="ew-admin-form-actions">
          <button className="ew-admin-btn" disabled={password.isPending}>
            {password.isPending ? "设置中…" : "设置临时密码"}
          </button>
        </div>
      </form>
      {confirmUnban && (
        <Confirm
          title={`解除「${u.displayName || u.userName}」的封禁？`}
          confirmLabel="解除封禁"
          busy={unban.isPending}
          onClose={() => setConfirmUnban(false)}
          onConfirm={() => unban.run(() => api.unban(u.id!))}
        >
          解除后该账号可以立即登录并发布内容。
        </Confirm>
      )}
    </Drawer>
  );
}
