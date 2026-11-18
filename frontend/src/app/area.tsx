import { useFeedbackState } from "../components/feedback";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "./state";
import { isDemo } from "./runtime";
import { hasCoordinates } from "../api/models";
import { errorMessage } from "../api/client";
import { useDeviceLocation } from "../features/useDeviceLocation";
import {
  ErrorState,
  Gate,
  Icon,
  Loading,
  Modal,
  Pagination,
} from "../components/ui";
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
  openArea: () => void;
  selectArea: (area: Area) => void;
  selectionVersion: number;
  campusId?: number;
  selectCampus: (id: number) => void;
}>({
  area: null,
  ready: false,
  openArea: () => {},
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
    [open, setOpen] = useState(false),
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
    setOpen(false);
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
        openArea: () => setOpen(true),
        selectArea: select,
        selectionVersion,
        campusId,
        selectCampus,
      }}
    >
      {children}
      {open && (
        <Modal title="从哪里开始找好吃的？" onClose={() => setOpen(false)}>
          <AreaPicker />
        </Modal>
      )}
    </Context.Provider>
  );
}
function AreaPicker() {
  const { selectionVersion, selectArea } = useArea();
  const { api } = useApp(),
    [page, setPage] = useState(1),
    [selecting, setSelecting] = useState<number>(),
    [, setError] = useFeedbackState();
  const { locate, locating } = useDeviceLocation({
    selectionVersion,
    selectArea,
    disabled: selecting !== undefined,
  });
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const hubs = useQuery({
    queryKey: ["hubs", page],
    queryFn: () => api.hubs(page),
  });
  return (
    <>
      <p className="muted modal-description">
        手选区域后，将以区域中心查找餐厅。也可以主动开启定位。
      </p>
      <button
        className="btn btn-primary"
        disabled={locating || selecting !== undefined}
        onClick={locate}
      >
        <Icon name="pin" />
        {locating ? "正在定位…" : "使用我的位置"}
      </button>

      <div className="area-list">
        {hubs.isPending ? (
          <Loading />
        ) : hubs.isError ? (
          <ErrorState error={hubs.error} retry={() => void hubs.refetch()} />
        ) : hubs.data.items?.length ? (
          hubs.data.items.map((h) => (
            <button
              key={h.id ?? h.name}
              className="area-option"
              disabled={!h.id || locating || selecting !== undefined}
              onClick={async () => {
                setSelecting(h.id!);
                setError("");
                try {
                  const detail = await api.hubDetail(h.id!);
                  if (detail.id !== h.id || !hasCoordinates(detail))
                    throw new Error(
                      "区域详情缺少有效坐标，请重试或使用设备定位。",
                    );
                  if (active.current)
                    selectArea({
                      name: detail.name || "所选区域",
                      gcjLng: detail.gcjLng!,
                      gcjLat: detail.gcjLat!,
                      hubId: detail.id!,
                      source: "hub",
                    });
                } catch (cause) {
                  if (active.current) setError(errorMessage(cause));
                } finally {
                  if (active.current) setSelecting(undefined);
                }
              }}
            >
              <Icon name="pin" />
              <span>
                {h.name || "未命名区域"}
                <small>
                  {selecting === h.id
                    ? "正在读取区域详情…"
                    : "读取区域详情后按中心查找"}
                </small>
              </span>
              <Icon name="arrow" />
            </button>
          ))
        ) : (
          <p className="muted">
            暂无区域，请使用设备定位或联系管理员添加区域。
          </p>
        )}
      </div>
      <Pagination
        page={page}
        hasNext={hubs.data?.hasNext}
        totalPages={hubs.data?.totalPages}
        onPage={setPage}
      />
    </>
  );
}
