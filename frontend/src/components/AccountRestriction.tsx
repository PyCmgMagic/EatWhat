import { Link } from "react-router-dom";
import { useApp } from "../app/state";
import "./account-restriction.css";

export function AccountRestriction() {
  const { user } = useApp();
  if (!user?.banned) return null;
  const until = user.banUntil ? new Date(user.banUntil) : null;
  return (
    <section className="account-restriction" aria-label="账号受限状态">
      <div role="status">
        <strong>账号受限</strong>
        {user.banReason && <p>{user.banReason}</p>}
        <p>
          {until && Number.isFinite(until.getTime())
            ? `预计解除：${until.toLocaleString("zh-CN", { hour12: false })}`
            : "暂未设置解除时间"}
        </p>
      </div>
      <div className="account-restriction-actions">
        <Link to="/feedback?appeal=1">申诉</Link>
        <Link to="/feedback/mine">处理记录</Link>
      </div>
    </section>
  );
}
