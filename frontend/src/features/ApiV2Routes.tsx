import { useLocation } from "react-router-dom";
import { Gate } from "../components/ui";
import {
  BlockedUsers,
  MobileHistory,
  MobileUserProfile,
  PasswordConflictReset,
  UsernameSetup,
} from "./ApiV2";
export default function ApiV2Routes() {
  const path = useLocation().pathname;
  if (path === "/auth/password-conflict/reset")
    return <PasswordConflictReset />;
  return (
    <Gate verified={false}>
      {path === "/settings/username" ? (
        <UsernameSetup />
      ) : path === "/settings/blocked" ? (
        <BlockedUsers />
      ) : path === "/history" ? (
        <MobileHistory />
      ) : (
        <MobileUserProfile />
      )}
    </Gate>
  );
}
