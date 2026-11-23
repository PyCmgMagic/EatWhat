// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
vi.mock("../features/access", () => ({ useActionAccess: () => () => true }));
import { AppProvider } from "../app/context";
import { AreaProvider } from "../app/area";
import { useApp } from "../app/state";
import { writeSession } from "../app/runtime";
import { useDesignBridge } from "./bridge";
import { MobileContext, type Draft, type MobileState } from "./ui";
import type { Bridge, Controller, Values } from "./types";
import { PrivateImages } from "../features/v4/Community";
import * as photos from "./photos";

let host: HTMLDivElement, root: Root, cache: QueryClient;
let creates: number;
const ok = (data: unknown) => new Response(JSON.stringify({ code: 0, data }));
const account = {
  id: 11,
  displayName: "食友甲",
  verified: true,
  banned: false,
};
const noop = () => {};
function BridgeScreen() {
  const controller = {
    state: { cat: 0, desc: "说明" },
    setState: noop,
  } as unknown as Controller;
  const bridge = useDesignBridge("G-AddDish", controller, { cats: [] }, false);
  const props: Record<string, any> = {
    href: "G-Dish.dc.html",
    "data-testid": "publish",
  };
  const publishControl = bridge.node({
    screen: "G-AddDish",
    node: { id: -1, tag: "a", attrs: {}, children: [] },
    props,
    children: [],
    scope: {},
    text: "发布",
  });
  return (
    <>
      {publishControl ?? <a {...props}>发布</a>}
      {bridge.after}
      <output data-busy={String(bridge.busy)} />
    </>
  );
}
function BridgeDraftHost() {
  const [version, setVersion] = useState(0);
  const [draft, setDraft] = useState<Draft>({
    name: "测试菜品",
    price: "10",
    category: "staple",
    description: "说明",
    tags: [],
    stage: "#F3C46E",
    images: [
      {
        file: new File(["image"], "review.png", { type: "image/png" }),
        url: "https://private.invalid/example.png",
        key: "foods/already-uploaded",
      },
    ],
  });
  const mobile = {
    foodId: 1,
    shopId: 7,
    setFoodId: noop,
    setShopId: noop,
    panel: null,
    openPanel: noop,
    closePanel: noop,
    notice: noop,
    confirm: noop,
    go: noop,
    draft,
    setDraft: (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch })),
    setTagId: noop,
    meal: "晚饭",
    mealAuto: true,
    mealKey: "auto:dinner",
    setMeal: noop,
    setMealAuto: noop,
    noteServedMeal: noop,
    scene: "dine_in",
    setScene: noop,
  } as MobileState;
  return (
    <MobileContext.Provider value={mobile}>
      <BridgeScreen key={version} />
      <button data-testid="remount" onClick={() => setVersion((v) => v + 1)}>
        离开后返回发布页
      </button>
    </MobileContext.Provider>
  );
}
function ImageHost() {
  const [revision, setRevision] = useState("revision-A");
  const [admin, setAdmin] = useState(false);
  return (
    <>
      <PrivateImages revisionId={revision} count={1} admin={admin} />
      <output data-testid="revision">{revision}</output>
      <button data-testid="switch" onClick={() => setRevision("revision-B")}>
        切换审核记录
      </button>
      <button data-testid="admin" onClick={() => setAdmin(true)}>
        切换管理视图
      </button>
    </>
  );
}
function PhotoWorkflowHost() {
  const location = useLocation();
  const [draft, setDraft] = useState<Draft>({
    name: "测试菜品",
    price: "",
    category: "staple",
    description: "",
    images: [],
    stage: "#F3C46E",
    tags: [],
  });
  const [state, setState] = useState({
    cat: 0,
    desc: "",
    ox: 0,
    oy: 0,
    zoom: 1,
  });
  const controller = {
    state,
    setState: (patch: object) =>
      setState((current) => ({ ...current, ...patch })),
  } as unknown as Controller;
  const mobile = {
    foodId: 1,
    shopId: 7,
    draft,
    setDraft: (patch: Partial<Draft>) =>
      setDraft((current) => ({ ...current, ...patch })),
    panel: null,
    notice: noop,
    setFoodId: noop,
    setShopId: noop,
    openPanel: noop,
    closePanel: noop,
  } as unknown as MobileState;
  return (
    <MobileContext.Provider value={mobile}>
      <PhotoWorkflowScreen
        controller={controller}
        crop={location.pathname === "/publish/crop"}
      />
      <output data-testid="photo-count">{draft.images.length}</output>
      <output data-testid="photo-pending">{String(!!draft.photoEdit)}</output>
      <output data-testid="photo-route">{location.pathname}</output>
    </MobileContext.Provider>
  );
}
function PhotoWorkflowScreen({
  controller,
  crop,
}: {
  controller: Controller;
  crop: boolean;
}) {
  const screen = crop ? "G-Crop" : "G-AddDish";
  const bridge = useDesignBridge(screen, controller, { cats: [] }, false);
  if (crop)
    return bridge.node({
      screen,
      node: { id: 1, tag: "div", attrs: {}, children: [] },
      props: {},
      children: [],
      text: "",
      scope: {},
    });
  return (
    <>
      {bridge.node({
        screen,
        node: { id: 19, tag: "div", attrs: {}, children: [] },
        props: {},
        children: [null, null],
        text: "",
        scope: {},
      })}
    </>
  );
}
function Harness({ page }: { page: "publish" | "image" | "photo" }) {
  const app = useApp();
  cache = useQueryClient();
  return app.user ? (
    page === "photo" ? (
      <PhotoWorkflowHost />
    ) : page === "publish" ? (
      <BridgeDraftHost />
    ) : (
      <ImageHost />
    )
  ) : null;
}
async function spin(condition: () => boolean) {
  for (let i = 0; i < 70 && !condition(); i++)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  expect(condition(), "test setup condition").toBe(true);
}
async function click(selector: string) {
  await act(async () => host.querySelector<HTMLElement>(selector)!.click());
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "URL",
    class extends URL {
      static revokeObjectURL = vi.fn();
    },
  );
  localStorage.clear();
  sessionStorage.clear();
  writeSession(null);
  writeSession({ tokenName: "satoken", tokenValue: "review-account" });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  creates = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const path = String(url).split("?")[0];
      if (path.endsWith("/user/info")) return ok(account);
      if (path.endsWith("/foods/tags/system")) return ok([]);
      if (path.endsWith("/campus/list"))
        return ok([
          {
            id: 1,
            name: "软件园",
            gcjLng: 117.140109,
            gcjLat: 36.667382,
            isDefault: true,
          },
        ]);
      if (path.endsWith("/recommend"))
        return ok({
          items: [
            {
              id: 201,
              name: "测试店一",
              signatureFoods: [
                { id: 101, name: "测试菜一", category: "staple" },
              ],
            },
            {
              id: 202,
              name: "测试店二",
              signatureFoods: [
                { id: 102, name: "测试菜二", category: "staple" },
              ],
            },
          ],
          hasNext: false,
        });
      if (path.endsWith("/foods/upload")) {
        creates++;
        throw new TypeError("simulated response loss after server acceptance");
      }
      if (path.endsWith("/images/0"))
        return ok({
          url: `https://private.invalid/${path.includes("revision-B") ? "revision-B" : "revision-A"}.png`,
          expiresInSeconds: 300,
        });
      if (path.includes("/restaurant/detail/"))
        return ok({ id: 7, name: "测试店铺" });
      return ok({ items: [], hasNext: false });
    }),
  );
});
afterEach(async () => {
  await act(async () => {
    root.unmount();
    cache?.clear();
    writeSession(null);
  });
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function renderPhotoWorkflow() {
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => `blob:photo-${crypto.randomUUID()}`),
  });
  const image = new File(["photo"], "photo.jpg", { type: "image/jpeg" });
  vi.spyOn(photos, "recommendPhotoStage").mockResolvedValue(["#F3C46E"]);
  vi.spyOn(photos, "adjustPhoto").mockResolvedValue({
    file: image,
    colors: ["#F3C46E"],
  });
  const click = HTMLInputElement.prototype.click;
  const openPicker = vi
    .spyOn(HTMLInputElement.prototype, "click")
    .mockImplementation(function (this: HTMLInputElement) {
      if (this.type !== "file") return click.call(this);
      Object.defineProperty(this, "files", { value: [image], configurable: true });
      this.dispatchEvent(new Event("change", { bubbles: true }));
    });
  await act(async () =>
    root.render(
      <AppProvider>
        <MemoryRouter initialEntries={["/publish/dish"]}>
          <Harness page="photo" />
        </MemoryRouter>
      </AppProvider>,
    ),
  );
  await spin(() => !!host.querySelector('[aria-label="添加菜品照片"]'));
  return openPicker;
}

