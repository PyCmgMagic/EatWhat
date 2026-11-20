import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "./state";
import { isDemo } from "./runtime";
import { hasCoordinates } from "../api/models";
import { useDeviceLocation } from "../features/useDeviceLocation";
export type Area = {
  name: string;
  gcjLng: number;
  gcjLat: number;
  hubId?: number;
  source: "hub" | "device" | "campus";
};
function initialArea(): Area | null {
  if (isDemo)
    return {
      name: "软件园校区",
      gcjLng: 117.134,
      gcjLat: 36.667,
      hubId: 1,
      source: "hub",
    };
  try {
    const a = JSON.parse(localStorage.getItem("eatwhat-area") || "null");
    if (a && hasCoordinates(a) && typeof a.name === "string") return a;
  } catch {
    /* optional preference */
  }
  return null;
}
function rememberArea(area: Area) {
  if (!isDemo)
    try {
      localStorage.setItem("eatwhat-area", JSON.stringify(area));
    } catch {
      /* preference optional */
    }
}
const Context = createContext<{
  area: Area | null;
  ready: boolean;
  selectArea: (area: Area) => void;
  selectionVersion: number;
  campusId?: number;
  selectCampus: (id: number) => void;
}>({
  area: null,
  ready: false,
  selectArea: () => {},
  selectionVersion: 0,
  selectCampus: () => {},
});
export function useArea() {
  return useContext(Context);
}
export function AreaProvider({ children }: { children: ReactNode }) {
  const { api } = useApp();
  const campuses = useQuery({
    queryKey: ["campuses"],
    queryFn: () => api.campuses(),
    staleTime: 300_000,
  });
  const [campusId, setCampusId] = useState<number | undefined>(() => {
    try {
      return Number(localStorage.getItem("eatwhat-campus")) || undefined;
    } catch {
      return undefined;
    }
  });
  const [area, setArea] = useState<Area | null>(initialArea),
    [selectionVersion, setSelectionVersion] = useState(0);
  useEffect(() => {
    const available = campuses.data?.filter(
      (c) => c.open !== false && c.id && hasCoordinates(c),
    );
    const campus =
      available?.find((c) => c.id === campusId) ??
      available?.find((c) => c.isDefault) ??
      available?.[0];
    if (!campus) return;
    if (campus.id !== campusId) rememberCampus(campus.id!);
    // A saved device/hub point takes precedence on startup. A campus point
    // follows the current list, including changed coordinates or a removed ID.
    if (!area || area.source === "campus") {
      const point: Area = {
        name: campus.name || "所选校区",
        gcjLng: campus.gcjLng!,
        gcjLat: campus.gcjLat!,
        source: "campus",
      };
      if (
        area?.name !== point.name ||
        area.gcjLng !== point.gcjLng ||
        area.gcjLat !== point.gcjLat
      ) {
        setArea(point);
        rememberArea(point);
      }
    }
  }, [campuses.data, campusId, area]);
  function rememberCampus(id: number) {
    setCampusId(id);
    try {
      localStorage.setItem("eatwhat-campus", String(id));
    } catch {
      /* preference optional */
    }
  }
  function selectCampus(id: number) {
    const campus = campuses.data?.find(
      (c) => c.id === id && c.open !== false && hasCoordinates(c),
    );
    if (!campus) return;
    rememberCampus(id);
    select({
      name: campus.name || "所选校区",
      gcjLng: campus.gcjLng!,
      gcjLat: campus.gcjLat!,
      source: "campus",
    });
  }
  useEffect(() => {
    if (
      area?.source !== "device" ||
      !["当前位置", "我的当前位置"].includes(area.name)
    )
      return;
    let active = true;
    void (async () => {
      const hub = await api
        .locateHub(area.gcjLng, area.gcjLat)
        .catch(() => null);
      if (!active) return;
      let name = hub?.name ? `${hub.name}附近` : undefined;
      if (!name)
        try {
          const { addressForMapPoint } = await import("../api/baidu-map");
          name = await addressForMapPoint(area);
        } catch {
          /* A name lookup must not discard usable device coordinates. */
        }
      if (!active || !name) return;
      const named = {
        ...area,
        name,
        hubId: hub?.id ?? area.hubId,
      };
      setArea(named);
      rememberArea(named);
    })();
    return () => {
      active = false;
    };
  }, [area, api]);
  function select(a: Area) {
    setSelectionVersion((version) => version + 1);
    setArea(a);
    rememberArea(a);
  }
  const ready =
    area !== null ||
    (!campuses.isPending &&
      !campuses.data?.some(
        (c) => c.open !== false && c.id && hasCoordinates(c),
      ));
  useDeviceLocation({
    selectionVersion,
    selectArea: select,
    autoLocate: ready && !isDemo,
  });
  return (
    <Context.Provider
      value={{
        area,
        // Wait for the default point before consuming a personalized batch.
        ready,
        selectArea: select,
        selectionVersion,
        campusId,
        selectCampus,
      }}
    >
      {children}
    </Context.Provider>
  );
}
