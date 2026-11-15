// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AreaProvider, useArea, type Area } from "./area";

const { api, address } = vi.hoisted(() => ({
  api: { campuses: vi.fn(), locateHub: vi.fn() },
  address: vi.fn(),
}));
vi.mock("./state", () => ({ useApp: () => ({ api }) }));
vi.mock("./runtime", () => ({ isDemo: false }));
vi.mock("../api/baidu-map", () => ({ addressForMapPoint: address }));

const device: Area = {
  name: "当前位置",
  gcjLng: 117.14,
  gcjLat: 36.667,
  source: "device",
};
let root: Root, host: HTMLDivElement, cache: QueryClient;
let areaState: ReturnType<typeof useArea>;
function Harness() {
  areaState = useArea();
  return <output>{areaState.area?.name}</output>;
}
async function mount(area: Area = device) {
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
  api.locateHub.mockReset().mockResolvedValue(null);
  address.mockReset().mockResolvedValue("济南市历城区舜华路1号");
  host = document.createElement("div");
  root = createRoot(host);
  cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  act(() => root.unmount());
  cache.clear();
  vi.unstubAllGlobals();
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
