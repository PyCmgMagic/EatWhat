import { describe, expect, it } from "vitest";
import {
  adminModules,
  isAdminPath,
  resolveAdminRoute,
  safeAdminWorkspace,
  safeFrontWorkspace,
} from "./admin-routes";

describe("independent admin routes", () => {
  // Backend v2 has no review queues, topics, tag editing or security reviews.
  it("gives all thirteen v2 modules a unique canonical destination", () => {
    expect(adminModules).toHaveLength(13);
    expect(new Set(adminModules.map((m) => m.path)).size).toBe(13);
    for (const m of adminModules)
      expect(resolveAdminRoute(m.path).module?.id).toBe(m.id);
  });
  it("migrates old directory bookmarks and preserves filters", () => {
    expect(
      resolveAdminRoute("/admin", "?tab=restaurants&keyword=%E4%BA%91%E9%A5%BA")
        .redirect,
    ).toBe("/admin/restaurants?keyword=%E4%BA%91%E9%A5%BA");
    expect(resolveAdminRoute("/admin", "?tab=users").redirect).toBe(
      "/admin/users",
    );
  });
  it("migrates old operations bookmarks without exposing the internal version route", () => {
    expect(resolveAdminRoute("/admin/v4", "?tab=config").redirect).toBe(
      "/admin/config",
    );
    expect(resolveAdminRoute("/admin/v4").redirect).toBe("/admin/feedback");
    // Retired modules fall back to the overview.
    expect(resolveAdminRoute("/admin/v4", "?tab=topics").redirect).toBe(
      "/admin",
    );
  });
  it("does not mistake front paths for backend routes", () => {
    expect(isAdminPath("/admin/comments")).toBe(true);
    expect(isAdminPath("/administrator")).toBe(false);
    expect(resolveAdminRoute("/admin/not-a-module").module).toBeUndefined();
  });
  it("allows only local destinations of the requested workspace", () => {
    for (const value of [
      "https://example.com",
      "//example.com",
      "/\\example.com",
      "/admin/comments\n",
      "/admin/not-a-module",
      "/me",
      "/auth",
    ])
      expect(safeAdminWorkspace(value)).toBeUndefined();
    expect(safeAdminWorkspace("/admin/v4?tab=feedback")).toBe(
      "/admin/feedback",
    );
    expect(safeAdminWorkspace("/admin/foods?keyword=面&page=2")).toBe(
      "/admin/foods?keyword=面&page=2",
    );
    for (const value of [
      "https://example.com",
      "//example.com",
      "/admin",
      "/admin/comments",
      "/auth/password",
      "/reference/G-Me",
      "/design",
      "/me\r\n",
    ])
      expect(safeFrontWorkspace(value)).toBeUndefined();
    expect(safeFrontWorkspace("/foods/1?section=comments")).toBe(
      "/foods/1?section=comments",
    );
  });
});
