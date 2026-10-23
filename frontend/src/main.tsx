import { StrictMode } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { AppProvider } from "./app/context";
import { AreaProvider } from "./app/area";
import MobileApp from "./mobile/App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <AppProvider>
        <HashRouter>
          <AreaProvider>
            <MobileApp />
          </AreaProvider>
        </HashRouter>
      </AppProvider>
    </ErrorBoundary>
  </StrictMode>,
);
