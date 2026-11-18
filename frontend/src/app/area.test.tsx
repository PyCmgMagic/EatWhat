// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AreaProvider, useArea, type Area } from "./area";

const { api, address } = vi.hoisted(() => ({
  api: { campuses: vi.fn(), hubs: vi.fn(), locateHub: vi.fn() },
  address: vi.fn(),
}));
vi.mock("./state", () => ({ useApp: () => ({ api }) }));
vi.mock("../components/feedback", () => ({
  useFeedbackState: () => ["", vi.fn()],
}));
vi.mock("./runtime", () => ({ isDemo: false }));
vi.mock("../api/baidu-map", () => ({ addressForMapPoint: address }));

const device: Area = {
  name: "当前位置",
  gcjLng: 117.14,
  gcjLat: 36.667,
  source: "device",
};
const getPosition = vi.fn<Geolocation["getCurrentPosition"]>();
const position = {
  coords: { longitude: 117.134, latitude: 36.667 },
} as GeolocationPosition;
let root: Root, host: HTMLDivElement, cache: QueryClient;
let areaState: ReturnType<typeof useArea>;
function Harness() {
  areaState = useArea();
  return <output>{areaState.area?.name}</output>;
}
async function mount(area: Area | null = device) {
  localStorage.setItem("eatwhat-area", JSON.stringify(area));
  await act(async () => {
    root.render(
      <QueryClientProvider client={cache}>
        <AreaProvider>
          <Harness />
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
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  api.campuses.mockReset().mockResolvedValue([]);
  api.hubs.mockReset().mockResolvedValue({ items: [] });
  api.locateHub.mockReset().mockResolvedValue(null);
  address.mockReset().mockResolvedValue("济南市历城区舜华路1号");
  getPosition.mockReset();
  vi.stubGlobal("navigator", {
    geolocation: { getCurrentPosition: getPosition },
    permissions: { query: vi.fn().mockResolvedValue({ state: "granted" }) },
  });
  host = document.createElement("div");
  root = createRoot(host);
  cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  cache.clear();
  vi.unstubAllGlobals();
});

it("requests device position on startup and uses it instead of the saved area", async () => {
  await mount({ ...device, name: "手选区域", source: "hub" });
  expect(getPosition).toHaveBeenCalledOnce();
  await act(async () => getPosition.mock.calls[0][0](position));
  await settle();
  expect(areaState.area?.source).toBe("device");
  expect(areaState.area?.gcjLng).not.toBe(position.coords.longitude);
  expect(JSON.parse(localStorage.getItem("eatwhat-area")!)).toEqual(
    areaState.area,
  );
});

it("restores a saved device location with its recognized area name", async () => {
  api.locateHub.mockResolvedValue({ id: 2, name: "软件园" });
  await mount();
  expect(areaState.area).toEqual({ ...device, name: "软件园附近", hubId: 2 });
  expect(JSON.parse(localStorage.getItem("eatwhat-area")!)).toEqual(
    areaState.area,
  );
  expect(address).not.toHaveBeenCalled();
});

it.each([null, new Error("区域查询暂不可用")])(
  "uses the map address when the location has no recognized area (%s)",
  async (hub) => {
    if (hub instanceof Error) api.locateHub.mockRejectedValue(hub);
    await mount({ ...device, name: "我的当前位置" });
    await settle();
    expect(host.textContent).toBe("济南市历城区舜华路1号");
    expect(areaState.area).toEqual({ ...device, name: host.textContent });
    expect(address).toHaveBeenCalledWith({ ...device, name: "我的当前位置" });
    expect(JSON.parse(localStorage.getItem("eatwhat-area")!).name).toBe(
      host.textContent,
    );
  },
);

it("names a newly selected device location as well as a restored one", async () => {
  const campus: Area = { ...device, source: "hub", name: "软件园", hubId: 2 };
  await mount(campus);
  expect(api.locateHub).not.toHaveBeenCalled();
  await act(async () => areaState.selectArea(device));
  await settle();
  expect(areaState.area?.name).toBe("济南市历城区舜华路1号");
  expect(areaState.area?.source).toBe("device");
});

it("keeps a newer selection when a previous address lookup finishes late", async () => {
  let finish!: (name: string) => void;
  address.mockReturnValue(
    new Promise<string>((resolve) => {
      finish = resolve;
    }),
  );
  await mount();
  await settle();
  const manual: Area = { ...device, source: "hub", name: "新选区域", hubId: 3 };
  await act(async () => areaState.selectArea(manual));
  await act(async () => finish("上一个位置的地址"));
  expect(areaState.area).toEqual(manual);
  expect(JSON.parse(localStorage.getItem("eatwhat-area")!)).toEqual(manual);
});

it("retains usable coordinates if both name services fail", async () => {
  api.locateHub.mockRejectedValue(new Error("区域查询失败"));
  address.mockRejectedValue(new Error("地图不可用"));
  await mount();
  await settle();
  expect(areaState.area).toEqual(device);
  expect(api.locateHub).toHaveBeenCalledOnce();
});

it("preserves existing named locations without querying again", async () => {
  const named = { ...device, name: "软件园附近" };
  await mount(named);
  expect(areaState.area).toEqual(named);
  expect(api.locateHub).not.toHaveBeenCalled();
  expect(address).not.toHaveBeenCalled();
});

const campuses = [
  {
    id: 1,
    name: "软件园",
    gcjLng: 117.140109,
    gcjLat: 36.667382,
    isDefault: true,
  },
  { id: 2, name: "中心", gcjLng: 117.055, gcjLat: 36.673, isDefault: false },
];

it("uses the picker position when the default campus loads during the permission prompt", async () => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value: vi.fn() },
    close: { configurable: true, value: vi.fn() },
  });
  let finishCampuses!: (value: typeof campuses) => void;
  api.campuses.mockReturnValue(
    new Promise((resolve) => {
      finishCampuses = resolve;
    }),
  );
  api.locateHub.mockRejectedValue(new Error("区域查询失败"));
  vi.stubGlobal("navigator", {
    geolocation: { getCurrentPosition: getPosition },
    permissions: { query: vi.fn().mockResolvedValue({ state: "prompt" }) },
  });
  document.body.append(host);
  await mount(null);
  await act(async () => areaState.openArea());
  const button = host.querySelector<HTMLButtonElement>("dialog .btn-primary");
  expect(button?.textContent).toContain("使用我的位置");
  act(() => button!.click());
  expect(getPosition).toHaveBeenCalledOnce();
  await act(async () => finishCampuses(campuses));
  await settle();
  expect(areaState.area?.source).toBe("campus");
  await act(async () => getPosition.mock.calls[0][0](position));
  expect(areaState.area?.source).toBe("device");
  expect(host.querySelector("dialog")).toBeNull();
});

