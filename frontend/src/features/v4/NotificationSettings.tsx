import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { DishIllustration } from "../../components/DishIllustration";
import { Shell } from "./shared";
import "./notification-settings.css";

/** Notification preferences are not released yet; do not mount push commands. */
export default function NotificationSettings() {
  return (
    <Shell
      title="通知偏好"
      detail="按自己的节奏，接收关心的消息。"
      back="/settings"
      advice={false}
    >
      <section
        className="notification-coming-soon"
        aria-labelledby="notification-soon-title"
      >
        <div className="notification-coming-soon-art">
          <DishIllustration name="yuntun" />
        </div>
        <span className="notification-coming-soon-label">正在备菜</span>
        <h2 id="notification-soon-title">敬请期待</h2>
        <p>
          通知偏好还在准备中。
          <br />
          先去发现今天想吃的好味道吧。
        </p>
        <Link className="notification-coming-soon-action" to="/">
          先去逛逛 <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </section>
    </Shell>
  );
}
