import { afterEach, expect, it, vi } from "vitest";
import { visualFor } from "./catalog";
import type { Food } from "../api/models";

afterEach(() => vi.unstubAllGlobals());

it("keeps uploaded photos as photos even when their names match demo dishes", () => {
  const photo: Food = {
    name: "鲜虾蟹籽云吞",
    category: "staple",
    pictureUrl: ["foods/my-photo.jpg"],
  };
  expect(visualFor(photo, true).asset).toBe("");
  expect(
    visualFor(
      { ...photo, pictureUrl: ["/prototype/assets/dishes/yuntun.svg"] },
      true,
    ).asset,
  ).toBe("yuntun");
});

it("uses the chosen stage palette on uploaded dish cards", () => {
  vi.stubGlobal("localStorage", {
    getItem: () => JSON.stringify({ "foods/my-photo.jpg": "#C9442B" }),
  });
  const visual = visualFor(
    { category: "staple", pictureUrl: ["foods/my-photo.jpg"] },
    true,
  );
  expect(visual.stage).toBe("#C9442B");
  expect(visual.tile).toBe("#F6DDD3");
});

it("keeps a deeper card tile for the darkest red stage", () => {
  expect(visualFor({ name: "锅包肉", stageColor: "redoil" }).tile).toBe(
    "#EFC5BA",
  );
  expect(visualFor({ name: "番茄牛腩饭", stageColor: "tomato" }).tile).toBe(
    "#F6DDD3",
  );
});

it("ignores invalid saved colors and uses the category palette", () => {
  vi.stubGlobal("localStorage", {
    getItem: () => JSON.stringify({ "foods/my-photo.jpg": "invalid" }),
  });
  const visual = visualFor({
    category: "cold_dish",
    pictureUrl: ["foods/my-photo.jpg"],
  });
  expect(visual.stage).toBe("#9DBF7A");
  expect(visual.tile).toBe("#E4ECD8");
});
