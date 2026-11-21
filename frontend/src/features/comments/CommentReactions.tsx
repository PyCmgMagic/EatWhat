import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
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

type Reactions = NonNullable<CommentView["reactions"]>;

/** Mirrors the backend rule: one reaction per viewer, picking another switches it. */
function toggleLocally(
  reactions: Reactions,
  reaction: CommentReactionType,
  selected: boolean,
): Reactions {
  const next = reactions
    .map((item) =>
      item.selected && (item.reaction !== reaction || !selected)
        ? { ...item, selected: false, count: Math.max(0, item.count - 1) }
        : item,
    )
    .filter((item) => item.count > 0);
  if (!selected) return next;
  const existing = next.find((item) => item.reaction === reaction);
  if (existing?.selected) return next;
  const order = commentReactionOptions.map((option) => option.reaction);
  return (
    existing
      ? next.map((item) =>
          item === existing
            ? { ...item, selected: true, count: item.count + 1 }
            : item,
        )
      : [...next, { reaction, count: 1, selected: true }]
  ).sort((a, b) => order.indexOf(a.reaction) - order.indexOf(b.reaction));
}

function isCommentView(value: unknown): value is CommentView {
  return typeof value === "object" && value != null && "id" in value;
}

/** Patches one comment's reactions in either a page of comments or a single comment detail. */
function patchComment(data: unknown, commentId: number, reactions: Reactions) {
  const page = data as Page<CommentView> | undefined;
  if (Array.isArray(page?.items)) {
    if (!page.items.some((item) => item.id === commentId)) return data;
    return {
      ...page,
      items: page.items.map((item) =>
        item.id === commentId ? { ...item, reactions } : item,
      ),
    };
  }
  if (isCommentView(data) && data.id === commentId)
    return { ...data, reactions };
  return data;
}

function holdsComment(data: unknown, commentId: number) {
  const page = data as Page<CommentView> | undefined;
  if (Array.isArray(page?.items))
    return page.items.some((item) => item.id === commentId);
  return isCommentView(data) && data.id === commentId;
}

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
  // Keeps the picker mounted while its exit animation plays.
  const [closing, setClosing] = useState(false);
  const wasOpen = useRef(false);
  useEffect(() => {
    const justClosed = wasOpen.current && !open;
    wasOpen.current = open;
    if (!justClosed) {
      setClosing(false);
      return;
    }
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) return;
    setClosing(true);
    const timer = window.setTimeout(() => setClosing(false), 170);
    return () => window.clearTimeout(timer);
  }, [open]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const counts = new Map(reactions.map((value) => [value.reaction, value]));

  const close = () => {
    setOpen(false);
    opener.current?.focus();
  };

  // Close the floating picker on an outside tap.
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  async function respond(reaction: CommentReactionType) {
    if (pending.current) return;
    const selected = counts.get(reaction)?.selected !== true;
    if (!access()) return;
    const viewer = user?.id ?? "guest";
    const affected = {
      predicate: (query: Query) =>
        query.queryKey[0] === "comments" &&
        query.queryKey[2] === viewer &&
        holdsComment(query.state.data, commentId),
    };
    const apply = (next: Reactions) =>
      cache.setQueriesData(affected, (data: unknown) =>
        patchComment(data, commentId, next),
      );
    pending.current = true;
    setBusy(true);
    setError("");
    if (open) close();
    try {
      await cache.cancelQueries(affected);
      // Optimistic: the chip updates in the tap frame, not after the round trip.
      apply(toggleLocally(reactions, reaction, selected));
      const current = await api.setCommentReaction(
        commentId,
        reaction,
        selected,
      );
      if (sessionSignal(session).aborted) return;
      if (Array.isArray(current)) apply(current);
      else await cache.invalidateQueries(affected);
    } catch (failure) {
      if (sessionSignal(session).aborted) return;
      apply(reactions);
      if (!accessPromptPresented(failure)) setError(commentError(failure));
      await cache.invalidateQueries(affected);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <div
      ref={root}
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
          className="comments-reaction-opener"
          onClick={() => setOpen((value) => !value)}
        >
          <SmilePlus size={18} aria-hidden="true" />
          <span>表情</span>
        </button>
      </div>
      <div
        id={pickerId}
        className="comments-reaction-popover"
        data-state={open ? "open" : "closed"}
        hidden={!open && !closing}
      >
        <div
          className="comments-reaction-picker"
          role="group"
          aria-label="选择回应表情"
        >
          {commentReactionOptions.map(({ reaction, emoji, label }, index) => (
            <button
              key={reaction}
              style={{ "--i": index } as CSSProperties}
              type="button"
              aria-label={label}
              title={label}
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
