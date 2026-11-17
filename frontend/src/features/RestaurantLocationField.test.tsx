// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import RestaurantLocationField, {
  requireShopLocation,
} from "./RestaurantLocationField";
import type { MapPoint } from "./map-geometry";

const { lookup } = vi.hoisted(() => ({ lookup: vi.fn() }));
const { search } = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock("../api/baidu-map", () => ({ addressForMapPoint: lookup }));
vi.mock("../api/baidu-places", () => ({ searchMapPlaces: search }));
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
  compact = false,
) {
  await act(async () => {
    root.render(
      <RestaurantLocationField
        name=""
        onNameChange={vi.fn()}
        point={point}
        onPick={vi.fn()}
        address={address}
        onAddressChange={change}
        disabled={disabled}
        compact={compact}
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
  search.mockReset();
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
  expect(host.querySelectorAll("input").length).toBe(2);
  expect(host.querySelector('input[name="address"]')).not.toBeNull();
  expect(host.textContent).toContain("请在地图选点");
  expect(lookup).not.toHaveBeenCalled();
});
it("keeps the compact form quiet until there is useful status to show", async () => {
  await render(undefined, "", false, true);
  expect(host.textContent).not.toContain("输入即匹配百度地图地点");
  expect(host.textContent).not.toContain("核对地址后");
  expect(
    host
      .querySelector('input[type="search"]')
      ?.getAttribute("aria-describedby"),
  ).toBeNull();
  expect(host.textContent).toContain("请在地图选点");
});
it("keeps a failed address lookup visible and associated with the compact address field", async () => {
  lookup.mockRejectedValue(new Error("provider unavailable"));
  await render(a, "", false, true);
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

function SearchForm() {
  const [name, setName] = useState("待查店名"),
    [address, setAddress] = useState("");
  const [point, setPoint] = useState<MapPoint>();
  return (
    <RestaurantLocationField
      name={name}
      onNameChange={setName}
      address={address}
      onAddressChange={setAddress}
      point={point}
      onPick={setPoint}
    />
  );
}
async function beginSearch() {
  await act(async () => root.render(<SearchForm />));
  const input = host.querySelector('input[type="search"]')!;
  const enter = new KeyboardEvent("keydown", {
    key: "Enter",
    bubbles: true,
    cancelable: true,
  });
  await act(async () => {
    input.dispatchEvent(enter);
  });
  expect(enter.defaultPrevented).toBe(true);
}
it("fills a POI's precise address and prevents reverse geocoding from replacing it", async () => {
  search.mockResolvedValue([
    { id: "1", name: "云吞店", address: "舜华路1号二层", point: a },
  ]);
  await beginSearch();
  const result = host.querySelector<HTMLButtonElement>(
    ".restaurant-place-results button",
  )!;
  expect(result.type).toBe("button");
  await act(async () => result.click());
  expect(host.querySelector<HTMLInputElement>('[name="address"]')?.value).toBe(
    "舜华路1号二层",
  );
  expect(host.textContent).toContain("已选店铺位置");
  expect(host.textContent).toContain("已填入“云吞店”");
  expect(lookup).not.toHaveBeenCalled();
});
it("ignores a result that arrives after the user changes the query", async () => {
  let finish!: (value: unknown) => void;
  search.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  await beginSearch();
  const input = host.querySelector<HTMLInputElement>('input[type="search"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, "新关键词");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () =>
    finish([{ id: "old", name: "旧结果", address: "旧地址", point: a }]),
  );
  expect(host.querySelector(".restaurant-place-results")).toBeNull();
  expect(host.textContent).not.toContain("旧结果");
});
it("leaves map selection available after an empty search", async () => {
  search.mockResolvedValue([]);
  await beginSearch();
  expect(host.textContent).toContain("没有找到这个地点");
  expect(host.textContent).toContain("地图");
  expect(host.textContent).toContain("请在地图选点");
});

async function typeKeyword(value: string) {
  const input = host.querySelector<HTMLInputElement>('input[type="search"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}
it("matches after typing pauses and cancels the pending match when cleared", async () => {
  vi.useFakeTimers();
  search.mockResolvedValue([]);
  await act(async () => root.render(<SearchForm />));
  await typeKeyword("三");
  await advance(200);
  await typeKeyword("三江源");
  await advance(200);
  expect(search).not.toHaveBeenCalled();
  await advance(100);
  expect(search).toHaveBeenCalledExactlyOnceWith(
    "三江源",
    undefined,
    expect.any(AbortSignal),
  );
  await typeKeyword("三江源牛肉面");
  await typeKeyword("");
  await advance(1000);
  expect(search).toHaveBeenCalledTimes(1);
  expect(host.querySelector(".restaurant-place-results")).toBeNull();
});
it("waits for a committed Chinese composition and Enter does not duplicate it", async () => {
  vi.useFakeTimers();
  search.mockResolvedValue([]);
  await act(async () => root.render(<SearchForm />));
  const input = host.querySelector('input[type="search"]')!;
  await act(async () => {
    input.dispatchEvent(
      new CompositionEvent("compositionstart", { bubbles: true }),
    );
  });
  await typeKeyword("sanjiangyuan");
  await advance(1000);
  await act(async () => {
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  expect(search).not.toHaveBeenCalled();
  await typeKeyword("三江源");
  await act(async () => {
    input.dispatchEvent(
      new CompositionEvent("compositionend", { bubbles: true, data: "三江源" }),
    );
  });
  await act(async () => {
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await advance(1000);
  expect(search).toHaveBeenCalledExactlyOnceWith(
    "三江源",
    undefined,
    expect.any(AbortSignal),
  );
});
it("keeps a selected place closed instead of searching its filled-in name again", async () => {
  vi.useFakeTimers();
  search.mockResolvedValue([
    { id: "1", name: "三江源牛肉面", address: "舜华路1号", point: a },
  ]);
  await act(async () => root.render(<SearchForm />));
  await typeKeyword("三江源");
  await advance(300);
  await act(async () =>
    host
      .querySelector<HTMLButtonElement>(".restaurant-place-results button")!
      .click(),
  );
  await advance(1000);
  expect(search).toHaveBeenCalledTimes(1);
  expect(host.querySelector(".restaurant-place-results")).toBeNull();
  expect(host.textContent).toContain("已填入“三江源牛肉面”");
});
it("keeps the newest automatic matches when older searches finish last", async () => {
  vi.useFakeTimers();
  let finishOld!: (value: unknown) => void;
  search
    .mockReturnValueOnce(
      new Promise((resolve) => {
        finishOld = resolve;
      }),
    )
    .mockResolvedValueOnce([
      { id: "new", name: "三江源牛肉面", address: "新地址", point: a },
    ]);
  await act(async () => root.render(<SearchForm />));
  await typeKeyword("三江");
  await advance(300);
  await typeKeyword("三江源");
  await advance(300);
  await act(async () =>
    finishOld([{ id: "old", name: "旧查询结果", address: "旧地址", point: b }]),
  );
  expect(host.textContent).toContain("三江源牛肉面");
  expect(host.textContent).not.toContain("旧查询结果");
});
