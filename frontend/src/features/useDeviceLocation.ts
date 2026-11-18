import { useCallback, useEffect, useRef, useState } from "react";
import type { Area } from "../app/area";
import { wgsToGcj } from "../api/models";
import { useFeedbackState } from "../components/feedback";

type Options = {
  selectionVersion: number;
  selectArea: (area: Area) => void;
  autoLocate?: boolean;
  disabled?: boolean;
};

function locationErrorMessage(code: number) {
  switch (code) {
    case 1:
      return "定位权限被拒绝，请在浏览器的站点设置中允许定位，并检查系统是否允许浏览器访问位置。";
    case 2:
      return "未获取到位置，请开启设备定位后重试，或手动选择区域。";
    case 3:
      return "定位超时，可以重试或手动选择区域。";
    default:
      return "无法获取位置，请重试或手动选择区域。";
  }
}

export function useDeviceLocation(options: Options) {
  const current = useRef(options);
  current.current = options;
  const mounted = useRef(false),
    requestId = useRef(0),
    pending = useRef(false);
  const [locating, setLocating] = useState(false),
    [locationError, setLocationError] = useFeedbackState(),
    [deviceRevision, setDeviceRevision] = useState(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestId.current++;
      pending.current = false;
    };
  }, []);

  const locate = useCallback(() => {
    if (!mounted.current || current.current.disabled || pending.current) return;
    if (window.isSecureContext === false) {
      setLocationError("当前页面无法申请定位权限，请使用 HTTPS 地址打开网站。");
      return;
    }
    const { featurePolicy } = document as Document & {
      featurePolicy?: { allowsFeature: (name: string) => boolean };
    };
    if (featurePolicy?.allowsFeature("geolocation") === false) {
      setLocationError(
        window.top === window
          ? "此网站的权限策略禁用了定位，请手动选择区域。"
          : "当前嵌入页面无法定位，请在浏览器中直接打开网站。",
      );
      return;
    }
    if (!navigator.geolocation) {
      setLocationError("浏览器不支持定位，请选择区域。");
      return;
    }
    const id = ++requestId.current,
      startingSelection = current.current.selectionVersion,
      startingPage =
        window.location.pathname + window.location.hash.split("?")[0];
    pending.current = true;
    setLocating(true);
    setLocationError("");

    // Native geolocation cannot be cancelled. Ignore results after leaving or
    // choosing another area instead of overwriting the user's newer choice.
    const finish = () => {
      if (!mounted.current || id !== requestId.current) return false;
      pending.current = false;
      setLocating(false);
      // Navigation can update the URL before React unmounts the outgoing page.
      const page =
        window.location.pathname + window.location.hash.split("?")[0];
      return (
        !current.current.disabled &&
        current.current.selectionVersion === startingSelection &&
        page === startingPage
      );
    };
    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (!finish()) return;
          try {
            const point = wgsToGcj(
              position.coords.longitude,
              position.coords.latitude,
            );
            current.current.selectArea({
              ...point,
              name: "当前位置",
              source: "device",
            });
            setDeviceRevision((value) => value + 1);
          } catch {
            setLocationError("无法读取位置，请重试或手动选择区域。");
          }
        },
        (error) => {
          if (!finish()) return;
          setLocationError(locationErrorMessage(error.code));
        },
        { timeout: 10000, maximumAge: 60000 },
      );
    } catch {
      if (finish())
        setLocationError("无法发起定位，请检查浏览器和系统的定位设置。");
    }
  }, []);

  useEffect(() => {
    if (!options.autoLocate || options.disabled || !navigator.permissions)
      return;
    let active = true;
    const startingSelection = current.current.selectionVersion;
    // Without a known grant, the first request must run in the click handler.
    void (async () => {
      try {
        const { state } = await navigator.permissions.query({
          name: "geolocation",
        });
        if (
          active &&
          state === "granted" &&
          current.current.selectionVersion === startingSelection
        )
          locate();
      } catch {
        // Some browsers expose the API without supporting geolocation queries.
      }
    })();
    return () => {
      active = false;
    };
  }, [options.autoLocate, options.disabled, locate]);

  return { locate, locating, locationError, deviceRevision };
}
