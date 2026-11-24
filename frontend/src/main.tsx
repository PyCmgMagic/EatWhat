import { StrictMode } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { RouteContinuityProvider } from "./app/navigation";
import { AppProvider } from "./app/context";
import { AreaProvider } from "./app/area";
import { LoginDialogProvider } from "./app/auth-dialog";
import { VerificationDialogProvider } from "./app/verification-dialog";
import { ActionAccessPrompts } from "./app/access-prompt";
import WebTelemetry from "./app/WebTelemetry";
import ForegroundActivity from "./app/ForegroundActivity";
import RetiredRouteBoundary from "./app/retired-routes";
import MobileApp from "./mobile/App";
import "./base.css";
// Keep responsive overrides last even when their page JavaScript is lazy.
import "./desktop/profile.css";
import "./desktop/publish.css";
import "./desktop/library.css";
import "./desktop/discussion.css";
import { MotionEnvironment } from "./motion/hooks";
import "./responsive.css";
import "./motion/motion.css";
import "./theme/theme.css";
import { initializeAppearance } from "./theme/appearance";
import { verificationCallbackUrl } from "./app/verification-return";

const stopAppearance = initializeAppearance();
if (import.meta.hot) import.meta.hot.dispose(stopAppearance);
const verificationCallback = verificationCallbackUrl(window.location.href);
if (verificationCallback)
  window.history.replaceState(window.history.state, "", verificationCallback);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <MotionEnvironment />
      <AppProvider>
        <HashRouter>
          <AreaProvider>
            <LoginDialogProvider>
              <VerificationDialogProvider>
                <ActionAccessPrompts />
                <ForegroundActivity />
                <WebTelemetry />
                <RouteContinuityProvider>
                  <RetiredRouteBoundary>
                    <MobileApp />
                  </RetiredRouteBoundary>
                </RouteContinuityProvider>
              </VerificationDialogProvider>
            </LoginDialogProvider>
          </AreaProvider>
        </HashRouter>
      </AppProvider>
    </ErrorBoundary>
  </StrictMode>,
);