it("can reopen the camera without a picker event and recover from a photo read error", async () => {
  const openPicker = await renderPhotoWorkflow();
  openPicker.mockImplementationOnce(() => {});
  const addPhoto = '[aria-label="添加菜品照片"]';

  await click(addPhoto);
  expect(openPicker).toHaveBeenCalledTimes(1);
  expect(host.textContent).not.toContain("正在处理照片");
  expect(photos.recommendPhotoStage).not.toHaveBeenCalled();

  let failRead!: (error: Error) => void;
  vi.mocked(photos.recommendPhotoStage).mockReturnValueOnce(
    new Promise((_, reject) => {
      failRead = reject;
    }),
  );
  await click(addPhoto);
  expect(openPicker).toHaveBeenCalledTimes(2);
  expect(openPicker.mock.contexts[1]).toBe(
    host.querySelector('input[type="file"]'),
  );
  expect(host.querySelector(".mobile-publish-photo-status")?.textContent).toBe(
    "正在处理照片…",
  );
  expect(host.querySelector<HTMLButtonElement>(addPhoto)?.disabled).toBe(true);

  await act(async () => failRead(new Error("照片读取失败")));
  expect(host.textContent).not.toContain("正在处理照片");
  expect(host.querySelector<HTMLButtonElement>(addPhoto)?.disabled).toBe(false);

  await click(addPhoto);
  expect(host.querySelector('[data-testid="photo-route"]')?.textContent).toBe(
    "/publish/crop",
  );
});

