import { useId, useRef, useState } from "react";
import { useQueryClient, type Query } from "@tanstack/react-query";
import { SmilePlus } from "lucide-react";
import {
  commentReactionOptions,
  type CommentReactionType,
  type CommentView,
} from "../../api/comments";
import { accessPromptPresented } from "../../api/client";
import type { Page } from "../../api/models";
import { sessionSignal } from "../../app/runtime";
import { useApp } from "../../app/state";
import { useActionAccess } from "../access";
import { commentError } from "./state";

export function CommentReactions({
  commentId,
  reactions,
}: {
  commentId: number;
  reactions: NonNullable<CommentView["reactions"]>;
}) {
  const { api, user, session } = useApp();
  const cache = useQueryClient();
  const access = useActionAccess();
  const pickerId = useId();
  const opener = useRef<HTMLButtonElement>(null);
  const pending = useRef(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const counts = new Map(reactions.map((value) => [value.reaction, value]));

  const close = () => {
    setOpen(false);
    opener.current?.focus();
  };

  async function respond(reaction: CommentReactionType) {
    if (pending.current) return;
    const selected = counts.get(reaction)?.selected !== true;
    if (!access()) return;
    const affected = {
      predicate: (query: Query) => {
        const [scope, kind, viewer] = query.queryKey;
        return (
          scope === "comments" &&
          viewer === (user?.id ?? "guest") &&
          (kind === "list" || kind === "replies" || kind === "preview") &&
          (query.state.data as Page<CommentView> | undefined)?.items?.some(
            (item) => item.id === commentId,
          ) === true
        );
      },
    };
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await cache.cancelQueries(affected);
      const current = await api.setCommentReaction(
        commentId,
        reaction,
        selected,
      );
      if (sessionSignal(session).aborted) return;
      cache.setQueriesData<Page<CommentView>>(affected, (page) => {
        if (!page?.items?.some((item) => item.id === commentId)) return page;
        return {
          ...page,
          items: page.items.map((item) =>
            item.id === commentId ? { ...item, reactions: current } : item,
          ),
        };
      });
      if (
        open ||
        (!selected && !current.some((item) => item.reaction === reaction))
      )
        close();
    } catch (failure) {
      if (sessionSignal(session).aborted || accessPromptPresented(failure))
        return;
      setError(commentError(failure));
      await cache.invalidateQueries(affected);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <div
      className="comments-reactions"
      onKeyDown={(event) => {
        if (open && event.key === "Escape") {
          event.stopPropagation();
          close();
        }
      }}
    >
      <div className="comments-reaction-buttons">
        {commentReactionOptions.map(({ reaction, emoji, label }) => {
          const value = counts.get(reaction);
          if (!value) return null;
          return (
            <button
              key={reaction}
              type="button"
              aria-label={`${label}，${value.count} 人回应`}
              aria-pressed={value.selected}
              disabled={busy}
              onClick={() => void respond(reaction)}
            >
              <span aria-hidden="true">{emoji}</span>
              <span aria-hidden="true">{value.count}</span>
            </button>
          );
        })}
        <button
          type="button"
          ref={opener}
          aria-label="表情回应"
          aria-expanded={open}
          aria-controls={pickerId}
          onClick={() => setOpen((value) => !value)}
        >
          <SmilePlus size={18} aria-hidden="true" />
          <span>表情</span>
        </button>
      </div>
      <div id={pickerId} hidden={!open}>
        <div
          className="comments-reaction-picker"
          role="group"
          aria-label="选择回应表情"
        >
          {commentReactionOptions.map(({ reaction, emoji, label }) => (
            <button
              key={reaction}
              type="button"
              aria-label={label}
              aria-pressed={counts.get(reaction)?.selected === true}
              disabled={busy}
              onClick={() => void respond(reaction)}
            >
              <span aria-hidden="true">{emoji}</span>
            </button>
          ))}
        </div>
      </div>
      {error && (
        <span className="comments-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
