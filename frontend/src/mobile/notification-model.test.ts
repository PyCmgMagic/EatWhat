import { expect, it } from "vitest";
import {
  notificationGroups,
  notificationTime,
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
it("groups and sorts messages by Beijing calendar days across midnight", () => {
  const groups = notificationGroups(
    [
      card({ id: "2", day: "2026-11-15", latestAt: now - 3_600_000 }),
      card({ id: "3", day: "2026-11-14", latestAt: now - 86_400_000 * 2 }),
      card({ id: "1", day: "2026-11-16", latestAt: now - 60_000 }),
    ],
    now,
  );
  expect(groups.map((group) => group.label)).toEqual([
    "今天",
    "昨天",
    "11月14日",
  ]);
  expect(groups.map((group) => group.items[0].id)).toEqual(["1", "2", "3"]);
});
it("formats recent messages and tolerates missing timestamps", () => {
  expect(notificationTime(now - 600_000, now)).toBe("10 分钟前");
  expect(notificationTime(now - 9 * 3_600_000, now)).toBe("9 小时前");
  expect(notificationTime(undefined, now)).toBe("");
  expect(
    notificationGroups([card({ day: null, latestAt: null })], now)[0].label,
  ).toBe("更早");
});
