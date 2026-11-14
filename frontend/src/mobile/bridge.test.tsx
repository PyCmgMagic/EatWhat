// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
vi.mock("../features/access", () => ({ useActionAccess: () => () => true }));
import { AppProvider } from "../app/context";
import { useApp } from "../app/state";
import { writeSession } from "../app/runtime";
import { useDesignBridge } from "./bridge";
import { MobileContext, type Draft, type MobileState } from "./ui";
import type { Controller } from "./types";
import { PrivateImages } from "../features/v4/Community";

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
  const props: Record<string, any> = { href: "G-Dish.dc.html" };
  bridge.node({
    screen: "G-AddDish",
    node: { id: -1, tag: "a", attrs: {}, children: [] },
    props,
    children: [],
    scope: {},
    text: "发布",
  });
  return (
    <>
      <a {...props} data-testid="publish">
        发布
      </a>
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
function Harness({ page }: { page: "publish" | "image" }) {
  const app = useApp();
  cache = useQueryClient();
  return app.user ? (
    page === "publish" ? (
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
      if (path.endsWith("/foods/tags/system") || path.endsWith("/campus/list"))
        return ok([]);
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
  vi.unstubAllGlobals();
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
