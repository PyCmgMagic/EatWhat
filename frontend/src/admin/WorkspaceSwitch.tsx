import { Link } from "react-router-dom";
import { useApp } from "../app/state";
import { workspaceDestination } from "../app/admin-state";
import { DesignIcon } from "../mobile/ui";
import "./workspace-switch.css";

export default function WorkspaceSwitch({
  mode = "admin",
  className = "",
  iconSize = 18,
}: {
  mode?: "front" | "admin";
  className?: string;
  iconSize?: number;
}) {
  const { user } = useApp();
  if (user?.role !== "admin") return null;
  return (
    <Link
      className={`workspace-switch ${className}`}
      to={workspaceDestination(user.id, mode)}
      state={{ workspaceSwitch: true }}
      aria-label={mode === "admin" ? "切换到管理后台" : "切换到前台"}
    >
      <DesignIcon
        name={mode === "admin" ? "tool" : "discover"}
        size={iconSize}
      />
      <span>{mode === "admin" ? "管理后台" : "返回前台"}</span>
    </Link>
  );
}
