import { useLocation } from "react-router-dom";
import { useRemoteConfig } from "./v4/Remote";
import { useApp } from "../app/state";
import { useLoginDialog } from "../app/auth-dialog";
import { useVerificationDialog } from "../app/verification-dialog";
import { actionUnavailable, requestAccess } from "../api/access-policy";
import type { RequestOptions } from "../api/client";
import { bannedActionMessage, bannedRequestAllowed } from "../api/banned-access";
export function useActionAccess() {
  const { session, user, toast } = useApp(),
    loc = useLocation(),
    { openLogin } = useLoginDialog();
  const openVerification = useVerificationDialog();
  const remote = useRemoteConfig();
  // Optional early guard for opening editors/panels. API commands are always
  // guarded centrally, even when their button does not call this hook.
  return (
    target: boolean | { path: string; options?: RequestOptions } = false,
  ) => {
    const verified =
      typeof target === "boolean"
        ? target
        : requestAccess(target.path, target.options) === "verified";
    const unavailable = actionUnavailable(remote.data, loc.pathname);
    if (unavailable) {
      toast(unavailable);
      return false;
    }
    if (!session) {
      openLogin(
        "/auth/password?next=" + encodeURIComponent(loc.pathname + loc.search),
      );
      return false;
    }
    if (user?.banned && (typeof target === "boolean" || !bannedRequestAllowed(target.path, target.options))) {
      toast(bannedActionMessage);
      return false;
    }
    if (verified && user?.verified !== true) {
      if (!user) toast("正在读取账号信息，请稍后再试。");
      else openVerification();
      return false;
    }
    return true;
  };
}
