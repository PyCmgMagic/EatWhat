import { useLocation } from "react-router-dom";
import { MotionRegion } from "../../desktop/motion";
import { ProfileSectionNav } from "../ProfileSectionNav";
import { NotificationCardsPanel } from "./Community";
import { AnnouncementsPanel } from "./Remote";
import { Shell } from "./shared";

/**
 * 互动通知与站点公告是同一个「消息通知」页的两个视图。
 * 页头与分类导航留在这里保持挂载，切换只替换下方内容：
 * 标题不会跟着重绘，分类下划线可以滑动，内容以一小段滑入衔接。
 */
export function Messages() {
  const announcements = useLocation().pathname === "/announcements";
  return (
    <Shell title="消息通知">
      <ProfileSectionNav section="messages" />
      <MotionRegion
        changeKey={announcements ? "/announcements" : "/notifications"}
        order={announcements ? 1 : 0}
      >
        {announcements ? <AnnouncementsPanel /> : <NotificationCardsPanel />}
      </MotionRegion>
    </Shell>
  );
}

export default Messages;
