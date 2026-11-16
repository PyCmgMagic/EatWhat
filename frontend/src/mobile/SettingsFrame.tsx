import { useEffect, type ReactNode } from "react";
import SettingsPageHeader from "../features/SettingsPageHeader";
import "./account-settings.css";
import "./settings-pages.css";

export default function SettingsFrame({
  title,
  detail,
  back = "/settings",
  backLabel = "返回设置",
  children,
  list = false,
}: {
  title: string;
  detail?: string;
  back?: string;
  backLabel?: string;
  children: ReactNode;
  list?: boolean;
}) {
  useEffect(() => {
    document.title = title + " · 山软今天吃什么";
  }, [title]);
  return (
    <section className="mobile-settings-page mobile-account-settings">
      <SettingsPageHeader
        title={title}
        detail={detail}
        back={back}
        backLabel={backLabel}
      />
      <div
        className={list ? "mobile-settings-list" : "mobile-settings-content"}
      >
        {children}
      </div>
    </section>
  );
}
