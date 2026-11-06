// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  history.replaceState(null, "", "/?demo=1#/foods/1");
});

it("records actual restaurant visits through the v4 handler, but not dish-address lookups", async () => {
  const { demoTransport } = await import("./transport");
  const records = () =>
    JSON.parse(localStorage.getItem("eatwhat-demo-prototype-v3")!).history;
  await demoTransport("/foods/detail/1", {});
  await demoTransport("/restaurant/detail/1", {});
  expect(records()).toHaveLength(1);
  expect(records()[0].type).toBeUndefined();

  history.replaceState(null, "", "/?demo=1#/restaurants/1");
  await demoTransport("/restaurant/detail/1", {});
  await demoTransport("/restaurant/detail/1", {});
  expect(records()).toHaveLength(2);
  expect(records()[0]).toMatchObject({ id: 1, type: "restaurant" });

  await demoTransport("/history/browse", {
    method: "DELETE",
    query: { targetType: "food" },
  });
  expect(records()).toEqual([
    expect.objectContaining({ id: 1, type: "restaurant" }),
  ]);
  await demoTransport("/history/browse", { method: "DELETE" });
  expect(records()).toEqual([]);
});

it("does not record a restaurant detail that failed to load", async () => {
  const { demoTransport } = await import("./transport");
  history.replaceState(null, "", "/?demo=1#/restaurants/999999");
  await expect(
    demoTransport("/restaurant/detail/999999", {}),
  ).rejects.toBeDefined();
  const response = await demoTransport("/history/browse", {
    query: { targetType: "restaurant" },
  });
  expect(response.data).toMatchObject({ items: [], totalItems: 0 });
});
