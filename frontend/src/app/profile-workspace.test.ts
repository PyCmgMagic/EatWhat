import { describe, expect, it } from "vitest";
import { profileSection, profileSections } from "./profile-workspace";

describe("personal workspace information architecture", () => {
  it("offers one primary destination for each personal task", () => {
    expect(profileSections.map((section) => section.to)).toEqual([
      "/me",
      "/me/shares",
      "/favorites",
      "/me/growth",
      "/history",
      "/settings",
      "/help",
    ]);
  });

  it.each([
    ["/me", "/me"],
    ["/features", "/features"],
    ["/me/growth", "/me/growth"],
    ["/me/shares", "/me/shares"],
    ["/submissions", "/me/shares"],
    ["/submissions/revision-123", "/me/shares"],
    ["/favorites", "/favorites"],
    ["/restaurants/favorites", "/favorites"],
    ["/me/tags", "/favorites"],
    ["/me/tags/101/foods", "/favorites"],
    ["/history", "/history"],
    ["/settings", "/settings"],
    ["/settings/account", "/settings"],
    ["/me/edit", "/settings"],
    ["/me/details", "/settings"],
    ["/verify", "/settings"],
    ["/auth/account-recovery", "/settings"],
    ["/help", "/help"],
    ["/feedback", "/help"],
    ["/feedback/mine", "/help"],
    ["/feedback/mine/123", "/help"],
    ["/reports/new", "/help"],
    ["/restaurants/correction", "/help"],
  ])("keeps %s in its task section %s", (path, section) => {
    expect(profileSection(path)).toBe(section);
  });

  it.each([
    "/",
    "/nearby",
    "/restaurants/directory",
    "/notifications",
    "/announcements",
    "/search",
    "/foods/1",
    "/restaurants/1",
    "/publish",
  ])("does not turn the public page %s into a personal workspace", (path) =>
    expect(profileSection(path)).toBeNull(),
  );
});