it("discards a cancelled new photo instead of adding it to the publishing draft", async () => {
  await renderPhotoWorkflow();
  await click('[aria-label="添加菜品照片"]');
  await spin(
    () =>
      host.querySelector('[data-testid="photo-route"]')?.textContent ===
      "/publish/crop",
  );
  expect(host.querySelector('[data-testid="photo-count"]')?.textContent).toBe(
    "0",
  );
  await click(".mobile-crop-cancel");
  expect(host.querySelector('[data-testid="photo-route"]')?.textContent).toBe(
    "/publish/dish",
  );
  expect(host.querySelector('[data-testid="photo-count"]')?.textContent).toBe(
    "0",
  );
  expect(host.querySelector('[data-testid="photo-pending"]')?.textContent).toBe(
    "false",
  );
});

it("edits a thumbnail without deleting it and deletes only through its separate remove button", async () => {
  await renderPhotoWorkflow();
  await click('[aria-label="添加菜品照片"]');
  await spin(() => !!host.querySelector('img[alt="所选照片"]'));
  const image = host.querySelector<HTMLImageElement>('img[alt="所选照片"]')!;
  Object.defineProperties(image, {
    naturalWidth: { value: 800 },
    naturalHeight: { value: 600 },
  });
  await act(async () => image.dispatchEvent(new Event("load")));
  await click(".mobile-crop-done");
  await spin(() => !!host.querySelector('[aria-label="编辑第 1 张照片"]'));
  const original = host
    .querySelector(".mobile-publish-photo img")
    ?.getAttribute("src");
  await click('[aria-label="编辑第 1 张照片"]');
  await spin(() => !!host.querySelector(".mobile-crop-cancel"));
  expect(host.querySelector('[data-testid="photo-count"]')?.textContent).toBe(
    "1",
  );
  await click(".mobile-crop-cancel");
  await spin(() => !!host.querySelector('[aria-label="移除第 1 张照片"]'));
  expect(
    host.querySelector(".mobile-publish-photo img")?.getAttribute("src"),
  ).toBe(original);
  expect(host.querySelector("button button")).toBeNull();
  await click('[aria-label="移除第 1 张照片"]');
  expect(host.querySelector('[data-testid="photo-count"]')?.textContent).toBe(
    "0",
  );
  expect(host.querySelector('[data-testid="photo-route"]')?.textContent).toBe(
    "/publish/dish",
  );
});
it("retains the uncertain mobile submission guard when the editor remounts", async () => {
  await act(async () =>
    root.render(
      <AppProvider>
        <MemoryRouter initialEntries={["/publish/dish"]}>
          <Harness page="publish" />
        </MemoryRouter>
      </AppProvider>,
    ),
  );
  await spin(() => !!host.querySelector('[data-testid="publish"]'));
  await click('[data-testid="publish"]');
  await spin(
    () => creates === 1 && !!host.querySelector('[data-busy="false"]'),
  );
  await click('[data-testid="remount"]');
  await click('[data-testid="publish"]');
  expect(creates).toBe(1);
});
// Backend v2 publishes without review; there are no submission revisions.
it.skip("clears private images when switching to another submission revision", async () => {
  await act(async () =>
    root.render(
      <AppProvider>
        <MemoryRouter>
          <Harness page="image" />
        </MemoryRouter>
      </AppProvider>,
    ),
  );
  await spin(() => !!host.querySelector('[data-testid="switch"]'));
  await click(".v4-actions button");
  await spin(() => !!host.querySelector("img"));
  await click('[data-testid="switch"]');
  expect(host.querySelector('[data-testid="revision"]')!.textContent).toBe(
    "revision-B",
  );
  expect(host.querySelector("img")).toBeNull();
});

