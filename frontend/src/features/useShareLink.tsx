import { useRef, useState } from "react";
import { useApp } from "../app/state";
import { usePageLifetime } from "../app/drafts";
import { ShareSheet } from "./ShareSheet";

export async function copyLink(url: string) {
  try {
    if (typeof navigator.clipboard?.writeText !== "function") return false;
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

export async function shareLink(data: { title: string; url: string }) {
  if (typeof navigator.share !== "function") return "unsupported";
  try {
    await navigator.share(data);
    return "shared";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      return "cancelled";
    return "failed";
  }
}

export function useShareLink() {
  const { toast } = useApp();
  const active = usePageLifetime();
  const pending = useRef(false);
  const request = useRef(0);
  const [data, setData] = useState<{ title: string; url: string } | null>(null);
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const share = (title: string) => {
    if (pending.current) return;
    request.current++;
    setManual(false);
    setData({ title, url: location.href });
  };
  const close = () => {
    request.current++;
    setData(null);
  };
  const choose = async (action: "share" | "copy") => {
    if (!data || data.url !== location.href) return;
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    const id = request.current;
    try {
      const result =
        action === "copy"
          ? (await copyLink(data.url))
            ? "copied"
            : "manual"
          : await shareLink(data);
      if (
        !active.current ||
        request.current !== id ||
        location.href !== data.url
      )
        return;
      if (result === "copied") {
        toast("链接已复制", { tone: "success" });
        close();
      } else if (result === "shared") close();
      else if (result === "manual") {
        setManual(true);
        if (manual) toast("请长按选中的链接复制");
      } else if (result === "unsupported")
        toast("当前浏览器不支持直接分享，请复制链接");
      else if (result === "failed") toast("分享未完成，请重试或复制链接");
    } finally {
      pending.current = false;
      if (active.current) setBusy(false);
    }
  };
  const fallback =
    data && data.url === location.href ? (
      <ShareSheet
        title={data.title}
        url={data.url}
        busy={busy}
        manual={manual}
        onClose={close}
        onShare={() => void choose("share")}
        onCopy={() => void choose("copy")}
      />
    ) : null;
  return { share, fallback };
}
