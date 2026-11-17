// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppContext, type AppState } from "../../app/state";
import { createApi } from "../../api/service";
import { bridgeToV2 } from "../../api/v2-bridge";
import type { V2Schema } from "../../api/backend-v2";
import { FoodCommentPreview, FoodDiscussion, MobileComments } from "./Comments";

vi.mock("../../app/runtime", () => ({
  isDemo: false,
  sessionSignal: () => new AbortController().signal,
}));
vi.mock("../access", () => ({ useActionAccess: () => () => true }));
vi.mock("../../app/area", () => ({ useArea: () => ({ campusId: 1 }) }));

let host: HTMLDivElement, root: Root, cache: QueryClient;
let author: V2Schema["Comment"]["author"];
let replyAuthor: V2Schema["Comment"]["author"];
type Surface = "desktop" | "mobile" | "preview";
const avatar = "https://cdn.example.com/avatar/foodie.webp";
const replyAvatar = "https://cdn.example.com/avatar/reply.webp";
const locationText = () =>
  host.querySelector('[data-testid="location"]')?.textContent;

function Screen({ surface }: { surface: Surface }) {
  const location = useLocation(),
    navigate = useNavigate();
  return (
    <>
      <output data-testid="location">
        {location.pathname + location.search}
      </output>
      {!location.pathname.startsWith("/users/") &&
        (surface === "preview" ? (
          <FoodCommentPreview foodId={71} />
        ) : surface === "mobile" ? (
          <MobileComments />
        ) : (
          <FoodDiscussion food={{ id: 71, name: "招牌云吞" }} />
        ))}
      <button data-testid="back" onClick={() => navigate(-1)}>
        返回
      </button>
    </>
  );
}

async function render(surface: Surface) {
  const api = createApi(
    bridgeToV2(async (path) => ({
      code: 0,
      data: {
        items: [
          {
            id: path.endsWith("/replies") ? 9 : 8,
            foodId: 71,
            rootId: path.endsWith("/replies") ? 8 : null,
            author: path.endsWith("/replies") ? replyAuthor : author,
            text: "口味不错",
            createdAt: 1794888000000,
          },
        ],
        totalItems: 1,
        hasNext: false,
      },
    })),
  );
  const app = { api, session: null, toast: vi.fn() } as unknown as AppState;
  await act(async () =>
    root.render(
      <MemoryRouter
        initialEntries={[
          surface === "mobile" ? "/comments?foodId=71" : "/foods/71",
        ]}
      >
        <QueryClientProvider client={cache}>
          <AppContext.Provider value={app}>
            <Screen surface={surface} />
          </AppContext.Provider>
        </QueryClientProvider>
      </MemoryRouter>,
    ),
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  sessionStorage.clear();
  author = { id: 21, displayName: "小山", avatar, title: "美食家" };
  replyAuthor = { id: 22, displayName: "食友", avatar: replyAvatar };
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

it.each<Surface>(["desktop", "mobile", "preview"])(
  "shows the author's avatar and opens their profile from avatar or name (%s)",
  async (surface) => {
    await render(surface);
    expect(
      host.querySelector(".comments-avatar img")?.getAttribute("src"),
    ).toBe(avatar);
    const links = host.querySelectorAll<HTMLAnchorElement>(
      'a[href="/users/21"]',
    );
    expect(links).toHaveLength(2);
    for (let i = 0; i < 2; i++) {
      await act(async () =>
        host
          .querySelectorAll<HTMLAnchorElement>('a[href="/users/21"]')
          [i].click(),
      );
      expect(locationText()).toBe("/users/21");
      await act(async () =>
        host.querySelector<HTMLButtonElement>('[data-testid="back"]')!.click(),
      );
      expect(locationText()).toBe(
        surface === "mobile" ? "/comments?foodId=71" : "/foods/71",
      );
    }
    expect(host.querySelector("a a")).toBeNull();
  },
);

it("shows a reply's own avatar and opens the reply author's profile", async () => {
  await render("mobile");
  const expand = [...host.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("查看回复"),
  )!;
  await act(async () => expand.click());
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  const reply = host.querySelector(".comments-row.is-reply")!;
  expect(reply.querySelector(".comments-avatar img")?.getAttribute("src")).toBe(
    replyAvatar,
  );
  expect(reply.querySelectorAll('a[href="/users/22"]')).toHaveLength(2);
  await act(async () =>
    reply.querySelector<HTMLAnchorElement>('a[href="/users/22"]')!.click(),
  );
  expect(locationText()).toBe("/users/22");
});

it.each<Surface>(["mobile", "preview"])(
  "keeps a missing avatar's initial linked to the profile (%s)",
  async (surface) => {
    author = { id: 21, displayName: "🍜食友" };
    await render(surface);
    const initial = host.querySelector(".comments-avatar")!;
    expect(initial.textContent).toBe("🍜");
    expect(initial.querySelector("img")).toBeNull();
    expect(initial.closest("a")?.getAttribute("href")).toBe("/users/21");
  },
);

it("falls back to the initial when the avatar fails to load", async () => {
  await render("mobile");
  const image = host.querySelector(".comments-avatar img");
  expect(image).not.toBeNull();
  await act(async () => image!.dispatchEvent(new Event("error")));
  expect(host.querySelector(".comments-avatar img")).toBeNull();
  expect(host.querySelector(".comments-avatar")?.textContent).toBe("小");
  expect(
    host.querySelector(".comments-avatar")?.closest("a")?.getAttribute("href"),
  ).toBe("/users/21");
});

it.each([undefined, { id: 0, displayName: "已注销用户" }])(
  "does not link an unavailable author to an invalid profile (%j)",
  async (value) => {
    author = value;
    await render("mobile");
    expect(host.querySelectorAll('a[href^="/users/"]')).toHaveLength(0);
    expect(host.querySelector(".comments-avatar")?.textContent).toBe(
      value ? "已" : "匿",
    );
  },
);

it("keeps preview comment text linked to the dish's discussion", async () => {
  await render("preview");
  const text = [...host.querySelectorAll("a")].find(
    (a) => a.textContent === "口味不错",
  )!;
  expect(text).toBeTruthy();
  await act(async () => text.click());
  expect(locationText()).toBe("/comments?foodId=71");
});
