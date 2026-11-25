// @vitest-environment jsdom
import { act } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { createRoot, type Root } from "react-dom/client";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppProvider } from "../../app/context";
import { writeSession } from "../../app/runtime";
import MobileNotifications from "../../mobile/Notifications";
import { Messages } from "./Messages";

let host: HTMLDivElement;
let root: Root;
let cache: QueryClient;
let unreadById: Map<number, number>;
let readAllCalls: number;
let following: boolean;
let failFollow: boolean;
let failReadAll: boolean;
const ok = (data: unknown) => new Response(JSON.stringify({ code: 0, data }));

function Destination() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output>{pathname}{search}</output>
      <button onClick={() => navigate(-1)}>返回</button>
    </>
  );
}

function Inbox({ mobile }: { mobile: boolean }) {
  cache = useQueryClient();
  return mobile ? <MobileNotifications /> : <Messages />;
}

async function renderNotifications(mobile = false) {
  await act(async () =>
    root.render(
      <AppProvider>
        <MemoryRouter initialEntries={["/notifications"]}>
          <Routes>
            <Route path="/notifications" element={<Inbox mobile={mobile} />} />
            <Route path="/users/:id" element={<Destination />} />
            <Route path="/foods/:id" element={<Destination />} />
            <Route path="/comments" element={<Destination />} />
          </Routes>
        </MemoryRouter>
      </AppProvider>,
    ),
  );
}

async function spin(condition: () => boolean) {
  for (let i = 0; i < 70 && !condition(); i++)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  expect(condition(), "test setup condition").toBe(true);
}

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  sessionStorage.clear();
  unreadById = new Map([
    [96, 1],
    [92, 1],
    [95, 2],
  ]);
  readAllCalls = 0;
  following = true;
  failFollow = false;
  failReadAll = false;
  writeSession({ tokenName: "satoken", tokenValue: "notifications" });
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input).split("?")[0];
      if (path.endsWith("/user/info"))
        return Promise.resolve(
          ok({ id: 11, displayName: "食友甲", verified: true, banned: false }),
        );
      if (path.endsWith("/notification/cards/unread/count"))
        return Promise.resolve(
          ok({
            members: [...unreadById.values()].reduce(
              (sum, count) => sum + count, 0,
            ),
            cards: unreadById.size,
          }),
        );
      if (path.endsWith("/notification/cards/read-all")) {
        readAllCalls++;
        if (failReadAll) return Promise.resolve(new Response(JSON.stringify({ code: 400, msg: "标记失败，请重试" }), { status: 400 }));
        unreadById.clear();
        return Promise.resolve(ok(null));
      }
      if (path.endsWith("/user/userInfo")) return Promise.resolve(ok({ id: 30, displayName: "FooFish", isFollowingHim: following, isFollowingMe: true }));
      if (/\/user\/(follow|unfollow)$/.test(path)) {
        if (failFollow) return Promise.resolve(new Response(JSON.stringify({ code: 400, msg: "关注更新失败" }), { status: 400 }));
        following = path.endsWith("/follow");
        return Promise.resolve(ok(null));
      }
      const read = path.match(/\/notification\/cards\/(\d+)\/read$/);
      if (read && init?.method === "POST") {
        unreadById.delete(Number(read[1]));
        return Promise.resolve(ok(null));
      }
      if (path.endsWith("/notification/cards"))
        return Promise.resolve(
          ok({
            items: [
              {
                id: 90, kind: "follow", column: "FOLLOWS", memberCount: 1, unreadMemberCount: 0,
                latestAt: Date.now(), actors: [{ id: 30, displayName: "FooFish" }],
              },
              {
                id: 96,
                kind: "new_device_login",
                data: {
                  type: "new_device_login",
                  deviceName: "Chrome · Android",
                },
                memberCount: 1,
                unreadMemberCount: unreadById.get(96) ?? 0,
                latestAt: Date.now(),
                actors: [],
              },
              {
                id: 91,
                kind: "like",
                memberCount: 1,
                unreadMemberCount: 0,
                latestAt: Date.now(),
                actors: [{ id: 22, displayName: "Maycry" }],
              },
              {
                id: 95,
                kind: "comment_like",
                target: { domain: "comments", id: 7 },
                memberCount: 2,
                unreadMemberCount: unreadById.get(95) ?? 0,
                latestAt: Date.now(),
                actors: [
                  { id: 23, displayName: "小林" },
                  { id: 24, displayName: "小吴" },
                ],
              },
              {
                id: 92,
                kind: "comment",
                target: { domain: "foods", id: 7 },
                memberCount: 2,
                unreadMemberCount: unreadById.get(92) ?? 0,
                latestAt: Date.now(),
                actors: [
                  { id: 23, displayName: "小林", avatar: "/assets/lin.png" },
                  { id: 24, displayName: "小陈" },
                ],
              },
              {
                id: 93,
                kind: "reply",
                target: { domain: "comments", id: 5 },
                data: { foodId: 7 },
                memberCount: 1,
                unreadMemberCount: 0,
                latestAt: Date.now(),
                actors: [{ id: 25, displayName: "小周", avatar: null }],
              },
              {
                id: 94,
                kind: "reply",
                target: { domain: "comments", id: 6 },
                data: null,
                memberCount: 1,
                unreadMemberCount: 0,
                latestAt: Date.now(),
                actors: [{ id: 26, displayName: "小吴", avatar: null }],
              },
            ],
            hasNext: false,
          }),
        );
      return Promise.resolve(ok({ items: [], hasNext: false }));
    }),
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await renderNotifications();
});