it("waits for the default campus and uses its coordinates without a hub lookup", async () => {
  let finish!: (value: typeof campuses) => void;
  api.campuses.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  await mount(null);
  expect(areaState.ready).toBe(false);
  await act(async () => finish(campuses));
  await settle();
  expect(areaState.ready).toBe(true);
  expect(areaState.campusId).toBe(1);
  expect(areaState.area).toEqual({
    name: "软件园",
    gcjLng: 117.140109,
    gcjLat: 36.667382,
    source: "campus",
  });
  expect(api.locateHub).not.toHaveBeenCalled();
});

it("switches the query point to the selected campus and remembers it", async () => {
  api.campuses.mockResolvedValue(campuses);
  await mount({ ...device, name: "当前区域", source: "hub", hubId: 7 });
  await settle();
  await act(async () => areaState.selectCampus(2));
  expect(areaState.area).toEqual({
    name: "中心",
    gcjLng: 117.055,
    gcjLat: 36.673,
    source: "campus",
  });
  expect(areaState.campusId).toBe(2);
  expect(localStorage.getItem("eatwhat-campus")).toBe("2");
  expect(JSON.parse(localStorage.getItem("eatwhat-area")!)).toEqual(
    areaState.area,
  );
  expect(api.locateHub).not.toHaveBeenCalled();
  // A manually selected position remains authoritative after a list refresh.
  const manual: Area = { ...device, name: "新位置" };
  await act(async () => areaState.selectArea(manual));
  await act(async () => {
    cache.setQueryData(["campuses"], [...campuses]);
  });
  await settle();
  expect(areaState.area).toEqual(manual);
});

it("restores a saved campus ID using the current list and falls back if removed", async () => {
  api.campuses.mockResolvedValue(campuses);
  localStorage.setItem("eatwhat-campus", "2");
  await mount({ ...device, name: "旧校区名", source: "campus" });
  await settle();
  expect(areaState.area?.gcjLng).toBe(117.055);
  expect(areaState.area?.name).toBe("中心");
  await act(async () => {
    cache.setQueryData(["campuses"], [campuses[0]]);
  });
  await settle();
  expect(areaState.campusId).toBe(1);
  expect(areaState.area?.gcjLng).toBe(117.140109);
});

it("does not replace a saved location on startup or accept a missing campus", async () => {
  api.campuses.mockResolvedValue(campuses);
  const saved: Area = { ...device, name: "当前位置附近" };
  await mount(saved);
  await settle();
  expect(areaState.area).toEqual(saved);
  await act(async () => areaState.selectCampus(999));
  expect(areaState.area).toEqual(saved);
});
