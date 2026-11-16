import type { ReactNode } from "react";
import {
  DishIllustration,
  type DishIllustrationName,
} from "../components/DishIllustration";
import { DesignIcon as Icon } from "../mobile/ui";

// 样式在 profile-pages.css，由桌面入口在 profile-space.css 之后引入，保证覆盖顺序。

/**
 * 个人空间各标签页共用的页头：左侧标题 + 数量 + 一句说明，右侧放这一页的
 * 主要操作或视图切换。每一页都从这里开始，位置、字号和间距保持一致。
 */
export function ProfilePageHead({
  title,
  count,
  detail,
  headingId,
  children,
}: {
  title: ReactNode;
  count?: ReactNode;
  detail?: ReactNode;
  headingId?: string;
  children?: ReactNode;
}) {
  return (
    <header className="pp-head">
      <div className="pp-head-copy">
        <h1 id={headingId}>
          {title}
          {count != null && count !== "" && (
            <span className="pp-count">{count}</span>
          )}
        </h1>
        {detail && <p>{detail}</p>}
      </div>
      {children && <div className="pp-head-actions">{children}</div>}
    </header>
  );
}

/** 页内分区标题：比页头低一级，右侧可带一个“查看全部”入口。 */
export function ProfileSectionHead({
  title,
  count,
  headingId,
  children,
}: {
  title: string;
  count?: ReactNode;
  headingId?: string;
  children?: ReactNode;
}) {
  return (
    <div className="pp-section-head">
      <h2 id={headingId}>
        {title}
        {count != null && count !== "" && (
          <span className="pp-count">{count}</span>
        )}
      </h2>
      {children && <div className="pp-section-links">{children}</div>}
    </div>
  );
}

/** 统一的空状态：插画（或图标）、一句标题、一句说明、最多一个主操作。 */
export function ProfileEmpty({
  illustration,
  icon = "bowl",
  title,
  detail,
  compact = false,
  role = "status",
  children,
}: {
  illustration?: DishIllustrationName;
  icon?: string;
  title: string;
  detail?: ReactNode;
  compact?: boolean;
  role?: "status" | "alert";
  children?: ReactNode;
}) {
  return (
    <div className={`pp-empty${compact ? " is-compact" : ""}`} role={role}>
      {illustration ? (
        <DishIllustration name={illustration} className="pp-empty-dish" />
      ) : (
        <span className="pp-empty-symbol" aria-hidden="true">
          <Icon name={icon} size={30} />
        </span>
      )}
      <h2>{title}</h2>
      {detail && <p>{detail}</p>}
      {children && <div className="pp-empty-actions">{children}</div>}
    </div>
  );
}
