// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppProvider } from "../app/context";
import { LoginDialogProvider } from "../app/auth-dialog";
import { AreaProvider } from "../app/area";
import { VerificationDialogProvider } from "../app/verification-dialog";
import { MobileContext, type MobileState } from "../mobile/ui";
import { writeSession } from "../app/runtime";
import { DesktopUser } from "./DesktopCommunity";
import { ProfilePeopleDialog } from "../features/ProfilePeople";

let host: HTMLDivElement;
let root: Root;
let requests: string[];
let following = false;
let liked = false;
let cache: ReturnType<typeof useQueryClient> | null = null;
function CacheProbe() {
  cache = useQueryClient();
  return null;
}

const ok = (data: unknown) => new Response(JSON.stringify({ code: 0, data }));

const dish = (id: number, name: string, price: number) => ({
  id,
  name,
  price,
  accountId: 21,
  isLiked: id === 1 && liked,
  likeCount: 12 + Number(id === 1 && liked),
  restaurantName: "哀记云饺",
  pictureUrl: ["/prototype/assets/dishes/yangzhi.svg"],
  stageColor: "stage-1",
});

function friend(overrides: Record<string, unknown> = {}) {
  return {
    id: 21,
    displayName: "阿圆不想早八",
    avatar: null,
    level: 3,
    earnedLikes: 96,
    fansCount: 3,
    followingsCount: 6,
    fansVisible: true,
    followingsVisible: true,
    isFollowingMe: false,
    isFollowingHim: false,
    uploadedFoodsCount: 2,
    uploadedRestaurantsCount: 1,
    ...overrides,
  };
}

async function spin(condition: () => boolean) {
  for (let i = 0; i < 70 && !condition(); i++)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  expect(condition(), "test setup condition").toBe(true);
}

const noop = () => {};
const mobile = {
  foodId: null,
  shopId: null,
  setFoodId: noop,
  setShopId: noop,
  panel: null,
  openPanel: noop,
  closePanel: noop,
  notice: noop,
  confirm: noop,
  go: noop,
  setTagId: noop,
  meal: "晚饭",
  mealAuto: true,
  mealKey: "auto:dinner",
  setMeal: noop,
  setMealAuto: noop,
  noteServedMeal: noop,
  scene: "dine_in",
  setScene: noop,
} as unknown as MobileState;

async function render(path: string, view = <DesktopUser />) {
  await act(async () =>
    root.render(
      <AppProvider>
        <MemoryRouter initialEntries={[path]}>
          <AreaProvider>
            <MobileContext.Provider value={mobile}>
              <LoginDialogProvider>
                <VerificationDialogProvider>
                  <CacheProbe />
                  {view}
                </VerificationDialogProvider>
              </LoginDialogProvider>
            </MobileContext.Provider>
          </AreaProvider>
        </MemoryRouter>
      </AppProvider>,
    ),
  );
}

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  sessionStorage.clear();
  writeSession({ tokenName: "satoken", tokenValue: "friend-page" });
  requests = [];
  following = false;
  liked = false;
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const path = url.split("?")[0];
      requests.push(`${init?.method ?? "GET"} ${path}`);
      if (path.endsWith("/user/info"))
        return Promise.resolve(
          ok({ id: 11, displayName: "我自己", verified: true, banned: false }),
        );
      if (path.endsWith("/user/follow")) {
        following = true;
        return Promise.resolve(ok(null));
      }
      if (path.endsWith("/user/unfollow")) {
        following = false;
        return Promise.resolve(ok(null));
      }
      if (path.endsWith("/foods/1/like") || path.endsWith("/foods/1/unlike")) {
        liked = path.endsWith("/like");
        return Promise.resolve(ok(null));
      }
      if (path.endsWith("/user/userInfo"))
        return Promise.resolve(
          ok(friend({ isFollowingHim: following, earnedLikes: 96 + Number(liked) })),
        );
      if (path.endsWith("/foods/by-user/11"))
        return Promise.resolve(
          ok({
            items: [dish(1, "鲜虾蟹籽云吞", 18), dish(2, "玉米鲜肉饺子", 16)],
            hasNext: false,
            totalItems: 2,
          }),
        );
      if (path.endsWith("/foods/by-user/21"))
        return Promise.resolve(
          ok({
            items: [dish(1, "鲜虾蟹籽云吞", 18), dish(2, "玉米鲜肉饺子", 16)],
            hasNext: false,
            totalItems: 2,
          }),
        );
      if (path.endsWith("/user/blocks/21"))
        return Promise.resolve(ok({ blocked: false }));
      if (path.endsWith("/campus/list")) return Promise.resolve(ok([]));
      return Promise.resolve(ok({ items: [], hasNext: false }));
    }),
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => {
    cache?.clear();
    cache = null;
  });
  await act(async () => root.unmount());
  host.remove();
  writeSession(null);
  vi.unstubAllGlobals();
});

