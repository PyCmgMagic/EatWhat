import { expect, it } from "vitest";
import {
  notificationGroups,
  notificationTime,
  mobileNotificationTime,
  notificationView,
  type NotificationCard,
} from "./notification-model";

const now = Date.parse("2026-11-15T16:10:00Z"); // Beijing: November 16, 00:10.
const card = (patch: Partial<NotificationCard> = {}): NotificationCard =>
  ({
    id: "1",
    kind: "new_device_login",
    column: "SYSTEM",
    day: "2026-11-16",
    memberCount: 1,
    unreadMemberCount: 1,
    latestAt: now - 600_000,
    actors: [],
    data: { detail: { type: "new_device_login", deviceName: "Android" } },
    ...patch,
  }) as NotificationCard;

it("shows a security title and links new-device messages to device management", () => {
  expect(notificationView(card())).toMatchObject({
    title: "你的账号已在新设备上登录",
    icon: "shield",
    href: "/settings/devices",
  });
  expect(notificationView(card()).body).toContain("Android");
});
it("uses the follow actor's profile rather than the recipient's target", () => {
  expect(
    notificationView(
      card({
        kind: "follow",
        data: null,
        actors: [{ id: 21, name: "小林" }],
        target: { domain: "users", id: 10 },
      }),
    ),
  ).toMatchObject({
    title: "小林关注了你",
    href: "/users/21",
    icon: "follow",
  });
});
it("identifies likes on a comment when the card has no detail", () => {
  expect(
    notificationView(
      card({
        kind: "comment_like",
        column: "LIKES_AND_FAVORITES",
        actors: [{ id: 21, name: "小林" }],
        target: { domain: "comments", id: 7 },
        data: null,
      }),
    ),
  ).toMatchObject({
    title: "小林赞了你的评论",
    icon: "heart",
    href: "/comments?commentId=7",
  });
});
it("retains aggregate counts and connects comments to their food", () => {
  expect(
    notificationView(
      card({
        kind: "like",
        memberCount: 12,
        actors: [{ id: 21, name: "小林" }],
        data: null,
      }),
    ).title,
  ).toContain("等 12 人");
  expect(
    notificationView(
      card({
        kind: "reply",
        data: { detail: { foodId: 7, commentText: "谢谢推荐" } },
      } as Partial<NotificationCard>),
    ),
  ).toMatchObject({ href: "/foods/7?section=comments", body: "谢谢推荐" });
});
it("does not link removed content or an unavailable target", () => {
  expect(
    notificationView(
      card({
        kind: "like",
        data: null,
        target: { id: 7, domain: "foods", unavailable: true },
      }),
    ).href,
  ).toBeUndefined();
  expect(
    notificationView(
      card({
        kind: "content_removed",
        data: { detail: { type: "content_removed", reason: "内容已删除" } },
      } as unknown as Partial<NotificationCard>),
    ).href,
  ).toBeUndefined();
});
it("starts a new week at Monday midnight in Beijing", () => {
  const groups = notificationGroups(
    [
      card({ id: "2", day: "2026-11-15", latestAt: now - 3_600_000 }),
      card({ id: "3", day: "2026-11-14", latestAt: now - 86_400_000 * 2 }),
      card({ id: "1", day: "2026-11-16", latestAt: now - 60_000 }),
    ],
    now,
  );
  expect(groups.map((group) => group.label)).toEqual(["今天", "更早"]);
  expect(groups.map((group) => group.items.map(item => item.id))).toEqual([["1"], ["2", "3"]]);
});
it("keeps this week's messages together and normalizes second timestamps before sorting", () => {
  const sunday = Date.parse("2026-11-22T05:52:00Z");
  const groups = notificationGroups([
    card({ id: "old", day: "2026-11-15", latestAt: sunday - 7 * 86_400_000 }),
    card({ id: "friday", day: "2026-11-20", latestAt: sunday - 2 * 86_400_000 }),
    card({ id: "today", day: "2026-11-22", latestAt: sunday / 1000 }),
    card({ id: "yesterday", day: "2026-11-21", latestAt: (sunday - 86_400_000) / 1000 }),
  ], sunday);
  expect(groups.map(group => group.label)).toEqual(["今天", "本周", "更早"]);
  expect(groups.map(group => group.items.map(item => item.id))).toEqual([["today"], ["yesterday", "friday"], ["old"]]);
  expect(mobileNotificationTime(sunday - 86_400_000, sunday)).toBe("昨天");
  expect(mobileNotificationTime(sunday - 2 * 86_400_000, sunday)).toBe("周五");
  expect(mobileNotificationTime(now - 11 * 60_000, now)).toBe("昨天");
});
it("shows named removal reasons and device details without an unsafe content link", () => {
  expect(notificationView(card({ data: { detail: { type: "content_removed", title: "123", reason: "删除测试数据" } } } as unknown as Partial<NotificationCard>))).toMatchObject({
    title: "你上传的「123」已被删除", body: "原因：删除测试数据", href: undefined,
  });
  expect(notificationView(card({ data: { detail: { type: "new_device_login", device: "WEB" } } } as unknown as Partial<NotificationCard>)).device).toEqual({ name: "网页版", desktop: true });
  expect(notificationView(card({ kind: "follow", data: null, actors: [{ id: 21, name: "小林" }] } as Partial<NotificationCard>)).actor?.id).toBe(21);
});
it("formats recent messages and tolerates missing timestamps", () => {
  expect(notificationTime(now - 600_000, now)).toBe("10 分钟前");
  expect(notificationTime(now - 9 * 3_600_000, now)).toBe("9 小时前");
  expect(notificationTime(undefined, now)).toBe("");
  expect(
    notificationGroups([card({ day: null, latestAt: null })], now)[0].label,
  ).toBe("更早");
});
