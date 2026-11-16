// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppProvider } from "../../app/context";
import { writeSession } from "../../app/runtime";
import { NotificationCards } from "./Community";

let host: HTMLDivElement;
let root: Root;
let unreadMembers: number;
let unreadCard: number;
let readAllCalls: number;
const ok = (data: unknown) => new Response(JSON.stringify({ code: 0, data }));

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
  await act(async () =>
    root.render(
      <AppProvider>
        <MemoryRouter initialEntries={["/notifications"]}>
          <NotificationCards />
        </MemoryRouter>
      </AppProvider>,
    ),
  );
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
