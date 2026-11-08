import { useCallback, useEffect, useRef, useState } from "react";
import type { Area } from "../app/area";
import { wgsToGcj } from "../api/models";

type Options = {
  area: Area | null;
  selectArea: (area: Area) => void;
  autoLocate: boolean;
  disabled?: boolean;
};

export function useDeviceLocation(options: Options) {
  const current = useRef(options);
  current.current = options;
  const mounted = useRef(false),
    requestId = useRef(0),
    pending = useRef(false);
  const [locating, setLocating] = useState(false),
    [locationError, setLocationError] = useState(""),
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
    if (!navigator.geolocation) {
      setLocationError("浏览器不支持定位，请选择区域。");
      return;
    }
    const id = ++requestId.current,
      startingArea = current.current.area,
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
        current.current.area === startingArea &&
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
          setLocationError(
            error.code === 3
              ? "定位超时，可以重试或手动选择区域。"
              : "未获取到位置，请允许浏览器定位或手动选择区域。",
          );
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
      );
    } catch {
      if (finish())
        setLocationError("无法发起定位，请允许浏览器定位或手动选择区域。");
    }
  }, []);

  useEffect(() => {
    if (!options.autoLocate || options.disabled) return;
    // Defer one task so StrictMode's effect replay does not ask twice.
    const timer = setTimeout(locate, 0);
    return () => clearTimeout(timer);
  }, [options.autoLocate, options.disabled, locate]);

  return { locate, locating, locationError, deviceRevision };
}
