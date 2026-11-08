// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Area } from "../app/area";
import { wgsToGcj } from "../api/models";
import { useDeviceLocation } from "./useDeviceLocation";

let root: Root, host: HTMLDivElement;
let state: ReturnType<typeof useDeviceLocation>;
const getPosition = vi.fn<Geolocation["getCurrentPosition"]>();
const selectArea = vi.fn();
const position = {
  coords: { longitude: 117.134, latitude: 36.667 },
} as GeolocationPosition;
const manualArea: Area = {
  name: "手选区域",
  source: "hub",
  hubId: 2,
  gcjLng: 117.1,
  gcjLat: 36.6,
};
function Harness({
  area = null,
  autoLocate = true,
  disabled = false,
}: {
  area?: Area | null;
  autoLocate?: boolean;
  disabled?: boolean;
}) {
  state = useDeviceLocation({ area, autoLocate, disabled, selectArea });
  return null;
}
function render(props: Parameters<typeof Harness>[0] = {}) {
  act(() =>
    root.render(
      <StrictMode>
        <Harness {...props} />
      </StrictMode>,
    ),
  );
  act(() => vi.runOnlyPendingTimers());
}
function succeed(index = 0) {
  act(() => getPosition.mock.calls[index][0](position));
}
function fail(code: number, index = 0) {
  act(() =>
    getPosition.mock.calls[index][1]?.({ code } as GeolocationPositionError),
  );
}
beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  window.history.replaceState(null, "", "/#/nearby");
  getPosition.mockReset();
  selectArea.mockReset();
  vi.stubGlobal("navigator", {
    geolocation: { getCurrentPosition: getPosition },
  });
  host = document.createElement("div");
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("requests on entry once in StrictMode and publishes converted device coordinates", () => {
  render();
  expect(getPosition).toHaveBeenCalledOnce();
  expect(state.locating).toBe(true);
  render();
  act(() => state.locate());
  expect(getPosition).toHaveBeenCalledOnce();
  succeed();
  expect(selectArea).toHaveBeenCalledWith({
    ...wgsToGcj(117.134, 36.667),
    name: "当前位置",
    source: "device",
  });
  expect(state.locating).toBe(false);
  expect(state.deviceRevision).toBe(1);
  render();
  expect(getPosition).toHaveBeenCalledOnce();
});

it("does not locate automatically for other maps, but retains the manual action", () => {
  render({ autoLocate: false });
  expect(getPosition).not.toHaveBeenCalled();
  act(() => state.locate());
  succeed();
  expect(selectArea).toHaveBeenCalledOnce();
});

it("keeps existing area after denial, does not loop, and allows manual retry", () => {
  render({ area: manualArea });
  fail(1);
  expect(state.locationError).toContain("允许浏览器定位");
  expect(state.locating).toBe(false);
  expect(selectArea).not.toHaveBeenCalled();
  render({ area: manualArea });
  expect(getPosition).toHaveBeenCalledOnce();
  act(() => state.locate());
  expect(state.locationError).toBe("");
  succeed(1);
  expect(selectArea).toHaveBeenCalledOnce();
});

it("reports timeout without replacing the selected area", () => {
  render({ area: manualArea });
  fail(3);
  expect(state.locationError).toContain("定位超时");
  expect(selectArea).not.toHaveBeenCalled();
});

it("does not overwrite an area chosen while the permission prompt was open", () => {
  render();
  render({ area: manualArea });
  succeed();
  expect(selectArea).not.toHaveBeenCalled();
  expect(state.locating).toBe(false);
  expect(state.deviceRevision).toBe(0);
});

it("ignores late completion after leaving, and locates on the next entry", () => {
  render();
  act(() => root.render(null));
  succeed();
  expect(selectArea).not.toHaveBeenCalled();
  render();
  expect(getPosition).toHaveBeenCalledTimes(2);
  succeed(0);
  expect(state.locating).toBe(true);
  expect(selectArea).not.toHaveBeenCalled();
  succeed(1);
  expect(selectArea).toHaveBeenCalledOnce();
});

it("does not locate or accept a result while disabled", () => {
  render({ disabled: true });
  act(() => state.locate());
  expect(getPosition).not.toHaveBeenCalled();
  render({ disabled: false });
  expect(getPosition).toHaveBeenCalledOnce();
  render({ disabled: true });
  succeed();
  expect(selectArea).not.toHaveBeenCalled();
});

it("ignores results as soon as navigation starts, even before unmount", () => {
  render();
  window.history.replaceState(null, "", "/#/");
  succeed();
  expect(selectArea).not.toHaveBeenCalled();
});

it("keeps locating when only nearby filters change", () => {
  render();
  window.history.replaceState(null, "", "/#/nearby?q=面&page=2");
  succeed();
  expect(selectArea).toHaveBeenCalledOnce();
});

it("handles unsupported browsers and synchronous permission failures", () => {
  vi.stubGlobal("navigator", {});
  render();
  expect(state.locationError).toContain("不支持定位");
  expect(state.locating).toBe(false);
  vi.stubGlobal("navigator", {
    geolocation: { getCurrentPosition: getPosition },
  });
  getPosition.mockImplementation(() => {
    throw new DOMException("blocked", "SecurityError");
  });
  act(() => state.locate());
  expect(state.locationError).toContain("无法发起定位");
  expect(state.locating).toBe(false);
  expect(selectArea).not.toHaveBeenCalled();
});
