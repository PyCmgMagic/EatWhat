import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  mapPoint,
  gcjToBaidu,
  baiduToGcj,
  baiduMarkerUrl,
} from "../features/map-geometry";
import type { BaiduNamespace } from "./baidu-map";
const { load } = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("@baidumap/jsapi-loader", () => ({ default: { load } }));

beforeEach(() => {
  vi.resetModules();
  load.mockReset();
  vi.stubEnv("VITE_BAIDU_MAP_AK", "isolated-map-test-ak");
  vi.stubGlobal("BMAP_COORD_BD09", "bd09");
  vi.stubGlobal("window", {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Baidu Maps integration", () => {
  it("reverse geocodes the BD09 equivalent of the selected GCJ point", async () => {
    const getLocation = vi.fn((_p, callback) =>
      callback({ address: "历城区舜华路1号" }),
    );
    const Point = vi.fn(function (lng, lat) {
      return { lng, lat };
    });
    load.mockResolvedValue({
      Point,
      Geocoder: class {
        getLocation = getLocation;
      },
    });
    const { addressForMapPoint } = await import("./baidu-map");
    const selected = { gcjLng: 117.14, gcjLat: 36.66 };
    await expect(addressForMapPoint(selected)).resolves.toBe("历城区舜华路1号");
    const bd = gcjToBaidu(selected);
    expect(Point).toHaveBeenCalledWith(bd.lng, bd.lat);
  });
  it("does not query an invalid point and tolerates missing address results", async () => {
    const { addressForMapPoint } = await import("./baidu-map");
    await expect(
      addressForMapPoint({ gcjLng: 0, gcjLat: 0 }),
    ).resolves.toBeUndefined();
    expect(load).not.toHaveBeenCalled();
    load.mockResolvedValue({
      Point: class {},
      Geocoder: class {
        getLocation(_p: unknown, callback: (r: null) => void) {
          callback(null);
        }
      },
    });
    await expect(
      addressForMapPoint({ gcjLng: 117.14, gcjLat: 36.66 }),
    ).resolves.toBeUndefined();
  });
  it("uses structured street information rather than truncating a long address", async () => {
    load.mockResolvedValue({
      Point: class {},
      Geocoder: class {
        getLocation(_p: unknown, callback: (r: unknown) => void) {
          callback({
            address: "很长的地址".repeat(10),
            addressComponents: {
              city: "济南市",
              district: "历城区",
              street: "舜华路",
              streetNumber: "1号",
            },
          });
        }
      },
    });
    const { addressForMapPoint } = await import("./baidu-map");
    await expect(
      addressForMapPoint({ gcjLng: 117.14, gcjLat: 36.66 }),
    ).resolves.toBe("济南市历城区舜华路1号");
  });
  it("requires configured credentials instead of silently loading a different map provider", async () => {
    vi.stubEnv("VITE_BAIDU_MAP_AK", "");
    const { loadBaiduMap } = await import("./baidu-map");
    await expect(loadBaiduMap()).rejects.toThrow("地图尚未启用");
    expect(load).not.toHaveBeenCalled();
  });
  it("uses the official HTTPS JSAPI 4 loader and keeps the facade and renderer in BD09", async () => {
    const api = { coordType: "gcj02" },
      renderer = { coordType: "gcj02" };
    vi.stubGlobal("window", { BMapGL: renderer });
    load.mockResolvedValue(api);
    const { loadBaiduMap } = await import("./baidu-map");
    expect(await loadBaiduMap()).toBe(api);
    expect(load).toHaveBeenCalledWith({
      ak: "isolated-map-test-ak",
      version: "4.0",
      protocol: "https",
      timeout: 15000,
    });
    expect(api.coordType).toBe("bd09");
    expect(renderer.coordType).toBe("bd09");
  });
  it("shares a single SDK request across multiple map instances", async () => {
    let finish!: (api: unknown) => void;
    load.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { loadBaiduMap } = await import("./baidu-map");
    const first = loadBaiduMap(),
      second = loadBaiduMap();
    expect(first).toBe(second);
    finish({ coordType: "bd09" });
    await first;
    await loadBaiduMap();
    expect(load).toHaveBeenCalledTimes(1);
  });
  it("allows retry after SDK failure and keeps the script URL and AK out of error messages", async () => {
    load.mockRejectedValueOnce(
      new Error("https://api.map.baidu.com/api?ak=isolated-map-test-ak"),
    );
    const { loadBaiduMap } = await import("./baidu-map");
    await expect(loadBaiduMap()).rejects.toThrow("百度地图加载失败");
    load.mockResolvedValueOnce({ coordType: "bd09" });
    await loadBaiduMap();
    expect(load).toHaveBeenCalledTimes(2);
  });
  it("reuses released maps while keeping simultaneous views independent", async () => {
    vi.stubGlobal("document", {
      createElement: () => ({ style: {}, remove: vi.fn() }),
    });
    const MapConstructor = vi.fn(function () {
      return {
        enableAutoResize: vi.fn(),
        enableDragging: vi.fn(),
        addEventListener: vi.fn(),
        disableAutoResize: vi.fn(),
        checkResize: vi.fn(),
        isLoaded: () => true,
        getCenter: () => ({ lng: 117, lat: 36 }),
        getZoom: () => 17,
        centerAndZoom: vi.fn(),
        clearOverlays: vi.fn(),
        destroy: vi.fn(),
      };
    });
    const api = { Map: MapConstructor } as unknown as BaiduNamespace;
    const host = { append: vi.fn() } as unknown as HTMLElement;
    const { acquireBaiduMap, releaseBaiduMap } = await import("./baidu-map");
    const first = acquireBaiduMap(api, host);
    const concurrent = acquireBaiduMap(api, host);
    expect(first.instance).not.toBe(concurrent.instance);
    releaseBaiduMap(first);
    expect(first.instance.centerAndZoom).toHaveBeenCalledWith(
      { lng: 117, lat: 36 },
      17,
      { noAnimation: true },
    );
    expect(first.instance.clearOverlays).toHaveBeenCalledOnce();
    expect(first.canvas.remove).toHaveBeenCalledOnce();
    expect(first.instance.destroy).not.toHaveBeenCalled();
    expect(concurrent.instance.disableAutoResize).not.toHaveBeenCalled();
    expect(acquireBaiduMap(api, host)).toBe(first);
    expect(MapConstructor).toHaveBeenCalledTimes(2);
    expect(first.instance.checkResize).toHaveBeenCalledOnce();
    expect(first.instance.enableDragging).toHaveBeenCalledTimes(2);
    expect(concurrent.instance.enableDragging).toHaveBeenCalledOnce();
  });
  it("does not place restaurants with missing or invalid coordinates on the map", () => {
    for (const value of [
      null,
      { gcjLng: 117 },
      { gcjLng: 0, gcjLat: 0 },
      { gcjLng: NaN, gcjLat: 36 },
    ])
      expect(mapPoint(value)).toBeUndefined();
    expect(mapPoint({ gcjLng: 117.14, gcjLat: 36.66 })).toEqual({
      gcjLng: 117.14,
      gcjLat: 36.66,
    });
  });
  it.each([
    [116.404, 39.915],
    [117.14, 36.667],
    [121.4737, 31.2304],
    [113.2644, 23.1291],
  ])(
    "round-trips map display, clicks and marker drags at %s,%s",
    (gcjLng, gcjLat) => {
      const bd = gcjToBaidu({ gcjLng, gcjLat });
      const restored = baiduToGcj(bd.lng, bd.lat)!;
      expect(bd.lng - gcjLng).toBeGreaterThan(0.006);
      expect(bd.lat - gcjLat).toBeGreaterThan(0.005);
      expect(restored.gcjLng).toBeCloseTo(gcjLng, 8);
      expect(restored.gcjLat).toBeCloseTo(gcjLat, 8);
    },
  );
  it("uses Baidu navigation with explicit GCJ02 input, correct latitude order and encoded content", () => {
    const url = new URL(
      baiduMarkerUrl({
        gcjLng: 117.14,
        gcjLat: 36.667,
        name: "店 & 茶",
        address: "一楼 #2",
      })!,
    );
    expect(url.hostname).toBe("api.map.baidu.com");
    expect(url.searchParams.get("location")).toBe("36.667,117.14");
    expect(url.searchParams.get("coord_type")).toBe("gcj02");
    expect(url.searchParams.get("title")).toBe("店 & 茶");
    expect(baiduMarkerUrl({ gcjLng: null })).toBeUndefined();
  });
});