afterEach(async () => {
  await act(async () => root.unmount());
  cache.clear();
  host.remove();
  writeSession(null);
  vi.unstubAllGlobals();
});

it("marks every PC notification read and refreshes the unread state", async () => {
  await spin(() => !!host.querySelector(".profile-message-read-all"));
  const button = host.querySelector<HTMLButtonElement>(
    ".profile-message-read-all",
  )!;
  await spin(() => !button.disabled);
  expect(host.textContent).toContain("4 条未读");
  expect(host.textContent).toContain("Maycry赞了你的分享");
  expect(host.textContent).toContain("小林、小吴赞了你的评论");
  expect(host.querySelector('.profile-message-heading a[href="/comments?commentId=7"]')).not.toBeNull();
  expect(host.textContent).not.toContain("1 条点赞");
  expect(host.querySelector(".profile-message-unread")).not.toBeNull();
  const loginNotice = () =>
    Array.from(host.querySelectorAll("article")).find((row) =>
      row.textContent?.includes("新设备登录"),
    );
  expect(loginNotice()?.textContent).toContain("Chrome · Android");
  expect(loginNotice()?.querySelector("a")).toBeNull();
  expect(loginNotice()?.querySelector("button")?.textContent).toContain(
    "标为已读",
  );
  await act(async () => button.click());
  await spin(
    () =>
      readAllCalls === 1 &&
      !!host
        .querySelector(".profile-message-unread-count")
        ?.textContent?.includes("消息都已读完") &&
      !!document.body.textContent?.includes("全部通知已标为已读"),
  );
  expect(button.disabled).toBe(true);
  expect(host.querySelector(".profile-message-unread")).toBeNull();
  expect(loginNotice()?.textContent).toContain("Chrome · Android");
  expect(loginNotice()?.querySelector("a, button")).toBeNull();
  expect(document.body.textContent).toContain("全部通知已标为已读");
  expect(
    vi
      .mocked(fetch)
      .mock.calls.some(
        ([input, init]) =>
          String(input).includes("/notification/cards/read-all") &&
          init?.method === "POST",
      ),
  ).toBe(true);
});

it.each([
  ["查看内容", ".profile-message-target", "/foods/7", 3],
  ["查看评论", ".profile-message-target", "/comments?commentId=7", 2],
  ["评论通知标题", ".profile-message-heading a", "/comments?commentId=7", 2],
] as const)(
  "marks the opened notification read via %s",
  async (_, selector, href, remaining) => {
    const link = () =>
      host.querySelector<HTMLAnchorElement>(`${selector}[href="${href}"]`);
    const unreadDot = () =>
      link()?.closest("article")?.querySelector('[aria-label="未读"]');
    await spin(() => !!unreadDot());
    cache.setQueryData(["notifications", "unread"], 4);

    await act(async () => link()!.click());
    expect(host.querySelector("output")?.textContent).toBe(href);
    await act(async () => host.querySelector("button")!.click());

    await spin(() => !!link() && !unreadDot());
    expect(host.textContent).toContain(`${remaining} 条未读`);
    expect(host.querySelectorAll('[aria-label="未读"]')).toHaveLength(2);
    expect(cache.getQueryState(["notifications", "unread"])?.isInvalidated).toBe(true);

    await act(async () => link()!.click());
    const readRequests = vi.mocked(fetch).mock.calls.filter(
      ([url, init]) =>
        /\/notification\/cards\/\d+\/read$/.test(String(url)) && init?.method === "POST",
    );
    expect(readRequests).toHaveLength(1);
  },
);

it("links the latest comment actor's avatar separately from the desktop notification target", async () => {
  const actorLink = 'a[aria-label="查看小林的主页"]';
  await spin(() => !!host.querySelector(actorLink));
  const avatar = host.querySelector<HTMLAnchorElement>(actorLink)!;
  expect(avatar.getAttribute("href")).toBe("/users/23");
  expect(avatar.querySelector("img")?.getAttribute("src")).toBe(
    "/assets/lin.png",
  );
  expect(
    avatar
      .closest("article")
      ?.querySelector(".profile-message-target")
      ?.getAttribute("href"),
  ).toBe("/foods/7");
  expect(host.querySelector('a[aria-label="查看小陈的主页"]')).toBeNull();
  const reply = host.querySelector('a[aria-label="查看小周的主页"]');
  expect(reply?.getAttribute("href")).toBe("/users/25");
  expect(reply?.querySelector("img")?.hasAttribute("data-default-avatar")).toBe(true);
  expect(
    reply
      ?.closest("article")
      ?.querySelector(".profile-message-target")
      ?.getAttribute("href"),
  ).toBe("/foods/7?section=comments");
  const orphanReply = host.querySelector('a[aria-label="查看小吴的主页"]');
  expect(
    orphanReply?.closest("article")?.querySelector(".profile-message-target"),
  ).toBeNull();
});