it("renders a friend page on the profile-space shell", async () => {
  await render("/users/21");
  await spin(() => !!host.querySelector(".profile-overview-dish-card"));

  expect(host.querySelector(".pc-profile-space.pc-friend-space")).toBeTruthy();
  expect(host.querySelector(".pc-secondary-user")).toBeNull();
  expect(host.querySelector("#friend-profile-name")?.textContent).toBe(
    "阿圆不想早八",
  );
  expect(host.querySelector(".profile-overview-hero")).toBeTruthy();
  expect(host.querySelector(".profile-overview-cover")).toBeTruthy();
  expect(host.querySelectorAll(".profile-overview-dish-card")).toHaveLength(2);
  expect(host.querySelector(".pc-friend-follow")?.textContent).toBe("关注");
  expect(host.querySelector(".pc-friend-record")?.textContent).toContain(
    "分享了 2 道菜",
  );
  const relations = [...host.querySelectorAll(".pc-friend-relation")].map(
    (row) => row.getAttribute("href"),
  );
  expect(relations).toEqual([
    "/users/21?people=fans",
    "/users/21?people=follow",
  ]);
  expect(host.querySelector(".pc-friend-shares .ew-food-manage")).toBeNull();
});

it("keeps both share lists and the profile total in sync when liking a dish", async () => {
  await render("/users/21");
  const selector = 'button[aria-label$="鲜虾蟹籽云吞"]';
  await spin(() => host.querySelectorAll(selector).length === 2);
  const buttons = [...host.querySelectorAll<HTMLButtonElement>(selector)];
  const total = host.querySelector(".profile-overview-social strong");
  const showsLike = (pressed: boolean, count: number) => buttons.every(
    (button) => !button.disabled &&
      button.getAttribute("aria-pressed") === String(pressed) &&
      button.textContent === String(count),
  );
  expect(buttons.every((button) => !button.closest("a"))).toBe(true);
  await act(async () => buttons[0].click());
  await spin(() => showsLike(true, 13) && total?.textContent === "97");
  await act(async () => buttons[1].click());
  await spin(() => showsLike(false, 12) && total?.textContent === "96");
  const writes = requests.filter((request) => request.startsWith("POST /api/foods/"));
  expect(writes).toEqual(["POST /api/foods/1/like", "POST /api/foods/1/unlike"]);
});

it("shows the empty share state for a friend without dishes", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const path = String(input).split("?")[0];
      if (path.endsWith("/user/info"))
        return Promise.resolve(
          ok({ id: 11, displayName: "我自己", verified: true, banned: false }),
        );
      if (path.endsWith("/user/userInfo"))
        return Promise.resolve(ok(friend({ uploadedFoodsCount: 0 })));
      if (path.endsWith("/user/blocks/21"))
        return Promise.resolve(ok({ blocked: false }));
      if (path.endsWith("/campus/list")) return Promise.resolve(ok([]));
      return Promise.resolve(ok({ items: [], hasNext: false }));
    }),
  );
  await render("/users/21");
  await spin(() =>
    Array.from(host.querySelectorAll("h2")).some((heading) =>
      heading.textContent?.startsWith("最近分享"),
    ),
  );

  const heading = Array.from(host.querySelectorAll("h2")).find((h) =>
    h.textContent?.startsWith("最近分享"),
  );
  expect(heading?.textContent).toBe("最近分享");
  expect(host.querySelector(".profile-overview-dish-card")).toBeNull();
  expect(host.textContent).toContain("TA 还没有分享");
  expect(host.querySelector(".profile-overview-cover")).toBeTruthy();
});