it("keeps the publishing lock across editor remounts until the request completes", async () => {
  const original = fetch;
  let finish!: (value: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      if (String(url).endsWith("/foods/upload")) {
        creates++;
        return new Promise<Response>((resolve) => {
          finish = resolve;
        });
      }
      return original(url, init);
    }),
  );
  await act(async () =>
    root.render(
      <AppProvider>
        <MemoryRouter initialEntries={["/publish/dish"]}>
          <Harness page="publish" />
        </MemoryRouter>
      </AppProvider>,
    ),
  );
  await spin(() => !!host.querySelector('[data-testid="publish"]'));
  await click('[data-testid="publish"]');
  await spin(() => creates === 1);
  await click('[data-testid="remount"]');
  expect(host.querySelector('[data-busy="true"]')).not.toBeNull();
  await click('[data-testid="publish"]');
  expect(creates).toBe(1);
  await act(async () => {
    finish(ok({ id: 42 }));
  });
  await spin(() => !!host.querySelector('[data-busy="false"]'));
  expect(host.textContent).not.toContain("结果尚未确认");
});

// Backend v2 publishes without review; there are no submission revisions.
it.skip("does not insert a late image from the previous revision into the current one", async () => {
  const original = fetch;
  let finish!: (value: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) =>
      String(url).includes("revision-A/images/0")
        ? new Promise<Response>((resolve) => {
            finish = resolve;
          })
        : original(url, init),
    ),
  );
  await act(async () =>
    root.render(
      <AppProvider>
        <MemoryRouter>
          <Harness page="image" />
        </MemoryRouter>
      </AppProvider>,
    ),
  );
  await spin(() => !!host.querySelector('[data-testid="switch"]'));
  await click(".v4-actions button");
  await click('[data-testid="switch"]');
  await click(".v4-actions button");
  await spin(() => !!host.querySelector('img[src$="revision-B.png"]'));
  await act(async () => {
    finish(
      ok({
        url: "https://private.invalid/revision-A.png",
        expiresInSeconds: 300,
      }),
    );
  });
  expect(host.querySelectorAll("img")).toHaveLength(1);
  expect(host.querySelector('img[src$="revision-A.png"]')).toBeNull();
});

// Backend v2 publishes without review; there are no submission revisions.
it.skip("discards private images when switching the access mode for the same revision", async () => {
  await act(async () =>
    root.render(
      <AppProvider>
        <MemoryRouter>
          <Harness page="image" />
        </MemoryRouter>
      </AppProvider>,
    ),
  );
  await spin(() => !!host.querySelector('[data-testid="admin"]'));
  await click(".v4-actions button");
  await spin(() => !!host.querySelector("img"));
  await click('[data-testid="admin"]');
  expect(host.querySelector("img")).toBeNull();
});

