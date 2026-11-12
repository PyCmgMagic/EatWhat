import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import V2App from "./v2/App";
import { captureVerificationLink } from "./v2/account";

captureVerificationLink();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <V2App />
      </HashRouter>
    </ErrorBoundary>
  </StrictMode>,
);
