// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { wgsToGcj } from "../api/models";
import { useDeviceLocation } from "./useDeviceLocation";

let root: Root, host: HTMLDivElement;
let state: ReturnType<typeof useDeviceLocation>;
const getPosition = vi.fn<Geolocation["getCurrentPosition"]>();
const selectArea = vi.fn();
const position = {
  coords: { longitude: 117.134, latitude: 36.667 },
} as GeolocationPosition;
function Harness({
  selectionVersion = 0,
  autoLocate = true,
  disabled = false,
}: {
  selectionVersion?: number;
  autoLocate?: boolean;
  disabled?: boolean;
}) {
  state = useDeviceLocation({
    selectionVersion,
    autoLocate,
    disabled,
    selectArea,
  });
  return null;
}
async function render(props: Parameters<typeof Harness>[0] = {}) {
  await act(async () =>
    root.render(
      <StrictMode>
        <Harness {...props} />
      </StrictMode>,
    ),
  );
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
  window.history.replaceState(null, "", "/#/nearby");
  getPosition.mockReset();
  selectArea.mockReset();
  vi.stubGlobal("navigator", {
    geolocation: { getCurrentPosition: getPosition },
    permissions: { query: vi.fn().mockResolvedValue({ state: "granted" }) },
  });
  host = document.createElement("div");
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  vi.unstubAllGlobals();
});

it("refreshes once in StrictMode when permission is granted and publishes converted coordinates", async () => {
  await render();
  expect(getPosition).toHaveBeenCalledOnce();
  expect(state.locating).toBe(true);
  await render();
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
  await render();
  expect(getPosition).toHaveBeenCalledOnce();
});

it("does not locate automatically for other maps, but retains the manual action", async () => {
  await render({ autoLocate: false });
  expect(getPosition).not.toHaveBeenCalled();
  act(() => state.locate());
  succeed();
  expect(selectArea).toHaveBeenCalledOnce();
});

it("keeps existing area after denial, does not loop, and allows manual retry", async () => {
  await render();
  fail(1);
  expect(state.locationError).toContain("站点设置");
  expect(state.locating).toBe(false);
  expect(selectArea).not.toHaveBeenCalled();
  await render();
  expect(getPosition).toHaveBeenCalledOnce();
  act(() => state.locate());
  expect(state.locationError).toBe("");
  succeed(1);
  expect(selectArea).toHaveBeenCalledOnce();
});

it("reports timeout without replacing the selected area", async () => {
  await render();
  fail(3);
  expect(state.locationError).toContain("定位超时");
  expect(selectArea).not.toHaveBeenCalled();
});

it("explains why a LAN HTTP page cannot prompt for permission", async () => {
  vi.stubGlobal("isSecureContext", false);
  await render({ autoLocate: false });
  act(() => state.locate());
  expect(getPosition).not.toHaveBeenCalled();
  expect(state.locationError).toContain("HTTPS");
});

it("reports unavailable device coordinates separately from a permission denial", async () => {
  await render({ autoLocate: false });
  act(() => state.locate());
  fail(2);
  expect(state.locationError).toContain("设备定位");
  expect(state.locationError).not.toContain("权限");
});

it("does not overwrite an area chosen while the permission prompt was open", async () => {
  await render();
  await render({ selectionVersion: 1 });
  succeed();
  expect(selectArea).not.toHaveBeenCalled();
  expect(state.locating).toBe(false);
  expect(state.deviceRevision).toBe(0);
});

it("ignores late completion after leaving, and locates on the next entry", async () => {
  await render();
  act(() => root.render(null));
  succeed();
  expect(selectArea).not.toHaveBeenCalled();
  await render();
  expect(getPosition).toHaveBeenCalledTimes(2);
  succeed(0);
  expect(state.locating).toBe(true);
  expect(selectArea).not.toHaveBeenCalled();
  succeed(1);
  expect(selectArea).toHaveBeenCalledOnce();
});

it("does not locate or accept a result while disabled", async () => {
  await render({ disabled: true });
  act(() => state.locate());
  expect(getPosition).not.toHaveBeenCalled();
  await render({ disabled: false });
  expect(getPosition).toHaveBeenCalledOnce();
  await render({ disabled: true });
  succeed();
  expect(selectArea).not.toHaveBeenCalled();
});

it("ignores results as soon as navigation starts, even before unmount", async () => {
  await render();
  window.history.replaceState(null, "", "/#/");
  succeed();
  expect(selectArea).not.toHaveBeenCalled();
});

it("keeps locating when only nearby filters change", async () => {
  await render();
  window.history.replaceState(null, "", "/#/nearby?q=面&page=2");
  succeed();
  expect(selectArea).toHaveBeenCalledOnce();
});

it("handles unsupported browsers and synchronous permission failures", async () => {
  vi.stubGlobal("navigator", {});
  await render();
  act(() => state.locate());
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