let homeValues: Bridge | undefined;
function HomeBridgeContent() {
  const [state, setState] = useState<Values>({
    n: 0,
    drag: 0,
    dragging: false,
  });
  const controller = {
    state,
    setState: (patch: Values) =>
      setState((current) => ({ ...current, ...patch })),
    renderVals: () => ({}),
  } as unknown as Controller;
  homeValues = useDesignBridge(
    "G2-Home",
    controller,
    {
      next: () =>
        controller.setState({
          n: controller.state.n + 1,
          drag: 0,
          dragging: false,
        }),
      down: () => controller.setState({ dragging: true, drag: 0 }),
      move: noop,
      up: noop,
    },
    false,
  );
  const plates = homeValues.node({
    screen: "G2-Home",
    node: {
      id: -1,
      tag: "div",
      attrs: {},
      children: [{ id: -2, tag: "img", attrs: { style: "top: 570px" }, children: [] }],
    },
    props: {},
    children: [],
    scope: {},
    text: "",
  });
  return (
    <>
      {plates}
      <output data-testid="home-index">{state.n}</output>
    </>
  );
}
function HomeBridge() {
  const mobile = {
    foodId: 1,
    shopId: 7,
    draft: {},
    meal: "晚饭",
    mealAuto: true,
    mealKey: "auto:dinner",
    mealTime: "晚饭",
    scene: "dine_in",
    noteServedMeal: noop,
  } as unknown as MobileState;
  return (
    <MobileContext.Provider value={mobile}>
      <HomeBridgeContent />
    </MobileContext.Provider>
  );
}

it("advances the mobile carousel once per action without state updates on every pointer move", async () => {
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false })),
  );
  await act(async () =>
    root.render(
      <AppProvider>
        <MemoryRouter>
          <AreaProvider>
            <HomeBridge />
          </AreaProvider>
        </MemoryRouter>
      </AppProvider>,
    ),
  );
  await spin(() => homeValues?.values.dots?.length === 2);
  const requests = vi
    .mocked(fetch)
    .mock.calls.map(([url]) => new URL(String(url), "https://example.test"))
    .filter((url) => url.pathname.endsWith("/recommend"));
  // Like the real app, wait for the preset coordinates before consuming a batch.
  expect(requests).toHaveLength(1);
  expect(requests[0].searchParams.get("gcjLng")).toBe("117.140109");
  expect(requests[0].searchParams.get("gcjLat")).toBe("36.667382");
  expect(requests[0].searchParams.has("campusId")).toBe(false);
  await act(async () => homeValues!.values.next());
  expect(host.querySelector('[data-testid="home-index"]')!.textContent).toBe(
    "1",
  );
  const plate = host.querySelector('[data-orbit-offset="0"]')!;
  Object.defineProperty(plate, "offsetWidth", { value: 273 });
  const pointer = { button: 0, pointerId: 1, clientX: 100, clientY: 200 };
  await act(async () => homeValues!.values.down(pointer));
  await act(async () => {
    homeValues!.values.move({ ...pointer, clientX: 65 });
    homeValues!.values.move({ ...pointer, clientX: 50 });
  });
  expect(host.querySelector('[data-testid="home-index"]')!.textContent).toBe(
    "1",
  );
  await act(async () => homeValues!.values.up({ ...pointer, clientX: 50 }));
  expect(host.querySelector('[data-testid="home-index"]')!.textContent).toBe(
    "2",
  );
});

