import { useEffect, useRef, useState } from "react";
import type VConsole from "vconsole";
import { looksLikePhone, webOneClickLog } from "./web-one-click";

type NetworkInfo = { type?: string; effectiveType?: string };

/**
 * "Console" on the phone sign-in form: phones have no developer tools, so this
 * opens vConsole to troubleshoot one-click login. vConsole is only downloaded
 * on the first tap and is removed when the form goes away.
 */
export function WebOneClickConsole({ status }: { status: string }) {
  const instance = useRef<VConsole | null>(null),
    gone = useRef(false),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    gone.current = false;
    return () => {
      gone.current = true;
      instance.current?.destroy();
      instance.current = null;
    };
  }, []);
  return (
    <button
      type="button"
      className="ew-one-click-console"
      disabled={loading}
      onClick={() => {
        if (instance.current) return instance.current.show();
        setLoading(true);
        import("vconsole")
          .then(({ default: Console }) => {
            if (gone.current) return;
            const created = new Console({
              // show() needs the panel to be mounted first.
              onReady: () => created.show(),
            });
            instance.current = created;
            const network = (
              navigator as Navigator & { connection?: NetworkInfo }
            ).connection;
            // vConsole only sees output from now on, so describe the page and
            // print again what one-click login has logged so far.
            console.info("phone_auth_environment", {
              oneClick: status,
              phoneBrowser: looksLikePhone(),
              online: navigator.onLine,
              network: `${network?.type ?? "unknown"} / ${network?.effectiveType ?? "unknown"}`,
              userAgent: navigator.userAgent,
            });
            webOneClickLog.replay();
          })
          .catch((error: unknown) => console.error("vConsole 加载失败", error))
          .finally(() => {
            if (!gone.current) setLoading(false);
          });
      }}
    >
      {loading ? "Console 加载中…" : "Console"}
    </button>
  );
}
