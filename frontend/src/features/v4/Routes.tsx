import { lazy, Suspense } from "react";
import { useLocation } from "react-router-dom";
import { Gate } from "../../components/ui";
import { ContentSkeleton } from "../../components/LoadingSkeleton";
import { recoveryCommands } from "../../api/recovery";
import {
  Devices,
  MobileChange,
  Cancellation,
  AccountRecovery,
  ConsentOffer,
  PushSettings,
  TelemetrySettings,
} from "./Account";
import {
  FeedbackForm,
  FeedbackRecords,
  Submissions,
  NotificationCards,
  Topics,
  FavoriteRestaurants,
  TagFoods,
} from "./Community";
import { Announcements, FeatureAvailability } from "./Remote";
import Features from "./Hub";
const Directory = lazy(() => import("./Directory"));
const Admin = lazy(() => import("./Admin"));
export default function V4Routes() {
  const path = useLocation().pathname;
  let page;
  if (path === "/auth/device-recovery") return <Devices />;
  if (path === "/auth/mobile-recovery") return <MobileChange />;
  if (path === "/auth/account-recovery") return <AccountRecovery />;
  if (path === "/auth/consent-offer") return <ConsentOffer />;
  if (path === "/announcements") return <Announcements />;
  if (path === "/restaurants/directory")
    return (
      <Suspense fallback={<ContentSkeleton kind="rows" count={3} />}>
        <Directory />
      </Suspense>
    );
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
  if (path === "/admin/v4")
    return (
      <Suspense fallback={<ContentSkeleton kind="form" count={3} />}>
        <Gate verified={false}>
          <Admin />
        </Gate>
      </Suspense>
    );
  if (path === "/settings/devices") page = <Devices />;
  else if (path === "/settings/phone") page = <MobileChange />;
  else if (path === "/settings/delete") page = <Cancellation />;
  else if (path === "/settings/notifications")
    page = (
      <FeatureAvailability name="push">
        <PushSettings />
      </FeatureAvailability>
    );
  else if (path === "/settings/telemetry") page = <TelemetrySettings />;
  else if (path === "/notifications") page = <NotificationCards />;
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
