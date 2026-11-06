import { StrictMode } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { RouteContinuityProvider } from "./app/navigation";
import { AppProvider } from "./app/context";
import { AreaProvider } from "./app/area";
import { LoginDialogProvider } from "./app/auth-dialog";
import MobileApp from "./mobile/App";
// Keep responsive overrides last even when their page JavaScript is lazy.
import "./desktop/profile.css";
import "./desktop/publish.css";
import "./desktop/library.css";
import "./desktop/discussion.css";
import { MotionEnvironment } from "./motion/hooks";
import "./responsive.css";
import "./motion/motion.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <MotionEnvironment />
      <AppProvider>
        <HashRouter>
          <AreaProvider>
            <LoginDialogProvider>
              <RouteContinuityProvider>
                <MobileApp />
              </RouteContinuityProvider>
            </LoginDialogProvider>
          </AreaProvider>
        </HashRouter>
      </AppProvider>
    </ErrorBoundary>
  </StrictMode>,
);
