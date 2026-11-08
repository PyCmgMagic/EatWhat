import { describe, expect, it } from "vitest";
import {
  groupMapMarkers,
  overlaps,
  placeMapLabels,
  type MapLabel,
  type ProjectedShop,
} from "./map-markers";

function shop(
  key: string,
  x: number,
  y = 150,
  lng = 117 + x / 10000,
): ProjectedShop<string> {
  return { key, x, y, lng, lat: 36.67, value: key };
}
function label(key: string, x: number, selected = false): MapLabel {
  return {
    key,
    x: 0,
    y: 0,
    markerX: x,
    markerY: 150,
    width: 120,
    height: 30,
    selected,
  };
}
const bounds = { width: 360, height: 320 };

describe("restaurant marker clustering", () => {
  it("merges dense shops while retaining every shop exactly once", () => {
    const points = [
      shop("1", 100),
      shop("2", 120),
      shop("3", 150),
      shop("4", 300),
    ];
    const groups = groupMapMarkers(points);
    expect(groups.map((g) => g.members.length)).toEqual([3, 1]);
    expect(groups.flatMap((g) => g.members.map((m) => m.key)).sort()).toEqual([
      "1",
      "2",
      "3",
      "4",
    ]);
    expect(groups[0].samePlace).toBe(false);
  });
  it("produces stable cluster identities regardless of API result order", () => {
    const points = [shop("3", 140), shop("2", 120), shop("1", 100)];
    expect(groupMapMarkers(points)).toEqual(
      groupMapMarkers([...points].reverse()),
    );
  });
  it("splits clusters after zoom increases screen separation", () => {
    const points = [shop("1", 100), shop("2", 120), shop("3", 140)];
    expect(groupMapMarkers(points)).toHaveLength(1);
    expect(
      groupMapMarkers(points.map((p) => ({ ...p, x: p.x * 4 }))),
    ).toHaveLength(3);
  });
  it("recognizes colocated shops so zoom is not an endless action", () => {
    const points = [shop("1", 100, 150, 117), shop("2", 100, 150, 117)];
    expect(groupMapMarkers(points)[0].samePlace).toBe(true);
    expect(
      groupMapMarkers([points[0], { ...points[1], lng: 117.00001 }])[0]
        .samePlace,
    ).toBe(true);
    expect(
      groupMapMarkers([points[0], { ...points[1], lng: 117.0001 }])[0]
        .samePlace,
    ).toBe(false);
  });
  it("does not generate markers from invalid projection coordinates", () => {
    expect(
      groupMapMarkers([
        shop("1", NaN),
        shop("2", Infinity),
        { ...shop("3", 150), lat: NaN },
        shop("4", 200),
      ]).map((g) => g.key),
    ).toEqual(["4"]);
    expect(groupMapMarkers([])).toEqual([]);
  });
});

describe("restaurant label placement", () => {
  it("reserves space for the selected full name before ordinary names", () => {
    const chosen = label("selected", 180, true);
    const placed = placeMapLabels([label("ordinary", 180), chosen], [], bounds);
    expect([...placed.keys()][0]).toBe("selected");
    expect(placed.get("selected")?.width).toBe(120);
    if (placed.has("ordinary"))
      expect(overlaps(placed.get("selected")!, placed.get("ordinary")!)).toBe(
        false,
      );
  });
  it("avoids marker hit areas, map controls, and other visible labels", () => {
    const marker = { x: 154, y: 106, width: 52, height: 44 };
    const control = { x: 100, y: 40, width: 160, height: 65 };
    const placed = placeMapLabels(
      [label("1", 180), label("2", 240)],
      [marker],
      bounds,
      [control],
    );
    expect(placed.size).toBeGreaterThan(0);
    const rectangles = [...placed.values()];
    for (const rect of rectangles) {
      expect(overlaps(rect, marker)).toBe(false);
      expect(overlaps(rect, control)).toBe(false);
    }
    if (rectangles.length > 1)
      expect(overlaps(rectangles[0], rectangles[1])).toBe(false);
  });
  it("hides ordinary labels with no space instead of obscuring controls", () => {
    const cover = { x: 0, y: 0, ...bounds };
    expect(placeMapLabels([label("1", 180)], [], bounds, [cover]).size).toBe(0);
  });
  it("keeps selected labels within narrow map edges", () => {
    const placed = placeMapLabels(
      [{ ...label("1", 2, true), markerY: 20, width: 220, height: 66 }],
      [],
      { width: 320, height: 200 },
    );
    const rect = placed.get("1")!;
    expect(rect).toBeDefined();
    expect(rect.x).toBeGreaterThanOrEqual(8);
    expect(rect.y).toBeGreaterThanOrEqual(8);
    expect(rect.x + rect.width).toBeLessThanOrEqual(312);
    expect(rect.y + rect.height).toBeLessThanOrEqual(192);
  });
  it("does not place offscreen restaurant names over the visible map", () => {
    expect(
      placeMapLabels([label("1", -20, true), label("2", 400)], [], bounds).size,
    ).toBe(0);
  });
});
