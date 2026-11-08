import { loadBaiduMap } from "./baidu-map";
import {
  baiduToGcj,
  gcjToBaidu,
  mapPoint,
  type MapPoint,
} from "../features/map-geometry";

export type MapPlace = {
  id: string;
  name: string;
  address: string;
  point: MapPoint;
};

/** Search POIs without the SDK's automatic markers or form rendering. */
export async function searchMapPlaces(
  keyword: string,
  center?: MapPoint,
  signal?: AbortSignal,
): Promise<MapPlace[]> {
  const query = keyword.trim();
  if (!query) return [];
  signal?.throwIfAborted();
  const api = await loadBaiduMap();
  signal?.throwIfAborted();
  const origin = mapPoint(center);
  const bd = origin ? gcjToBaidu(origin) : undefined;
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (places: MapPlace[], error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve(places);
    };
    const abort = () =>
      finish([], new DOMException("搜索已取消", "AbortError"));
    const timer = setTimeout(
      () => finish([], new Error("搜索超时，请重试，或直接在地图上选点。")),
      10000,
    );
    signal?.addEventListener("abort", abort, { once: true });
    try {
      const search = new api.LocalSearch(
        bd ? new api.Point(bd.lng, bd.lat) : "全国",
        {
          pageCapacity: 10,
          onSearchComplete(results) {
            if (settled) return;
            const status = search.getStatus();
            // UNKNOWN_LOCATION is a normal no-match result, not a transport error.
            if (status === 2) return finish([]);
            if (status !== 0)
              return finish(
                [],
                new Error("百度地图搜索暂不可用，请重试或在地图上选点。"),
              );
            const result = Array.isArray(results) ? results[0] : results;
            const places: MapPlace[] = [];
            for (
              let i = 0;
              i < Math.min(result?.getCurrentNumPois() ?? 0, 10);
              i++
            ) {
              const poi = result.getPoi(i);
              const point =
                poi?.point && baiduToGcj(poi.point.lng, poi.point.lat);
              if (!point || !poi.title?.trim()) continue;
              places.push({
                id: poi.uid || `${poi.point.lng},${poi.point.lat}:${poi.title}`,
                name: poi.title.trim(),
                address: poi.address?.trim() ?? "",
                point,
              });
            }
            finish(places);
          },
        },
      );
      search.search(query);
    } catch {
      finish([], new Error("百度地图搜索暂不可用，请重试或在地图上选点。"));
    }
  });
}
