import { lazy, Suspense } from "react";
import { useLocation } from "react-router-dom";
import { ContentSkeleton } from "../components/LoadingSkeleton";
import { Gate } from "../components/ui";
import ProfileHelp from "./ProfileHelp";
import { ProfileHelpHeader } from "./ProfileSectionNav";
import "./help-feedback.css";

const FeedbackForm = lazy(() =>
  import("./v4/Community").then((module) => ({ default: module.FeedbackForm })),
);
const FeedbackRecords = lazy(() =>
  import("./v4/Community").then((module) => ({
    default: module.FeedbackRecords,
  })),
);

export function isHelpFeedbackPath(path: string) {
  return ["/help", "/feedback", "/feedback/mine"].includes(path);
}

/** Keep navigation outside the route's loading boundary so each tap responds. */
export default function HelpFeedback() {
  const { pathname } = useLocation();
  return (
    <section className="help-feedback-page">
      <ProfileHelpHeader />
      <Suspense
        key={pathname}
        fallback={<ContentSkeleton kind="form" count={3} />}
      >
        {pathname === "/help" ? (
          <ProfileHelp showHeader={false} />
        ) : (
          <Gate verified={false}>
            {pathname === "/feedback" ? (
              <FeedbackForm showHeader={false} />
            ) : (
              <FeedbackRecords showHeader={false} />
            )}
          </Gate>
        )}
      </Suspense>
    </section>
  );
}