it("opens the commenter's profile from the mobile avatar without following the notification content link", async () => {
  await renderNotifications(true);
  const actorLink = '.mobile-inbox-row:has(.mobile-inbox-action[href="/foods/7"]) a[aria-label="查看小林的主页"]';
  await spin(() => !!host.querySelector(actorLink));
  const avatar = host.querySelector<HTMLAnchorElement>(actorLink)!;
  const content = avatar.closest("li")?.querySelector(".mobile-inbox-action");
  expect(content?.getAttribute("href")).toBe("/foods/7");
  expect(content?.contains(avatar)).toBe(false);
  const replyAction = host
    .querySelector('.mobile-inbox a[aria-label="查看小周的主页"]')
    ?.closest("li")
    ?.querySelector(".mobile-inbox-action");
  expect(replyAction?.getAttribute("href")).toBe("/foods/7?section=comments");
  await act(async () =>
    avatar.querySelector("img")!.dispatchEvent(new Event("error")),
  );
  expect(avatar.querySelector("img")?.hasAttribute("data-default-avatar")).toBe(true);
  await act(async () => avatar.click());
  expect(host.querySelector("output")?.textContent).toBe("/users/23");
  expect(
    vi
      .mocked(fetch)
      .mock.calls.some(
        ([input, init]) =>
          String(input).includes("/notification/cards/92/read") &&
          init?.method === "POST",
      ),
  ).toBe(true);
});

it("uses a separate device card and keeps failed mark-all operations retryable on mobile", async () => {
  await renderNotifications(true);
  await spin(() => !!host.querySelector('.mobile-inbox-device[href="/settings/devices"]'));
  const device = host.querySelector(".mobile-inbox-device")!;
  expect(device.textContent).toContain("Chrome · Android");
  expect(device.textContent).toContain("不是本人登录时，可以让它下线");
  expect(host.querySelector(".mobile-inbox-views")).toBeNull();
  const readAll = host.querySelector<HTMLButtonElement>(".mobile-inbox-header > button")!;
  await spin(() => !readAll.disabled);
  failReadAll = true;
  await act(async () => readAll.click());
  await spin(() => document.body.textContent!.includes("标记失败，请重试"));
  expect(host.querySelectorAll('[aria-label="未读"]')).toHaveLength(3);
  expect(readAll.disabled).toBe(false);
  failReadAll = false;
  await act(async () => readAll.click());
  await spin(() => !host.querySelector('[aria-label="未读"]'));
  expect(readAll.disabled).toBe(true);
  expect(readAllCalls).toBe(2);
});

it("updates the real follow relationship without navigating or marking the message read", async () => {
  await renderNotifications(true);
  const button = () => host.querySelector<HTMLButtonElement>(".mobile-inbox-follow")!;
  await spin(() => button()?.textContent === "已互关" && !button().disabled);
  await act(async () => button().click());
  await spin(() => button()?.textContent === "回关" && !button().disabled);
  expect(following).toBe(false);
  expect(host.querySelector("output")).toBeNull();
  failFollow = true;
  await act(async () => button().click());
  await spin(() => document.body.textContent!.includes("关注更新失败"));
  expect(button().textContent).toBe("回关");
  expect(button().getAttribute("aria-pressed")).toBe("false");
  failFollow = false;
  await act(async () => button().click());
  await spin(() => button()?.textContent === "已互关");
  expect(following).toBe(true);
  expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes("/notification/cards/90/read"))).toBe(false);
});

it("restores the mobile category after opening a message and supports keyboard category navigation", async () => {
  await renderNotifications(true);
  await spin(() => !!host.querySelector("#inbox-tab-COMMENTS"));
  await act(async () => host.querySelector<HTMLButtonElement>("#inbox-tab-COMMENTS")!.click());
  await spin(() => !!host.querySelector('.mobile-inbox-action[href="/foods/7"]'));
  await act(async () => host.querySelector<HTMLAnchorElement>('.mobile-inbox-action[href="/foods/7"]')!.click());
  expect(host.querySelector("output")?.textContent).toBe("/foods/7");
  await act(async () => host.querySelector("button")!.click());
  await spin(() => host.querySelector("#inbox-tab-COMMENTS")?.getAttribute("aria-selected") === "true");
  await act(async () => host.querySelector("#inbox-tab-COMMENTS")!.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true })));
  expect(host.querySelector("#inbox-tab-SYSTEM")?.getAttribute("aria-selected")).toBe("true");
  expect(document.activeElement?.id).toBe("inbox-tab-SYSTEM");
  expect(host.querySelector('.mobile-inbox-announcement-link[href="/announcements"]')).not.toBeNull();
});
