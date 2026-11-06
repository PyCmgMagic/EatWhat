import BMapLoader from "@baidumap/jsapi-loader";

export type BaiduNamespace = typeof BMap & { coordType: CoordType };
let pending: Promise<BaiduNamespace> | undefined;
type MapLease = {
  instance: BMap.Map;
  canvas: HTMLDivElement;
  active: boolean;
  ready: boolean;
};
const mapInstances: MapLease[] = [];

export function acquireBaiduMap(api: BaiduNamespace, host: HTMLElement) {
  let lease = mapInstances.find((entry) => !entry.active);
  if (!lease) {
    const canvas = document.createElement("div");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    host.append(canvas);
    lease = {
      canvas,
      instance: new api.Map(canvas, {
        minZoom: 3,
        maxZoom: 20,
        enableAutoResize: true,
      }),
      active: true,
      ready: false,
    };
    const entry = lease;
    entry.instance.addEventListener("tilesloaded", () => {
      entry.ready = true;
    });
    entry.instance.addEventListener("style_loaded_error", () => {
      entry.ready = false;
    });
    mapInstances.push(lease);
  } else {
    lease.active = true;
    host.append(lease.canvas);
    lease.instance.enableAutoResize();
    lease.instance.checkResize();
  }
  return lease;
}

export function releaseBaiduMap(lease: MapLease) {
  const { instance, canvas } = lease;
  instance.disableAutoResize();
  if (instance.isLoaded())
    instance.centerAndZoom(instance.getCenter(), instance.getZoom(), {
      noAnimation: true,
    });
  instance.clearOverlays();
  canvas.remove();
  // SDK JSONP callbacks retain the map after navigation. Keep its state alive
  // and reuse idle instances, bounded by the number of simultaneous map views.
  lease.active = false;
}

export function loadBaiduMap(): Promise<BaiduNamespace> {
  const ak = import.meta.env.VITE_BAIDU_MAP_AK?.trim();
  if (!ak) return Promise.reject(new Error("地图尚未启用，仍可查看店铺列表。"));
  if (!pending) {
    pending = BMapLoader.load({
      ak,
      version: "4.0",
      protocol: "https",
      timeout: 15000,
    })
      .then((namespace: BaiduNamespace) => {
        // Keep native SDK events and overlays in one coordinate system.
        // Convert GCJ02 at our boundary instead of mixing facade/renderer conversions.
        namespace.coordType = BMAP_COORD_BD09;
        const gl = (window as unknown as { BMapGL?: BaiduNamespace }).BMapGL;
        if (gl) gl.coordType = BMAP_COORD_BD09;
        return namespace;
      })
      .catch(() => {
        pending = undefined;
        // SDK errors can contain the script URL and AK. Keep them out of UI/logs.
        throw new Error("百度地图加载失败，请稍后重试。店铺列表仍可使用。");
      });
  }
  return pending;
}
