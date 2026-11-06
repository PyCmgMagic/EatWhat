import { useLocation, useNavigate } from "react-router-dom";
import { useRemoteConfig } from "./v4/Remote";
import { useApp } from "../app/state";
import { useLoginDialog } from "../app/auth-dialog";
export function useActionAccess() {
  const { session, user, toast } = useApp(),
    nav = useNavigate(),
    loc = useLocation(),
    { openLogin } = useLoginDialog();
  const remote = useRemoteConfig();
  return (verified = false) => {
    const feature = loc.pathname.startsWith("/publish")
      ? "publish"
      : loc.pathname.startsWith("/restaurants/new")
        ? "newShop"
        : undefined;
    const flag = feature ? remote.data?.flags?.[feature] : undefined;
    if (remote.data?.update?.decision === "FORCE") {
      toast("请先更新版本，再继续操作。");
      return false;
    }
    if (
      remote.data?.maintenance?.mode === "DOWN" ||
      remote.data?.maintenance?.mode === "READ_ONLY" ||
      flag?.on === false
    ) {
      toast(
        flag?.reason ||
          remote.data?.maintenance?.message ||
          "这项操作暂时暂停，请稍后再试。",
      );
      return false;
    }
    if (!session) {
      openLogin(
        "/auth/password?next=" + encodeURIComponent(loc.pathname + loc.search),
      );
      return false;
    }
    if (user?.banned) {
      toast("账号暂时无法操作，请联系管理员。");
      return false;
    }
    if (verified && user?.verified !== true) {
      nav("/verify");
      return false;
    }
    return true;
  };
}
