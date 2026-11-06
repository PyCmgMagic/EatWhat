import { hasCoordinates } from "../api/models";

export type MapPoint = { gcjLng: number; gcjLat: number };

const xPi = (Math.PI * 3000) / 180;
export function gcjToBaidu(point: MapPoint) {
  const x = point.gcjLng,
    y = point.gcjLat;
  const radius = Math.hypot(x, y) + 0.00002 * Math.sin(y * xPi);
  const angle = Math.atan2(y, x) + 0.000003 * Math.cos(x * xPi);
  return {
    lng: radius * Math.cos(angle) + 0.0065,
    lat: radius * Math.sin(angle) + 0.006,
  };
}

export function baiduToGcj(lng: number, lat: number): MapPoint | undefined {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return undefined;
  let gcjLng = lng - 0.0065,
    gcjLat = lat - 0.006;
  for (let i = 0; i < 6; i++) {
    const converted = gcjToBaidu({ gcjLng, gcjLat });
    gcjLng -= converted.lng - lng;
    gcjLat -= converted.lat - lat;
  }
  return mapPoint({ gcjLng, gcjLat });
}

export function baiduMarkerUrl(value: {
  gcjLng?: number | null;
  gcjLat?: number | null;
  name?: string | null;
  address?: string | null;
}) {
  const point = mapPoint(value);
  if (!point) return undefined;
  return (
    "https://api.map.baidu.com/marker?" +
    new URLSearchParams({
      location: `${point.gcjLat},${point.gcjLng}`,
      title: value.name || "餐厅",
      content: value.address || value.name || "餐厅位置",
      coord_type: "gcj02",
      output: "html",
      src: "webapp.eatwhat.campus",
    })
  );
}

export function mapPoint(
  value: { gcjLng?: number | null; gcjLat?: number | null } | null | undefined,
): MapPoint | undefined {
  return value && hasCoordinates(value)
    ? { gcjLng: value.gcjLng!, gcjLat: value.gcjLat! }
    : undefined;
}
