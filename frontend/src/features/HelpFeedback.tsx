import { lazy, Suspense } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useReturnTo } from "../app/navigation";
import { aboutHome } from "./about-navigation";
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
export default function HelpFeedback({ mobile = false }: { mobile?: boolean }) {
  const { pathname, search } = useLocation();
  const appeal = pathname === "/feedback" && new URLSearchParams(search).get("appeal") === "1";
  return (
    <section
      className={
        mobile
          ? "help-feedback-page mobile-help-feedback"
          : "help-feedback-page"
      }
    >
      {mobile ? <MobileHelpHeader /> : <ProfileHelpHeader title={appeal ? "账号申诉" : undefined} />}
      <Suspense
        key={pathname + (appeal ? "?appeal=1" : "")}
        fallback={<ContentSkeleton kind="form" count={3} />}
      >
        {pathname === "/help" ? (
          <>
            {mobile && (
              <nav className="mobile-help-links" aria-label="反馈入口">
                <Link to="/feedback">
                  反馈
                  <ChevronRight size={20} aria-hidden="true" />
                </Link>
                <Link to="/feedback/mine">
                  我的反馈
                  <ChevronRight size={20} aria-hidden="true" />
                </Link>
              </nav>
            )}
            <ProfileHelp showHeader={false} />
          </>
        ) : (
          <Gate verified={false}>
            {pathname === "/feedback" ? (
              <FeedbackForm showHeader={false} mobile={mobile} />
            ) : (
              <FeedbackRecords showHeader={false} mobile={mobile} />
            )}
          </Gate>
        )}
      </Suspense>
    </section>
  );
}

function MobileHelpHeader() {
  const { pathname, search } = useLocation();
  const back = useReturnTo(pathname === "/help" ? "/settings" : aboutHome.path);
  const title =
    pathname === "/feedback"
      ? new URLSearchParams(search).get("appeal") === "1" ? "账号申诉" : "反馈"
      : pathname === "/feedback/mine"
        ? "我的反馈"
        : "帮助与反馈";
  return (
    <header className="mobile-help-header">
      <Link to={back} className="mobile-help-back" aria-label="返回">
        <ChevronLeft size={28} strokeWidth={2} aria-hidden="true" />
      </Link>
      <h1>{title}</h1>
    </header>
  );
}
