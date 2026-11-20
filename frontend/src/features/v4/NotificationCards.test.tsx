// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppProvider } from "../../app/context";
import { writeSession } from "../../app/runtime";
import MobileNotifications from "../../mobile/Notifications";
import { Messages } from "./Messages";

let host: HTMLDivElement;
let root: Root;
let unreadMembers: number;
let unreadCard: number;
let readAllCalls: number;
const ok = (data: unknown) => new Response(JSON.stringify({ code: 0, data }));

function Destination() {
  const { pathname } = useLocation();
  return <output>{pathname}</output>;
}

async function renderNotifications(mobile = false) {
  await act(async () =>
    root.render(
      <AppProvider>
        <MemoryRouter initialEntries={["/notifications"]}>
          <Routes>
            <Route
              path="/notifications"
              element={mobile ? <MobileNotifications /> : <Messages />}
            />
            <Route path="/users/:id" element={<Destination />} />
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
  unreadMembers = 2;
  unreadCard = 1;
  readAllCalls = 0;
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
          ok({ members: unreadMembers, cards: unreadCard }),
        );
      if (path.endsWith("/notification/cards/read-all")) {
        readAllCalls++;
        unreadMembers = 0;
        unreadCard = 0;
        return Promise.resolve(ok(null));
      }
      if (path.endsWith("/notification/cards/92/read"))
        return Promise.resolve(ok(null));
      if (path.endsWith("/notification/cards"))
        return Promise.resolve(
          ok({
            items: [
              {
                id: 91,
                kind: "like",
                memberCount: 1,
                unreadMemberCount: unreadCard,
                latestAt: Date.now(),
                actors: [{ id: 22, displayName: "Maycry" }],
              },
              {
                id: 95,
                kind: "comment_like",
                target: { domain: "comments", id: 7 },
                memberCount: 2,
                unreadMemberCount: 0,
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
                unreadMemberCount: unreadCard,
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
  expect(host.textContent).toContain("2 条未读");
  expect(host.textContent).toContain("Maycry赞了你的分享");
  expect(host.textContent).toContain("小林、小吴赞了你的评论");
  expect(host.querySelector('.profile-message-heading a[href="/comments?commentId=7"]')).not.toBeNull();
  expect(host.textContent).not.toContain("1 条点赞");
  expect(host.querySelector(".profile-message-unread")).not.toBeNull();
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
  expect(reply?.textContent).toBe("小");
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
  const actorLink = '.mobile-inbox a[aria-label="查看小林的主页"]';
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
  expect(avatar.textContent).toBe("小");
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
