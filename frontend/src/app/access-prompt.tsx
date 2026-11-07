import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import type { AccessPrompt } from "../api/access";
import { useLoginDialog } from "./auth-dialog";
import { useVerificationDialog } from "./verification-dialog";

const eventName = "eatwhat:action-access";
export function showAccessPrompt(request: AccessPrompt) {
  return !window.dispatchEvent(
    new CustomEvent(eventName, { detail: request, cancelable: true }),
  );
}

/** One UI adapter for requests from every page, hook and API command. */
export function ActionAccessPrompts() {
  const location = useLocation(),
    { openLogin } = useLoginDialog();
  const openVerification = useVerificationDialog();
  useEffect(() => {
    const receive = (event: Event) => {
      const request = (event as CustomEvent<AccessPrompt>).detail;
      if (request.context !== window.location.hash) return;
      event.preventDefault();
      if (request.reason === "verification")
        openVerification(request.serverRequired, request.returnFocus);
      else
        openLogin(
          "/auth/password?next=" +
            encodeURIComponent(location.pathname + location.search),
          { returnFocus: request.returnFocus },
        );
    };
    window.addEventListener(eventName, receive);
    return () => window.removeEventListener(eventName, receive);
  }, [location, openLogin, openVerification]);
  return null;
}