it("keeps selected category and description across G-AddDish remounts when submitting", async () => {
  let submittedBody: Record<string, unknown> | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = String(url).split("?")[0];
      if (path.endsWith("/user/info")) return ok(account);
      if (path.endsWith("/foods/tags/system")) return ok([]);
      if (path.includes("/restaurant/detail/"))
        return ok({ id: 7, name: "测试店铺" });
      if (path.endsWith("/foods/upload")) {
        submittedBody = JSON.parse(String(init?.body ?? "{}"));
        return ok({ id: 99 });
      }
      return ok({ items: [], hasNext: false });
    }),
  );
  function AddDishRemountHost() {
    const [version, setVersion] = useState(0);
    const [draft, setDraft] = useState<Draft>({
      name: "测试甜品",
      price: "12",
      category: "staple",
      description: "",
      tags: [],
      stage: "#F3C46E",
      images: [
        {
          file: new File(["image"], "dish.png", { type: "image/png" }),
          url: "https://private.invalid/dish.png",
          key: "foods/uploaded-dish",
        },
      ],
    });
    const mobile = {
      foodId: 1,
      shopId: 7,
      setFoodId: noop,
      setShopId: noop,
      panel: null,
      openPanel: noop,
      closePanel: noop,
      notice: noop,
      confirm: noop,
      go: noop,
      draft,
      setDraft: (patch: Partial<Draft>) =>
        setDraft((current) => ({ ...current, ...patch })),
      setTagId: noop,
      meal: "晚饭",
      mealAuto: true,
      mealKey: "auto:dinner",
      setMeal: noop,
      setMealAuto: noop,
      noteServedMeal: noop,
      scene: "dine_in",
      setScene: noop,
    } as MobileState;
    function AddDishBody() {
      const controller = {
        state: { cat: 0, desc: "" },
        setState: noop,
      } as unknown as Controller;
      const bridge = useDesignBridge(
        "G-AddDish",
        controller,
        { cats: [] },
        false,
      );
      const publishControl = bridge.node({
        screen: "G-AddDish",
        node: { id: -1, tag: "a", attrs: {}, children: [] },
        props: { href: "G-Dish.dc.html", "data-testid": "publish-remount" },
        children: [],
        scope: {},
        text: "发布",
      });
      return (
        <>
          <button
            data-testid="pick-soup"
            onClick={() => bridge.values.cats[3]?.pick()}
          >
            选汤品
          </button>
          <button
            data-testid="type-desc"
            onClick={() =>
              bridge.values.setDesc({ target: { value: "清甜解暑" } })
            }
          >
            写描述
          </button>
          {publishControl}
        </>
      );
    }
    return (
      <MobileContext.Provider value={mobile}>
        <AddDishBody key={version} />
        <button data-testid="remount-add" onClick={() => setVersion((v) => v + 1)}>
          裁图后返回
        </button>
      </MobileContext.Provider>
    );
  }
  await act(async () =>
    root.render(
      <AppProvider>
        <MemoryRouter>
          <AddDishRemountHost />
        </MemoryRouter>
      </AppProvider>,
    ),
  );
  await spin(() => Boolean(host.querySelector('[data-testid="pick-soup"]')));
  await act(async () => {
    host
      .querySelector<HTMLButtonElement>('[data-testid="pick-soup"]')!
      .click();
    host.querySelector<HTMLButtonElement>('[data-testid="type-desc"]')!.click();
  });
  await act(async () => {
    host
      .querySelector<HTMLButtonElement>('[data-testid="remount-add"]')!
      .click();
  });
  await act(async () => {
    host
      .querySelector<HTMLAnchorElement>('[data-testid="publish-remount"]')!
      .click();
  });
  await spin(() => Boolean(submittedBody));
  expect(submittedBody?.category).toBe("汤");
  expect(submittedBody?.description).toBe("清甜解暑");
});

it("opens the dish form with the tapped restaurant and keeps the new-shop entry accessible", async () => {
  writeSession({ tokenValue: "pick-token", tokenName: "satoken" });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/user/info") || url.includes("/user/userInfo"))
        return ok(account);
      if (url.includes("/campus") || url.includes("/hub")) return ok([]);
      if (/\/restaurant\/(browse|search)/.test(url))
        return ok({ items: [{ id: 1, name: "食堂" }], hasNext: true });
      return ok({});
    }),
  );

  function PickShopInner() {
    const location = useLocation();
    const controller = { state: {}, setState: noop } as unknown as Controller;
    const bridge = useDesignBridge("G-PickShop", controller, {}, false);
    return (
      <>
        {bridge.node({
          screen: "G-PickShop",
          node: { id: 1, tag: "div", attrs: {}, children: [] },
          props: {},
          children: [
            null,
            null,
            null,
            null,
            <div key="list">
              {bridge.values.rows.map((r: Values) => (
                <button key={r.id} onClick={r.pick}>
                  {r.name}
                </button>
              ))}
            </div>,
            <a key="new" href="/restaurants/new">
              新建一家店
            </a>,
            <a key="next" href="/publish/dish">
              下一步
            </a>,
          ],
          scope: {},
          text: "",
        })}
        <output>{location.pathname}</output>
      </>
    );
  }
  const setShopId = vi.fn(),
    setDraft = vi.fn();
  const mobile = {
    shopId: 7,
    setShopId,
    setDraft,
    draft: { tags: [], images: [] },
    noteServedMeal: noop,
    scene: "dine_in",
    mealKey: "auto:dinner",
  } as unknown as MobileState;
  await act(async () =>
    root.render(
      <AppProvider>
        <AreaProvider>
          <MemoryRouter initialEntries={["/publish"]}>
            <MobileContext.Provider value={mobile}>
              <PickShopInner />
            </MobileContext.Provider>
          </MemoryRouter>
        </AreaProvider>
      </AppProvider>,
    ),
  );
  await spin(() =>
    Boolean(host.querySelector(".mobile-pick-shop-body button")),
  );
  expect(host.querySelector('a[href="/restaurants/new"]')).not.toBeNull();
  expect(host.querySelector('a[href="/publish/dish"]')).toBeNull();
  await act(async () =>
    host
      .querySelector<HTMLButtonElement>(".mobile-pick-shop-body button")!
      .click(),
  );
  expect(setShopId).toHaveBeenCalledWith(1);
  expect(setDraft).toHaveBeenCalledWith({
    restaurantId: 1,
    shopName: "食堂",
    restaurantPicked: true,
  });
  expect(host.querySelector("output")?.textContent).toBe("/publish/dish");
});

