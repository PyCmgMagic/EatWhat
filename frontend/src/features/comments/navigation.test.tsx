// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppContext, type AppState } from "../../app/state";
import { CommentDestination, FoodDiscussion, MobileComments } from "./Comments";
import { commentLikeLink } from "../../api/notifications";

vi.mock("../../app/runtime", () => ({
  isDemo: false,
  sessionSignal: () => new AbortController().signal,
}));
vi.mock("../access", () => ({ useActionAccess: () => () => true }));
vi.mock("../../app/area", () => ({ useArea: () => ({ campusId: 1 }) }));

let host: HTMLDivElement, root: Root, cache: QueryClient;

function Screen() {
  const location = useLocation(),
    navigate = useNavigate();
  return (
    <>
      <output data-testid="location">
        {location.pathname + location.search}
      </output>
      {location.pathname.startsWith("/comments") && <MobileComments />}
      <button data-testid="history-back" onClick={() => navigate(-1)}>
        浏览器返回
      </button>
    </>
  );
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  sessionStorage.clear();
  cache = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  cache.setQueryData(["food", 71], { id: 71, name: "招牌云吞" });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  cache.clear();
  host.remove();
  vi.unstubAllGlobals();
});

function NotificationTarget({ desktop }: { desktop: boolean }) {
  const location = useLocation();
  if (!desktop) return <MobileComments />;
  return location.pathname === "/comments" ? (
    <CommentDestination commentId={37} desktop />
  ) : (
    <FoodDiscussion food={{ id: 71, name: "招牌云吞" }} />
  );
}

it.each([
  [false, null],
  [false, 9],
  [true, null],
  [true, 9],
] as const)(
  "opens the exact liked comment without scanning pages (desktop=%s, root=%s)",
  async (desktop, rootId) => {
    const commentDetail = vi.fn().mockResolvedValue({
      id: 37,
      foodId: 71,
      rootId,
      authorName: "食友",
      text: "目标内容",
    });
    const app = { api: { commentDetail }, user: null } as unknown as AppState;
    await act(() =>
      root.render(
        <MemoryRouter
          initialEntries={[commentLikeLink("comment_like", "comments", 37)!]}
        >
          <QueryClientProvider client={cache}>
            <AppContext.Provider value={app}>
              <NotificationTarget desktop={desktop} />
            </AppContext.Provider>
          </QueryClientProvider>
        </MemoryRouter>,
      ),
    );
    await vi.waitFor(async () => {
      await act(() => Promise.resolve());
      expect(
        host.querySelector(".comments-focus .comments-text")?.textContent,
      ).toBe("目标内容");
    });
    expect(host.querySelector(".comments-focus .is-reply") !== null).toBe(
      !!rootId,
    );
    expect(commentDetail).toHaveBeenCalledWith(37, expect.any(AbortSignal));
  },
);

