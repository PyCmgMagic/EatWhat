import { lazy, Suspense } from "react";
import { useLocation } from "react-router-dom";
import { Gate } from "../../components/ui";
import { ContentSkeleton } from "../../components/LoadingSkeleton";
import { recoveryCommands } from "../../api/recovery";
import { restaurantHistoryId } from "../v4-paths";
import { RestaurantEditHistory } from "./EditHistory";
import {
  Devices,
  MobileChange,
  Cancellation,
  AccountRecovery,
} from "./Account";
import {
  FeedbackForm,
  FeedbackRecords,
  Submissions,
  Topics,
  FavoriteRestaurants,
  TagFoods,
} from "./Community";
import { FeatureAvailability } from "./Remote";
import { Messages } from "./Messages";
import Features from "./Hub";
import NotificationSettings from "./NotificationSettings";
import Directory from "./Directory";
const Growth = lazy(() => import("./Growth"));
export default function V4Routes() {
  const path = useLocation().pathname;
  const historyId = restaurantHistoryId(path);
  if (historyId !== undefined) return <RestaurantEditHistory id={historyId} />;
  let page;
  if (path === "/auth/device-recovery") return <Devices />;
  if (path === "/auth/mobile-recovery") return <MobileChange />;
  if (path === "/auth/account-recovery") return <AccountRecovery />;
  if (path === "/notifications")
    return <Gate verified={false}><Messages /></Gate>;
  if (path === "/announcements") return <Messages />;
  if (path === "/restaurants/directory") return <Directory />;
  if (path === "/features") return <Features />;
  if (
    path === "/topics" ||
    path === "/topics/current" ||
    /^\/topics\/\d+$/.test(path)
  )
    return (
      <FeatureAvailability name="topic">
        <Topics
          id={
            /^\/topics\/\d+$/.test(path)
              ? Number(path.split("/").pop())
              : undefined
          }
          current={path.endsWith("current")}
        />
      </FeatureAvailability>
    );
  if (path === "/me/growth")
    page = (
      <Suspense fallback={<ContentSkeleton kind="rows" count={3} />}>
        <Growth />
      </Suspense>
    );
  else if (path === "/settings/devices") page = <Devices />;
  else if (path === "/settings/phone") page = <MobileChange />;
  else if (path === "/settings/delete") page = <Cancellation />;
  else if (path === "/settings/notifications") page = <NotificationSettings />;
  else if (path === "/feedback") page = <FeedbackForm />;
  else if (path === "/reports/new") page = <FeedbackForm kind="report" />;
  else if (path === "/restaurants/correction")
    page = <FeedbackForm kind="catalog" />;
  else if (path.startsWith("/feedback/mine"))
    page = (
      <FeedbackRecords
        id={
          path === "/feedback/mine" ? undefined : Number(path.split("/").pop())
        }
      />
    );
  else if (path.startsWith("/submissions"))
    page = (
      <Submissions
        revisionId={
          path === "/submissions"
            ? undefined
            : decodeURIComponent(path.split("/").pop()!)
        }
      />
    );
  else if (path === "/restaurants/favorites") page = <FavoriteRestaurants />;
  else if (/^\/me\/tags\/\d+\/foods$/.test(path))
    page = <TagFoods id={Number(path.split("/")[3])} />;
  return (
    <Gate
      recovery={recoveryCommands.has(
        path === "/settings/devices"
          ? "devices"
          : path === "/settings/phone"
            ? "mobile"
            : path === "/settings/delete"
              ? "cancellation"
              : "none",
      )}
      verified={/^\/me\/tags\//.test(path)}
    >
      {page ?? <Features />}
    </Gate>
  );
}
