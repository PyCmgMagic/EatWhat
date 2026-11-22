import { BRAND_NAME } from "../app/brand";
import { useEffect, type ReactNode } from "react";
import SettingsPageHeader from "../features/SettingsPageHeader";
import "./account-settings.css";
import "./settings-pages.css";

export default function SettingsFrame({
  title,
  detail,
  back = "/settings",
  backLabel,
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
    document.title = `${title} · ${BRAND_NAME}`;
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
