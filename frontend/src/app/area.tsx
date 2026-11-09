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
import { hasCoordinates, wgsToGcj } from "../api/models";
import { errorMessage } from "../api/client";
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
  source: "hub" | "device";
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
const Context = createContext<{
  area: Area | null;
  openArea: () => void;
  selectArea: (area: Area) => void;
  campusId?: number;
  selectCampus: (id: number) => void;
}>({
  area: null,
  openArea: () => {},
  selectArea: () => {},
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
  useEffect(() => {
    const available = campuses.data?.filter((c) => c.open !== false);
    if (available?.length && !available.some((c) => c.id === campusId))
      setCampusId(
        (available.find((c) => c.isDefault) || available[0]).id ?? undefined,
      );
  }, [campuses.data, campusId]);
  function selectCampus(id: number) {
    setCampusId(id);
    try {
      localStorage.setItem("eatwhat-campus", String(id));
    } catch {
      /* preference optional */
    }
  }
  const [area, setArea] = useState<Area | null>(initialArea),
    [open, setOpen] = useState(false);
  function select(a: Area) {
    setArea(a);
    if (!isDemo)
      try {
        localStorage.setItem("eatwhat-area", JSON.stringify(a));
      } catch {
        /* preference optional */
      }
    setOpen(false);
  }
  return (
    <Context.Provider
      value={{
        area,
        openArea: () => setOpen(true),
        selectArea: select,
        campusId,
        selectCampus,
      }}
    >
      {children}
      {open && (
        <Modal title="从哪里开始找好吃的？" onClose={() => setOpen(false)}>
          <AreaPicker onSelect={select} />
        </Modal>
      )}
    </Context.Provider>
  );
}
function AreaPicker({ onSelect }: { onSelect: (area: Area) => void }) {
  const { api } = useApp(),
    [page, setPage] = useState(1),
    [locating, setLocating] = useState(false),
    [selecting, setSelecting] = useState<number>(),
    [deviceArea, setDeviceArea] = useState<Area>(),
    [error, setError] = useFeedbackState();
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
  function locate() {
    setLocating(true);
    setError("");
    if (!navigator.geolocation) {
      setError("当前浏览器不支持定位，请选择下方区域。");
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        try {
          const coordinates = wgsToGcj(p.coords.longitude, p.coords.latitude);
          const point: Area = {
            name: "我的当前位置",
            ...coordinates,
            source: "device",
          };
          setDeviceArea(point);
          const hub = await api.locateHub(
            coordinates.gcjLng,
            coordinates.gcjLat,
          );
          if (active.current)
            onSelect({
              ...point,
              name: hub?.name ? `${hub.name}附近` : point.name,
              hubId: hub?.id ?? undefined,
            });
        } catch (e) {
          if (active.current) setError(errorMessage(e));
        } finally {
          if (active.current) setLocating(false);
        }
      },
      () => {
        setError("未获取到位置，请允许浏览器定位或手动选择区域。");
        setLocating(false);
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  }
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
        {locating ? "正在定位并识别所属区域…" : "使用我的位置"}
      </button>

      {error && deviceArea && (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onSelect(deviceArea)}
        >
          仅使用当前位置
        </button>
      )}
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
                setDeviceArea(undefined);
                try {
                  const detail = await api.hubDetail(h.id!);
                  if (detail.id !== h.id || !hasCoordinates(detail))
                    throw new Error(
                      "区域详情缺少有效坐标，请重试或使用设备定位。",
                    );
                  if (active.current)
                    onSelect({
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
