// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import RestaurantLocationField, {
  requireShopLocation,
} from "./RestaurantLocationField";
import type { MapPoint } from "./map-geometry";
import type { MapPlace } from "../api/baidu-places";

const { lookup } = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock("../api/baidu-map", () => ({ addressForMapPoint: lookup }));
vi.mock("../mobile/ui", () => ({ DesignIcon: () => null }));
vi.mock("./RestaurantMap", () => ({ default: () => <div>地图</div> }));
let root: Root, host: HTMLDivElement;
const change = vi.fn();
const a = { gcjLng: 117.14, gcjLat: 36.66 },
  b = { gcjLng: 117.15, gcjLat: 36.67 };
async function render(
  point?: MapPoint,
  address = "",
  disabled = false,
  place?: MapPlace,
) {
  await act(async () => {
    root.render(
      <RestaurantLocationField
        place={place}
        point={point}
        onPick={vi.fn()}
        address={address}
        onAddressChange={change}
        disabled={disabled}
      />,
    );
  });
}
beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  lookup.mockReset();
  change.mockReset();
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
});

it("requires an actual map point and exposes no coordinate inputs", async () => {
  await render();
  expect(() => requireShopLocation()).toThrow("请先在地图");
  expect(() => requireShopLocation({ gcjLng: 0, gcjLat: 0 })).toThrow(
    "请先在地图",
  );
  expect(requireShopLocation(a)).toEqual(a);
  expect(host.querySelectorAll("input").length).toBe(1);
  expect(host.querySelector('input[name="address"]')).not.toBeNull();
  expect(host.textContent).toContain("请在地图选点");
  expect(lookup).not.toHaveBeenCalled();
});
it("associates failed lookup feedback with the address field", async () => {
  lookup.mockRejectedValue(new Error("provider unavailable"));
  await render(a);
  const input = host.querySelector('input[name="address"]')!;
  const hint = document.getElementById(input.getAttribute("aria-describedby")!);
  expect(hint?.textContent).toContain("未能识别地址");
  expect(host.textContent).toContain("已选店铺位置");
});
it("fills an empty address and updates an earlier automatic suggestion on repick", async () => {
  lookup
    .mockResolvedValueOnce("历城区舜华路1号")
    .mockResolvedValueOnce("历城区舜华路2号");
  await render(a);
  expect(change).toHaveBeenLastCalledWith("历城区舜华路1号");
  await render(b, "历城区舜华路1号");
  expect(change).toHaveBeenLastCalledWith("历城区舜华路2号");
});
it("keeps manually edited details when a pending lookup completes", async () => {
  let finish!: (value: string) => void;
  lookup.mockReturnValue(
    new Promise<string>((r) => {
      finish = r;
    }),
  );
  await render(a);
  await render(a, "软件园食堂二楼3号窗口");
  await act(async () => finish("地图返回的地址"));
  expect(change).not.toHaveBeenCalled();
});
it("ignores a stale response after another map point is picked", async () => {
  let first!: (value: string) => void, second!: (value: string) => void;
  lookup
    .mockReturnValueOnce(
      new Promise<string>((r) => {
        first = r;
      }),
    )
    .mockReturnValueOnce(
      new Promise<string>((r) => {
        second = r;
      }),
    );
  await render(a);
  await render(b);
  await act(async () => second("新位置地址"));
  await act(async () => first("旧位置地址"));
  expect(change).toHaveBeenCalledExactlyOnceWith("新位置地址");
});
it("keeps the selected location usable when reverse geocoding fails", async () => {
  lookup.mockRejectedValue(new Error("provider unavailable"));
  await render(a);
  expect(host.textContent).toContain("已选店铺位置");
  expect(host.textContent).toContain("未能识别地址");
  expect(
    host.querySelector<HTMLInputElement>('input[name="address"]')?.disabled,
  ).toBe(false);
  expect(change).not.toHaveBeenCalled();
});
it("does not mutate form data after submission has locked it", async () => {
  let finish!: (value: string) => void;
  lookup.mockReturnValue(
    new Promise<string>((r) => {
      finish = r;
    }),
  );
  await render(a);
  await render(a, "提交中的地址", true);
  await act(async () => finish("延迟返回的地址"));
  expect(change).not.toHaveBeenCalled();
  expect(
    host.querySelector<HTMLInputElement>('input[name="address"]')?.disabled,
  ).toBe(true);
});

it("keeps a POI address and loads the map only when requested", async () => {
  const place = { id: "1", name: "云吞店", address: "舜华路1号二层", point: a };
  await render(a, place.address, false, place);
  expect(host.querySelector<HTMLInputElement>('[name="address"]')?.value).toBe(
    place.address,
  );
  const toggle = host.querySelector("button")!;
  expect(toggle.textContent).toContain("调整位置");
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(host.querySelector(".restaurant-map-picker")?.textContent).toBe("");
  await act(async () => toggle.click());
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(host.querySelector(".restaurant-map-picker")?.textContent).toBe(
    "地图",
  );
  expect(lookup).not.toHaveBeenCalled();
});
