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

let host: HTMLDivElement;
let root: Root;
let requests: string[];
let following = false;
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
  likes: 12,
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

async function render(path: string) {
  await act(async () =>
    root.render(
      <AppProvider>
        <MemoryRouter initialEntries={[path]}>
          <AreaProvider>
            <MobileContext.Provider value={mobile}>
              <LoginDialogProvider>
                <VerificationDialogProvider>
                  <CacheProbe />
                  <DesktopUser />
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
      if (path.endsWith("/user/userInfo"))
        return Promise.resolve(ok(friend({ isFollowingHim: following })));
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
  expect(host.querySelector(".pc-friend-follow")?.textContent).toBe(
    "关注这位食友",
  );
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

it("opens the own public page in edit mode", async () => {
  await render("/users/11");
  await spin(() => !!host.querySelector(".profile-overview-hero"));

  expect(host.querySelector(".pc-friend-follow")).toBeNull();
  expect(host.querySelector(".profile-overview-edit")?.textContent).toContain(
    "编辑资料",
  );
  expect(host.textContent).toContain("我的公开主页");
});
