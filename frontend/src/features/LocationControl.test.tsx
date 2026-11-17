// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AreaProvider, type Area } from "../app/area";
import { wgsToGcj } from "../api/models";
import { LocationControl } from "./LocationControl";

const { api, address } = vi.hoisted(() => ({
  api: { campuses: vi.fn(), locateHub: vi.fn() },
  address: vi.fn(),
}));
vi.mock("../app/state", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/state")>()),
  useApp: () => ({ api }),
}));
vi.mock("../app/runtime", () => ({ isDemo: false }));
vi.mock("../api/baidu-map", () => ({ addressForMapPoint: address }));

const device: Area = {
  name: "当前位置",
  gcjLng: 117.134,
  gcjLat: 36.667,
  source: "device",
};
const campuses = [
  {
    id: 1,
    name: "软件园校区",
    gcjLng: 117.13,
    gcjLat: 36.66,
    isDefault: true,
    open: true,
    sort: 1,
  },
  {
    id: 2,
    name: "舜华路校区",
    gcjLng: 117.14,
    gcjLat: 36.67,
    isDefault: false,
    open: true,
    sort: 2,
  },
];
const getPosition = vi.fn<Geolocation["getCurrentPosition"]>();
const position = {
  coords: { longitude: 117.134, latitude: 36.667 },
} as GeolocationPosition;
let root: Root, host: HTMLDivElement, cache: QueryClient;

async function mount() {
  await act(async () => {
    root.render(
      <QueryClientProvider client={cache}>
        <AreaProvider>
          <LocationControl />
        </AreaProvider>
      </QueryClientProvider>,
    );
  });
  await settle();
  await settle();
}
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}
function trigger() {
  const button = host.querySelector<HTMLButtonElement>(".ew-select-trigger");
  if (!button) throw new Error("location trigger missing");
  return button;
}
async function openMenu() {
  await act(async () => trigger().click());
}
function optionLabels() {
  return Array.from(document.querySelectorAll('[role="option"]')).map(
    (node) => node.querySelectorAll("span > span")[0]?.textContent ?? "",
  );
}
async function choose(label: string) {
  const option = Array.from(
    document.querySelectorAll<HTMLElement>('[role="option"]'),
  ).find((node) => node.textContent?.includes(label));
  if (!option) throw new Error(`option ${label} missing`);
  await act(async () => {
    option.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await settle();
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  api.campuses.mockReset().mockResolvedValue(campuses);
  api.locateHub.mockReset().mockResolvedValue(null);
  address.mockReset().mockResolvedValue("济南市历城区舜华路1号");
  getPosition.mockReset();
  vi.stubGlobal("navigator", {
    geolocation: { getCurrentPosition: getPosition },
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  cache.clear();
  vi.unstubAllGlobals();
});

it("shows the remembered place and offers campuses as presets", async () => {
  localStorage.setItem("eatwhat-area", JSON.stringify(device));
  api.locateHub.mockResolvedValue({ id: 2, name: "软件园" });
  await mount();
  expect(trigger().textContent).toContain("软件园附近");
  await openMenu();
  expect(document.body.textContent).toContain("当前位置");
  expect(document.body.textContent).toContain("预设地点");
  expect(optionLabels()).toEqual(["软件园附近", "软件园校区", "舜华路校区"]);
  await choose("舜华路校区");
  expect(localStorage.getItem("eatwhat-campus")).toBe("2");
  expect(JSON.parse(localStorage.getItem("eatwhat-area")!).name).toBe(
    "舜华路校区",
  );
  expect(trigger().textContent).toContain("舜华路校区");
});

it("allows a manual retry after the startup request fails", async () => {
  await mount();
  expect(getPosition).toHaveBeenCalledOnce();
  expect(trigger().textContent).toContain("软件园校区");
  await act(() =>
    getPosition.mock.calls[0][1]?.({ code: 1 } as GeolocationPositionError),
  );
  await openMenu();
  await choose("使用当前位置");
  expect(getPosition).toHaveBeenCalledTimes(2);
  await act(async () => getPosition.mock.calls[1][0](position));
  await settle();
  expect(trigger().textContent).toContain("济南市历城区舜华路1号");
  expect(JSON.parse(localStorage.getItem("eatwhat-area")!)).toMatchObject({
    ...wgsToGcj(117.134, 36.667),
    source: "device",
  });
});

it("requests the position on startup before the visitor opens the control", async () => {
  await mount();
  expect(getPosition).toHaveBeenCalledOnce();
  await act(async () => getPosition.mock.calls[0][0](position));
  await settle();
  expect(trigger().textContent).toContain("济南市历城区舜华路1号");
});

it("keeps the campus preset when the position is denied", async () => {
  await mount();
  await act(() =>
    getPosition.mock.calls[0][1]?.({ code: 1 } as GeolocationPositionError),
  );
  await settle();
  expect(trigger().textContent).toContain("软件园校区");
  // The denial must not persist a device point; the campus fallback that the
  // area provider seeds on startup stays in place.
  expect(JSON.parse(localStorage.getItem("eatwhat-area")!)).toMatchObject({
    name: "软件园校区",
    source: "campus",
  });
});

it("names a hub picked elsewhere instead of claiming 当前位置", async () => {
  localStorage.setItem(
    "eatwhat-area",
    JSON.stringify({
      name: "软件园附近",
      hubId: 2,
      gcjLng: 117.15,
      gcjLat: 36.68,
      source: "hub",
    }),
  );
  await mount();
  expect(trigger().textContent).toContain("软件园附近");
  await openMenu();
  expect(document.body.textContent).toContain("已选地点");
  expect(optionLabels()).toContain("软件园附近");
});
