import { it, expect, vi } from "vitest";
import { hasCoordinates, mediaUrl, money, parseId, wgsToGcj } from "./models";
it("displays uploaded demo photos only in explicitly enabled Mock mode", () => {
  const photo = "data:image/jpeg;base64,dGVzdA==";
  try {
    vi.stubEnv("DEV", true);
    vi.stubGlobal("location", { search: "" });
    expect(mediaUrl(photo)).toBeUndefined();
    vi.stubGlobal("location", { search: "?demo=1" });
    expect(mediaUrl(photo)).toBe(photo);
    vi.stubGlobal("location", { search: "?demo=0" });
    expect(mediaUrl(photo)).toBeUndefined();
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_ENABLE_DEMO", "false");
    vi.stubGlobal("location", { search: "?demo=1" });
    expect(mediaUrl(photo)).toBeUndefined();
  } finally {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  }
});
it("keeps zero prices distinct from unknown prices", () => {
  expect(money(0)).toBe("¥0");
  expect(money(null)).toBe("价格待补充");
});
it("rejects unsafe or invalid route IDs and location coordinates", () => {
  expect(parseId("0")).toBeUndefined();
  expect(parseId("9223372036854775807")).toBeUndefined();
  expect(parseId("12")).toBe(12);
  expect(hasCoordinates({ gcjLng: NaN, gcjLat: 36 })).toBe(false);
  expect(hasCoordinates({ gcjLng: 117, gcjLat: 36 })).toBe(true);
});
it("converts WGS84 positions before a GCJ02 search and rejects unsupported positions", () => {
  const p = wgsToGcj(116.404, 39.915);
  expect(p.gcjLng).toBeCloseTo(116.4102445, 5);
  expect(p.gcjLat).toBeCloseTo(39.9164043, 5);
  expect(() => wgsToGcj(-122, 37)).toThrow("暂不支持");
});