async function publish(reply = false, direct = false) {
  const command = vi
    .fn()
    .mockResolvedValue({ id: 9, moderationStatus: "APPROVED" });
  const app = {
    user: { id: 10, verified: true },
    session: { tokenName: "test", tokenValue: "token" },
    me: { isPending: false, isError: false },
    api: {
      food: vi.fn().mockResolvedValue({ id: 71, name: "招牌云吞" }),
      createFoodComment: command,
      replyToComment: command,
      foodComments: vi
        .fn()
        .mockResolvedValue({ items: [], totalItems: 0, hasNext: false }),
    },
    toast: vi.fn(),
  } as unknown as AppState;
  await act(async () =>
    root.render(
      <MemoryRouter
        initialEntries={[
          ...(direct ? [] : ["/foods/71", "/comments?foodId=71"]),
          ...(direct || reply
            ? [
                {
                  pathname: "/comments/write",
                  search: `?foodId=71${reply ? "&rootId=8&replyToId=8&name=食友" : ""}`,
                  state: direct ? null : { commentList: "/comments?foodId=71" },
                },
              ]
            : []),
        ]}
      >
        <QueryClientProvider client={cache}>
          <AppContext.Provider value={app}>
            <Screen />
          </AppContext.Provider>
        </QueryClientProvider>
      </MemoryRouter>,
    ),
  );
  if (!reply && !direct)
    await act(async () =>
      host.querySelector<HTMLButtonElement>(".comments-input-trigger")!.click(),
    );
  await act(async () => {
    const input = host.querySelector("textarea")!;
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(input, "好吃");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () =>
    host.querySelector<HTMLButtonElement>('button[type="submit"]')!.click(),
  );
  expect(command).toHaveBeenCalledTimes(1);
}

it.each([false, true])(
  "returns a submitted comment or reply to the same dish's comments (reply=%s)",
  async (reply) => {
    await publish(reply);
    expect(host.querySelector('[data-testid="location"]')!.textContent).toBe(
      "/comments?foodId=71",
    );
    expect(
      host
        .querySelector<HTMLAnchorElement>(".comments-back")!
        .getAttribute("href"),
    ).toBe("/foods/71");
    await act(async () =>
      host.querySelector<HTMLAnchorElement>(".comments-back")!.click(),
    );
    expect(host.querySelector('[data-testid="location"]')!.textContent).toBe(
      "/foods/71",
    );
  },
);

it("adds, switches and cancels a reaction from the mobile comment list", async () => {
  const setCommentReaction = vi
    .fn()
    .mockResolvedValueOnce([{ reaction: "HEART", count: 1, selected: true }])
    .mockResolvedValueOnce([{ reaction: "LAUGH", count: 1, selected: true }])
    .mockResolvedValueOnce([]);
  const app = {
    user: { id: 10, verified: true },
    session: { tokenName: "test", tokenValue: "token" },
    api: { setCommentReaction },
  } as unknown as AppState;
  cache.setQueryData(["comments", "list", 10, 71, "MOST_USEFUL", 1], {
    items: [{ id: 8, authorName: "食友", text: "好吃", reactions: [] }],
    totalItems: 1,
  });
  await act(() =>
    root.render(
      <MemoryRouter initialEntries={["/comments?foodId=71"]}>
        <QueryClientProvider client={cache}>
          <AppContext.Provider value={app}>
            <MobileComments />
          </AppContext.Provider>
        </QueryClientProvider>
      </MemoryRouter>,
    ),
  );
  const button = (label: string) =>
    host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
  const respond = async (label: string) => {
    await act(async () => button(label).click());
    // TanStack Query batches the list update outside the event handler.
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  };
  await act(() => button("表情回应").click());
  await respond("喜欢");
  expect(button("喜欢，1 人回应").getAttribute("aria-pressed")).toBe("true");
  expect(button("表情回应").getAttribute("aria-expanded")).toBe("false");

  await act(() => button("表情回应").click());
  await respond("笑哭");
  expect(button("喜欢，1 人回应")).toBeNull();
  expect(button("笑哭，1 人回应").getAttribute("aria-pressed")).toBe("true");

  await respond("笑哭，1 人回应");
  expect(button("笑哭，1 人回应")).toBeNull();
  expect(setCommentReaction.mock.calls).toEqual([
    [8, "HEART", true],
    [8, "LAUGH", true],
    [8, "LAUGH", false],
  ]);
});

it("returns to the dish with one browser back after publishing", async () => {
  await publish();
  await act(async () =>
    host
      .querySelector<HTMLButtonElement>('[data-testid="history-back"]')!
      .click(),
  );
  expect(host.querySelector('[data-testid="location"]')!.textContent).toBe(
    "/foods/71",
  );
});

it("uses the dish's comment list when the composer was opened directly", async () => {
  await publish(false, true);
  expect(host.querySelector('[data-testid="location"]')!.textContent).toBe(
    "/comments?foodId=71",
  );
  expect(
    host
      .querySelector<HTMLAnchorElement>(".comments-back")!
      .getAttribute("href"),
  ).toBe("/foods/71");
});
