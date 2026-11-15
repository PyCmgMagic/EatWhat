// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppContext, type AppState } from "../../app/state";
import { MobileComments } from "./Comments";

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
