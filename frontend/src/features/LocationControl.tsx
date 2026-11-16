import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Select } from "../components/Select";
import { useArea } from "../app/area";
import { useApp } from "../app/state";
import { isDemo } from "../app/runtime";
import { useDeviceLocation } from "./useDeviceLocation";
import "./location-control.css";

const HERE = "here";
const AREA = "area";
const CAMPUS = "campus:";

/** True only when the browser already lets us read the position without asking. */
function alreadyAllowed() {
  return navigator.permissions
    ?.query({ name: "geolocation" as PermissionName })
    .then((status) => status.state === "granted")
    .catch(() => false);
}

/**
 * The place the recommendation feed is read from.
 *
 * The position comes first — that is where the visitor actually is; the campuses
 * stay as presets for when the browser cannot, or should not, locate.
 */
export function LocationControl() {
  const { area, selectArea, campusId, selectCampus } = useArea();
  const { api } = useApp();
  const campuses = useQuery({
    queryKey: ["campuses"],
    queryFn: () => api.campuses(),
    staleTime: 300_000,
  });
  // A remembered place wins. Only a returning visitor who already granted
  // location is upgraded silently; asking here would prompt on every page load.
  const [autoLocate, setAutoLocate] = useState(false);
  useEffect(() => {
    if (area || isDemo || !navigator.geolocation) return;
    let active = true;
    void alreadyAllowed().then((allowed) => {
      if (active && allowed) setAutoLocate(true);
    });
    return () => {
      active = false;
    };
  }, [area]);
  const { locate, locating } = useDeviceLocation({
    area,
    selectArea,
    autoLocate,
  });

  const options = (campuses.data ?? []).filter((c) => c.open !== false);
  const campus = options.find((c) => c.id === campusId);
  const fromDevice = area?.source === "device";
  // A place picked elsewhere in the app is neither "here" nor a campus preset.
  // It is a preset only when it is the campus itself, so the same place is not
  // listed twice and the trigger keeps naming the place the feed reads.
  const campusAtArea =
    area && !fromDevice ? options.find((c) => c.name === area.name) : undefined;
  const picked = area && !fromDevice && !campusAtArea ? area : null;
  const value = (() => {
    if (locating || fromDevice) return HERE;
    if (campusAtArea) return `${CAMPUS}${campusAtArea.id}`;
    if (picked) return AREA;
    return campus ? `${CAMPUS}${campus.id}` : HERE;
  })();
  const here = locating
    ? "正在定位…"
    : fromDevice
      ? (area?.name ?? "当前位置")
      : "使用当前位置";
  return (
    <span
      className="ew-location-control"
      title={fromDevice ? area?.name : undefined}
    >
      <Select
        aria-label="推荐位置"
        menuLabel="今天从哪里开始吃？"
        icon={<MapPin size={16} />}
        value={value}
        onChange={(event) => {
          const next = event.target.value;
          if (next === HERE) {
            locate();
            return;
          }
          if (!next.startsWith(CAMPUS)) return;
          const id = Number(next.slice(CAMPUS.length));
          const chosen = options.find((c) => c.id === id);
          if (!chosen) return;
          // A preset is both the feed's campus and the place it is measured from.
          selectCampus(id);
          const { name, gcjLng, gcjLat } = chosen;
          if (typeof gcjLng === "number" && typeof gcjLat === "number")
            selectArea({
              name: name ?? "所选校区",
              gcjLng,
              gcjLat,
              source: "hub",
            });
        }}
      >
        <optgroup label="当前位置">
          <option
            value={HERE}
            data-description={
              locating
                ? "正在读取浏览器定位…"
                : fromDevice
                  ? "来自浏览器定位"
                  : "需要浏览器定位权限"
            }
          >
            {here}
          </option>
        </optgroup>
        {picked && (
          <optgroup label="已选地点">
            <option value={AREA} data-description="自定义位置">
              {picked.name}
            </option>
          </optgroup>
        )}
        <optgroup label="预设地点">
          {campuses.isPending && (
            <option value="" disabled>
              正在加载校区…
            </option>
          )}
          {campuses.isError && (
            <option value="" disabled>
              校区加载失败
            </option>
          )}
          {options.map((c) => (
            <option
              key={c.id}
              value={`${CAMPUS}${c.id}`}
              data-description={c.isDefault ? "默认校区" : undefined}
            >
              {c.name}
            </option>
          ))}
        </optgroup>
      </Select>
      {campuses.isError && (
        <button
          type="button"
          className="ew-location-retry"
          onClick={() => void campuses.refetch()}
        >
          重试校区
        </button>
      )}
    </span>
  );
}
