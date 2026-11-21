import { Suspense, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { isRetiredV2 } from "../app/retired-routes";
import { ContentSkeleton } from "../components/LoadingSkeleton";
import {
  DesktopSettingsContext,
  settingsNavGroups,
  settingsOverview,
} from "../features/settings-nav";
import { DesignIcon as Icon } from "../mobile/ui";
import "./settings-workspace.css";

export default function DesktopSettingsWorkspace({
  category,
  children,
}: {
  category: string;
  children: ReactNode;
}) {
  const { pathname } = useLocation();
  function navLink(item: typeof settingsOverview) {
    const current = category === item.to;
    return (
      <Link
        key={item.to}
        to={item.to}
        aria-current={
          current ? (pathname === item.to ? "page" : "location") : undefined
        }
      >
        <Icon name={item.icon} size={19} />
        {item.name}
      </Link>
    );
  }
  return (
    <DesktopSettingsContext.Provider value>
      <section className="pc-settings-workspace" aria-label="设置">
        <div className="pc-settings-layout">
          <nav className="pc-settings-navigation" aria-label="设置导航">
            {navLink(settingsOverview)}
            {settingsNavGroups.map((group) => (
              <div className="pc-settings-nav-group" key={group.title}>
                <p>{group.title}</p>
                {group.items
                  .filter((item) => !isRetiredV2(item.to))
                  .map(navLink)}
              </div>
            ))}
          </nav>
          <div
            className="pc-settings-panel"
            role="region"
            aria-label="设置内容"
          >
            <Suspense fallback={<ContentSkeleton kind="rows" count={4} />}>
              {children}
            </Suspense>
          </div>
        </div>
      </section>
    </DesktopSettingsContext.Provider>
  );
}
