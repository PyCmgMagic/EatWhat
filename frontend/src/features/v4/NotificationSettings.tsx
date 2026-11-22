import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { DishIllustration } from "../../components/DishIllustration";
import { Shell } from "./shared";
import "./notification-settings.css";

/** Notification preferences are not released yet; do not mount push commands. */
export default function NotificationSettings() {
  return (
    <Shell title="通知偏好" back="/settings" advice={false}>
      <section
        className="notification-coming-soon"
        aria-labelledby="notification-soon-title"
      >
        <DishIllustration name="yuntun" />
        <h2 id="notification-soon-title">通知偏好暂未开放</h2>
        <Link className="notification-coming-soon-action" to="/">
          去发现页 <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </section>
    </Shell>
  );
}
