import { describe, expect, it } from "vitest";
import { retiredRouteDestination } from "./retired-routes";

describe("retired cross-site bookmarks", () => {
  it.each(["/auth/consent", "/auth/consent-offer", "/auth/withdraw-consent/"])(
    "returns %s to login or account settings without reopening authorization",
    (path) => {
      expect(retiredRouteDestination(path, "", false)).toBe("/auth/password");
      expect(retiredRouteDestination(path, "", true)).toBe("/settings/account");
      expect(retiredRouteDestination(path, "?next=%2Ffoods%2F12", true)).toBe(
        "/foods/12",
      );
      expect(retiredRouteDestination(path, "?next=%2Ffoods%2F12", false)).toBe(
        "/auth/password?next=%2Ffoods%2F12",
      );
    },
  );
  it.each([
    "https://example.com",
    "//example.com",
    "/auth/consent",
    "/\\example.com",
  ])("discards unsafe or circular destinations: %s", (next) =>
    expect(
      retiredRouteDestination(
        "/auth/consent",
        "?next=" + encodeURIComponent(next),
        false,
      ),
    ).toBe("/auth/password"),
  );
  it.each([
    "/auth/password",
    "/verify",
    "/settings/telemetry",
    "/settings/privacy",
  ])("leaves independent flows intact: %s", (path) =>
    expect(retiredRouteDestination(path, "", true)).toBeNull(),
  );
});
