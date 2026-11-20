// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { handleComments, seedComments, type DemoComments } from "./comments-v7";
import type { RequestOptions } from "../api/client";
import type { Food, User } from "../api/models";

const foods: Food[] = [{ id: 1, name: "云吞" }];
let state: DemoComments;
const user: User = { id: 10, displayName: "同学", verified: true };
let actor = { user, authenticated: true, admin: false };
const call = (path: string, options: RequestOptions = {}) =>
  handleComments(state, path, options, actor, foods) as any;
const post = (text: string, key = crypto.randomUUID()) =>
  call("/foods/1/comments", {
    method: "POST",
    body: { text },
    headers: { "Idempotency-Key": key },
  });
const review = (revisionId: string, verdict: string, reasonCode?: string) => {
  actor.admin = true;
  return call("/admin/comments/moderation/review", {
    method: "POST",
    body: { decisionId: crypto.randomUUID(), revisionId, verdict, reasonCode },
  });
};
beforeEach(() => {
  state = seedComments(foods, user);
  actor = { user: { ...user }, authenticated: true, admin: false };
});
describe("isolated v7 comment lifecycle", () => {
  it("replaces a viewer's reaction and lets an unverified former voter remove it", () => {
    const id = state.rows[0].id;
    const react = (emoji: string, method = "PUT") =>
      call(`/comments/${id}/reactions/${emoji}`, { method });
    expect(react("HEART")).toEqual([
      { reaction: "HEART", count: 1, selected: true },
    ]);
    expect(react("YUMMY")).toEqual([
      { reaction: "YUMMY", count: 1, selected: true },
    ]);
    actor.authenticated = false;
    expect(
      call("/foods/1/comments").items.find((r: { id: number }) => r.id === id)
        .reactions,
    ).toEqual([{ reaction: "YUMMY", count: 1, selected: false }]);
    actor.authenticated = true;
    actor.user.verified = false;
    expect(() => react("HEART")).toThrow(/认证/);
    expect(react("YUMMY", "DELETE")).toEqual([]);
  });

  it("exposes author profile details on comments and replies", () => {
    actor.user.avatar = "https://cdn.example.com/avatar/foodie.webp";
    state = seedComments(foods, actor.user);
    const own = call("/foods/1/comments").items.find(
      (row: any) => row.authorId === user.id,
    );
    expect(own).toMatchObject({
      authorId: user.id,
      authorName: user.displayName,
      authorAvatar: actor.user.avatar,
    });
    const accepted = call(`/foods/1/comments/${own.id}/replies`, {
      method: "POST",
      body: { text: "补充一下用餐感受" },
      headers: { "Idempotency-Key": crypto.randomUUID() },
    });
    review(accepted.revisionId, "APPROVE");
    expect(call(`/comments/${own.id}/replies`).items[0]).toMatchObject({
      authorId: user.id,
      authorName: user.displayName,
      authorAvatar: actor.user.avatar,
    });
  });

  it("keeps new comments private until approved and exposes rejection reasons only in mine", () => {
    const accepted = post("新评论");
    expect(accepted.moderationStatus).toBe("PENDING");
    expect(
      call("/foods/1/comments").items.some((x: any) => x.id === accepted.id),
    ).toBe(false);
    expect(
      call("/comments/submissions/my").items.find(
        (x: any) => x.id === accepted.id,
      ),
    ).toMatchObject({
      text: "新评论",
      imageCount: 0,
      moderationStatus: "PENDING",
    });
    review(accepted.revisionId, "APPROVE");
    expect(
      call("/foods/1/comments").items.some((x: any) => x.id === accepted.id),
    ).toBe(true);
    const rejected = post("另一条评论");
    review(rejected.revisionId, "REJECT", "请补充用餐内容");
    expect(
      call("/comments/submissions/my").items.find(
        (x: any) => x.id === rejected.id,
      ),
    ).toMatchObject({
      moderationStatus: "REJECTED",
      reasonMessage: "请补充用餐内容",
    });
  });
  it("replays the same command and rejects payload changes", () => {
    const key = crypto.randomUUID(),
      first = post("唯一评论", key);
    expect(post("唯一评论", key)).toEqual(first);
    expect(state.rows.filter((x) => x.text === "唯一评论")).toHaveLength(1);
    expect(() => post("改了正文", key)).toThrow(/不同内容/);
  });
  it("supports replies to replies using the root route, and galleries only contain public images", () => {
    const root =
      call("/foods/1/comments").items.find(
        (x: any) => x.id === x.rootCommentGid,
      ) ??
      state.rows.find(
        (x) => x.rootId === x.id && x.moderationStatus === "APPROVED",
      )!;
    const target = state.rows.find(
      (x) => x.rootId === root.id && x.id !== root.id,
    )!;
    const result = call(`/foods/1/comments/${root.id}/replies`, {
      method: "POST",
      body: {
        text: "回复具体的人",
        replyToId: target.id,
        pictureKeys: ["comments/picture"],
      },
      headers: { "Idempotency-Key": crypto.randomUUID() },
    });
    expect(
      call("/foods/1/gallery").items.some(
        (x: any) => x.commentId === result.id,
      ),
    ).toBe(false);
    review(result.revisionId, "APPROVE");
    expect(
      call(`/comments/${root.id}/replies`).items.find(
        (x: any) => x.id === result.id,
      ),
    ).toMatchObject({ replyToGid: target.gid });
    expect(
      call("/foods/1/gallery").items.find(
        (x: any) => x.commentId === result.id,
      ),
    ).toMatchObject({ image: { slot: 0, expiresInSeconds: 300 } });
  });
  it("keeps likes idempotent and returns authoritative counts", () => {
    const id = state.rows[0].id,
      original = state.rows[0].likesCount,
      key = crypto.randomUUID();
    const options = { method: "PUT", headers: { "Idempotency-Key": key } };
    expect(call(`/comments/${id}/like`, options)).toMatchObject({
      liked: true,
      likesCount: original + 1,
    });
    expect(call(`/comments/${id}/like`, options).likesCount).toBe(original + 1);
    expect(
      call(`/comments/${id}/like`, {
        method: "DELETE",
        headers: { "Idempotency-Key": crypto.randomUUID() },
      }),
    ).toMatchObject({ liked: false, likesCount: original });
  });
  it("enforces owner deletion and hides the root's replies and images", () => {
    const original = state.rows[0];
    expect(() =>
      call(`/comments/${original.id}`, {
        method: "DELETE",
        headers: { "Idempotency-Key": crypto.randomUUID() },
      }),
    ).toThrow(/自己的评论/);
    actor.user.id = original.authorId;
    const key = crypto.randomUUID(),
      options = { method: "DELETE", headers: { "Idempotency-Key": key } };
    expect(call(`/comments/${original.id}`, options)).toEqual(
      call(`/comments/${original.id}`, options),
    );
    expect(
      call("/foods/1/gallery").items.some(
        (x: any) => x.commentId === original.id,
      ),
    ).toBe(false);
    expect(() => call(`/comments/${original.id}/replies`)).toThrow(/不可见/);
    expect(
      call("/comments/submissions/my").items.find(
        (x: any) => x.id === original.id,
      ),
    ).toMatchObject({ text: null, imageCount: 0, moderationStatus: "DELETED" });
  });
  it("allows guests to read, denies private reads and blocks unverified image submissions", () => {
    actor.authenticated = false;
    expect(call("/foods/1/comments").items.length).toBeGreaterThan(0);
    expect(() => call("/comments/submissions/my")).toThrow(/登录/);
    actor.authenticated = true;
    actor.user.verified = false;
    expect(post("纯文字").moderationStatus).toBe("PENDING");
    expect(() =>
      call("/foods/1/comments", {
        method: "POST",
        body: { text: "图片", pictureKeys: ["comments/photo"] },
        headers: { "Idempotency-Key": crypto.randomUUID() },
      }),
    ).toThrow(/学生认证/);
    expect(() => call("/admin/comments/moderation/queue")).toThrow(/管理员/);
  });
  it("supports hide, restore and delete moderation commands", () => {
    const row = state.rows[0];
    review(row.revisionId, "HIDE");
    expect(
      call("/foods/1/comments").items.some((x: any) => x.id === row.id),
    ).toBe(false);
    review(row.revisionId, "RESTORE");
    expect(
      call("/foods/1/comments").items.some((x: any) => x.id === row.id),
    ).toBe(true);
    review(row.revisionId, "DELETE");
    expect(
      call("/foods/1/comments").items.some((x: any) => x.id === row.id),
    ).toBe(false);
  });
});
