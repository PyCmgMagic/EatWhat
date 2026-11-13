import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useApp } from "../app/state";
import { growthPercent } from "../api/growth";
import { DesignIcon } from "../mobile/ui";
import "./profile-growth.css";

/** Part of the profile identity, sharing the growth page's live cache. */
export default function ProfileGrowth() {
  // Backend v2 has no levels or experience; keep the slot empty.
  return null;
}
export function LegacyProfileGrowth() {
  const { api, user, session } = useApp();
  const progress = useQuery({
    queryKey: ["growth", user?.id, "progress"],
    queryFn: () => api.growth(),
    enabled: !!session && !!user?.id,
  });
  const growth = progress.data;
  const percent = growthPercent(growth);
  const level = growth?.level ?? user?.level;
  const experience = growth?.totalExperience ?? user?.totalExperience;
  const next = growth?.maxLevel
    ? "已达最高等级"
    : growth?.experienceToNextLevel != null
      ? `还差 ${growth.experienceToNextLevel} 升级`
      : undefined;

  if (!session) return null;
  return (
    <Link
      to="/me/growth"
      className="profile-growth"
      aria-label={`我的成长${level != null ? `，等级 ${level}` : ""}${experience != null ? `，累计 ${experience} 经验` : ""}`}
    >
      <strong className="profile-growth-level">
        {level != null ? `Lv.${level}` : "我的成长"}
      </strong>
      <span className="profile-growth-body">
        <span className="profile-growth-caption">
          <span>
            {experience != null
              ? `${experience} 经验`
              : progress.isPending
                ? "正在加载等级与经验"
                : progress.isError
                  ? "暂未加载，点击查看"
                  : "查看等级与经验"}
          </span>
          {next && <span>{next}</span>}
        </span>
        {percent != null && (
          <span
            className="profile-growth-track"
            role="progressbar"
            aria-label="当前等级进度"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(percent)}
            aria-valuetext={next}
          >
            <span style={{ width: `${percent}%` }} />
          </span>
        )}
      </span>
      <DesignIcon name="chevronRight" size={15} />
    </Link>
  );
}
