import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { searchMapPlaces } from "./baidu-places";
import { gcjToBaidu } from "../features/map-geometry";

const { load } = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("./baidu-map", () => ({ loadBaiduMap: load }));
const center = { gcjLng: 117.14, gcjLat: 36.667 };
let callback: (result: unknown) => void;
let location: unknown;
const search = vi.fn();
let status = 0;
const rows = [
  {
    uid: "shop-1",
    title: " 云吞店 ",
    address: " 舜华路1号 ",
    point: gcjToBaidu(center),
  },
];
const results = (pois = rows) => ({
  getCurrentNumPois: () => pois.length,
  getPoi: (i: number) => pois[i],
});
beforeEach(() => {
  status = 0;
  load.mockReset();
  search.mockReset();
  load.mockResolvedValue({
    Point: class {
      constructor(
        public lng: number,
        public lat: number,
      ) {}
    },
    LocalSearch: class {
      constructor(
        origin: unknown,
        options: { onSearchComplete: typeof callback },
      ) {
        location = origin;
        callback = options.onSearchComplete;
      }
      search = search;
      getStatus() {
        return status;
      }
    },
  });
});
afterEach(() => vi.useRealTimers());

it("searches around the displayed GCJ point and returns usable GCJ POIs", async () => {
  const pending = searchMapPlaces(" 云吞 ", center);
  await Promise.resolve();
  expect(location).toEqual(gcjToBaidu(center));
  expect(search).toHaveBeenCalledWith("云吞");
  callback(results());
  const [place] = await pending;
  expect(place.name).toBe("云吞店");
  expect(place.address).toBe("舜华路1号");
  expect(place.point.gcjLng).toBeCloseTo(center.gcjLng, 8);
  expect(place.point.gcjLat).toBeCloseTo(center.gcjLat, 8);
});
it("skips blank searches and unusable results", async () => {
  await expect(searchMapPlaces("   ")).resolves.toEqual([]);
  expect(load).not.toHaveBeenCalled();
  const pending = searchMapPlaces("店铺");
  await Promise.resolve();
  expect(location).toBe("全国");
  callback(results([{ ...rows[0], point: { lng: NaN, lat: 36 } }]));
  await expect(pending).resolves.toEqual([]);
});
it("distinguishes no matches from provider failures without exposing SDK details", async () => {
  const empty = searchMapPlaces("未收录的店");
  await Promise.resolve();
  status = 2;
  callback(results([]));
  await expect(empty).resolves.toEqual([]);
  const denied = searchMapPlaces("店铺");
  await Promise.resolve();
  status = 4;
  callback(results());
  await expect(denied).rejects.toThrow("搜索暂不可用");
});
it("discards cancelled callbacks and bounds a stalled request", async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  const pending = searchMapPlaces("旧查询", center, controller.signal);
  const cancelled = expect(pending).rejects.toMatchObject({
    name: "AbortError",
  });
  await Promise.resolve();
  const oldCallback = callback;
  controller.abort();
  oldCallback(results());
  await cancelled;
  const stalled = searchMapPlaces("新查询");
  const timeout = expect(stalled).rejects.toThrow("搜索超时");
  await vi.advanceTimersByTimeAsync(10000);
  await timeout;
  expect(vi.getTimerCount()).toBe(0);
});
