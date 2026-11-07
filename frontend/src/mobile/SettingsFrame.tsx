import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { DesignIcon } from "./ui";
import "./account-settings.css";
import "./settings-pages.css";

export default function SettingsFrame({
  title,
  back = "/settings",
  backLabel = "返回设置",
  children,
  list = false,
}: {
  title: string;
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
      <header className="mobile-account-heading">
        <Link to={back} aria-label={backLabel}>
          <DesignIcon name="back" size={24} />
        </Link>
        <h1>{title}</h1>
      </header>
      <div
        className={list ? "mobile-settings-list" : "mobile-settings-content"}
      >
        {children}
      </div>
    </section>
  );
}
