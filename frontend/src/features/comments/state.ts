import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useApp } from "../../app/state";
import { usePageLifetime, useSessionDraft } from "../../app/drafts";
import { sessionSignal } from "../../app/runtime";
import {
  accessPromptPresented,
  errorMessage,
  resultUncertain,
  unavailable,
} from "../../api/client";

export function commentError(error: unknown) {
  return unavailable(error)
    ? "评论暂未开放，请稍后再试。"
    : errorMessage(error);
}

/** Freeze both the payload and command UUID until the server confirms a result. */
export function useCommentCommand<P, R>(
  scope: string,
  send: (payload: P, id: string) => Promise<R>,
  after?: (value: R) => void | Promise<void>,
) {
  const { user, session } = useApp();
  const key = `comments:command:${user?.id ?? "guest"}:${scope}`;
  const empty = { id: "", payload: null as P | null };
  const [pending, setPending, clear] = useSessionDraft(key, empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false),
    active = usePageLifetime();
  return {
    busy,
    error,
    pending: !!pending.id,
    run: async (payload: P) => {
      if (lock.current) return;
      lock.current = true;
      setBusy(true);
      setError("");
      const frozen = pending.id
        ? pending
        : { id: crypto.randomUUID(), payload };
      setPending(frozen);
      try {
        const value = await send(frozen.payload as P, frozen.id);
        if (sessionSignal(session).aborted) return;
        setPending(empty);
        clear();
        if (active.current) await after?.(value);
        return value;
      } catch (failure) {
        if (sessionSignal(session).aborted) return;
        if (!resultUncertain(failure)) {
          setPending(empty);
          clear();
        }
        if (active.current && !accessPromptPresented(failure))
          setError(
            resultUncertain(failure)
              ? "结果尚未确认，请重试确认。同一次操作不会重复提交。"
              : commentError(failure),
          );
      } finally {
        lock.current = false;
        if (active.current) setBusy(false);
      }
    },
  };
}

export function useRefreshComments() {
  const cache = useQueryClient();
  return async () => {
    await cache.invalidateQueries({ queryKey: ["comments"] });
    await cache.invalidateQueries({ queryKey: ["user"] });
    await cache.invalidateQueries({ queryKey: ["me"] });
  };
}

export function commentTime(value?: string | null) {
  const date = value ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime())) return "";
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 60000),
  );
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} 小时前`;
  return date.toLocaleDateString("zh-CN", { month: "long", day: "numeric" });
}

export const commentStatus = (value?: string | null) =>
  ({
    PENDING: "待审核",
    APPROVED: "已通过",
    REJECTED: "未通过",
    SUPERSEDED: "已被新提交替代",
    DELETED: "已删除",
    HIDDEN: "已隐藏",
  })[value ?? ""] ?? "待确认";