it("places the G-AddDish AI autofill card prominently right before category instead of beside the dish name", async () => {
  writeSession({ tokenValue: "ai-token", tokenName: "satoken" });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/user/userInfo")) return ok(account);
      if (url.includes("/campus") || url.includes("/hub")) return ok([]);
      if (url.includes("/tags")) return ok([{ id: 1, name: "辣" }]);
      return ok({});
    }),
  );

  function AddDishAiHost() {
    const controller = {
      state: { cat: 0, desc: "" },
      setState: noop,
    } as unknown as Controller;
    const bridge = useDesignBridge("G-AddDish", controller, { cats: [] }, false);
    const nameFieldProps: Record<string, any> = {};
    const categoryProps: Record<string, any> = {};
    const nameField = bridge.node({
      screen: "G-AddDish",
      node: { id: 27, tag: "label", attrs: {}, children: [] },
      props: nameFieldProps,
      children: [<span key="l">菜名</span>, <input key="i" />],
      scope: {},
      text: "菜名",
    }) ?? <label {...nameFieldProps}>菜名</label>;
    const categoryField = bridge.node({
      screen: "G-AddDish",
      node: { id: 40, tag: "fieldset", attrs: {}, children: [] },
      props: categoryProps,
      children: [<legend key="lg">分类</legend>],
      scope: {},
      text: "分类",
    }) ?? <fieldset {...categoryProps}><legend>分类</legend></fieldset>;
    return (
      <div data-testid="form">
        <div data-testid="name-wrap">{nameField}</div>
        <div data-testid="cat-wrap">{categoryField}</div>
      </div>
    );
  }

  const mobile = {
    foodId: 1,
    shopId: 7,
    setFoodId: noop,
    setShopId: noop,
    panel: null,
    openPanel: noop,
    closePanel: noop,
    notice: noop,
    confirm: noop,
    go: noop,
    draft: {
      name: "",
      price: "",
      category: "staple",
      description: "",
      tags: [],
      stage: "#F3C46E",
      images: [],
    },
    setDraft: noop,
    setTagId: noop,
    meal: "晚饭",
    mealAuto: true,
    mealKey: "auto:dinner",
    setMeal: noop,
    setMealAuto: noop,
    noteServedMeal: noop,
    scene: "auto" as const,
    setScene: noop,
  } as unknown as MobileState;

  await act(async () =>
    root.render(
      <AppProvider>
        <AreaProvider>
          <MemoryRouter>
            <MobileContext.Provider value={mobile}>
              <AddDishAiHost />
            </MobileContext.Provider>
          </MemoryRouter>
        </AreaProvider>
      </AppProvider>,
    ),
  );

  expect(
    host.querySelector('[data-testid="name-wrap"] .mobile-publish-ai-card'),
  ).toBeNull();
  const catWrap = host.querySelector('[data-testid="cat-wrap"]')!;
  const aiCard = catWrap.querySelector(".mobile-publish-ai-card");
  expect(aiCard).not.toBeNull();
  expect(aiCard?.textContent).toContain("AI 帮填分类与口味");
  expect(aiCard?.nextElementSibling?.tagName).toBe("FIELDSET");
});