it("follows the friend from the hero actions", async () => {
  await render("/users/21");
  await spin(() => !!host.querySelector(".pc-friend-follow"));
  const button = host.querySelector<HTMLButtonElement>(".pc-friend-follow")!;
  await act(async () => button.click());
  await spin(() => button.textContent === "已关注");

  expect(button.className).toContain("is-following");
  expect(requests).toContain("POST /api/user/follow");
});

it("uses the viewer's relationships on another profile and refreshes the row after a follow-back", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = true;
    },
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  const fetchOther = globalThis.fetch;
  let followed = false;
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), "http://localhost");
      if (url.pathname.endsWith("/user/followers")) {
        expect(url.searchParams.get("userId")).toBe("21");
        return ok({
          items: [
            {
              id: 22,
              displayName: "小林",
              isFollowingHim: followed,
              isFollowingMe: true,
            },
            {
              id: 23,
              displayName: "阿圆",
              isFollowingHim: false,
              isFollowingMe: false,
            },
            { id: 24, displayName: "旧资料" },
            {
              id: 11,
              displayName: "我自己",
              isFollowingHim: false,
              isFollowingMe: false,
            },
          ],
        });
      }
      if (
        url.pathname.endsWith("/user/follow") ||
        url.pathname.endsWith("/user/unfollow")
      ) {
        expect(init?.method).toBe("POST");
        expect(url.searchParams.get("userId")).toBe("22");
        followed = url.pathname.endsWith("/follow");
        return ok(null);
      }
      return fetchOther(input, init);
    },
  );
  await render("/users/21?people=fans", <ProfilePeopleDialog />);
  const panel = () => document.querySelector('[aria-label="粉丝列表"]');
  const buttons = () => [...(panel()?.querySelectorAll("button") ?? [])];
  await spin(() => buttons().length === 2);
  expect(buttons().map((b) => b.textContent)).toEqual(["回关", "关注"]);
  expect(
    panel()
      ?.querySelector('a[aria-label="查看旧资料的主页"]')
      ?.getAttribute("href"),
  ).toBe("/users/24");
  expect(
    panel()
      ?.querySelector('a[aria-label="查看我自己的主页"]')
      ?.getAttribute("href"),
  ).toBe("/me");
  await act(async () => buttons()[0].click());
  await spin(() => buttons()[0]?.textContent === "已互关");
  expect(buttons()[0].getAttribute("aria-pressed")).toBe("true");
  await act(async () => buttons()[0].click());
  await spin(() => buttons()[0]?.textContent === "回关");
});

it("opens the own public page in edit mode", async () => {
  await render("/users/11");
  await spin(() => !!host.querySelector(".profile-overview-hero"));

  expect(host.querySelector(".pc-friend-follow")).toBeNull();
  expect(host.querySelector(".profile-overview-edit")?.textContent).toContain(
    "编辑资料",
  );
  expect(host.textContent).toContain("我的公开主页");
  // 自己的公开主页也要能直接管理菜品。
  expect(host.querySelector(".pc-friend-shares .ew-food-manage")).toBeTruthy();
});

it("asks for a retry when the share list fails instead of claiming it is empty", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const path = String(input).split("?")[0];
      if (path.endsWith("/user/info"))
        return Promise.resolve(
          ok({ id: 11, displayName: "我自己", verified: true, banned: false }),
        );
      if (path.endsWith("/user/userInfo")) return Promise.resolve(ok(friend()));
      if (path.endsWith("/foods/by-user/21"))
        return Promise.resolve(
          new Response(JSON.stringify({ code: 500, msg: "boom" }), {
            status: 500,
          }),
        );
      if (path.endsWith("/user/blocks/21"))
        return Promise.resolve(ok({ blocked: false }));
      if (path.endsWith("/campus/list")) return Promise.resolve(ok([]));
      return Promise.resolve(ok({ items: [], hasNext: false }));
    }),
  );
  await render("/users/21");
  await spin(() => host.textContent?.includes("分享暂时没有加载出来") ?? false);

  expect(host.textContent).toContain("分享暂时没有加载出来");
  expect(host.textContent).not.toContain("TA 还没有分享");
  const retry = Array.from(host.querySelectorAll("button")).find((button) =>
    button.textContent?.includes("重新加载"),
  );
  expect(retry).toBeTruthy();
});
