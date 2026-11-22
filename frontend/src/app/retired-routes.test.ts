import { describe, expect, it } from "vitest";
import { retiredRouteDestination } from "./retired-routes";

it.each(["/settings/about/us", "/settings/about/us/"])(
  "opens the About directory for a saved link to %s",
  (path) => {
    expect(retiredRouteDestination(path, "", false)).toBe("/settings/about");
    expect(retiredRouteDestination(path, "", true)).toBe("/settings/about");
  },
);

it.each(["/settings/telemetry", "/settings/telemetry/"])(
  "opens privacy settings for a saved statistics link to %s",
  (path) => {
    expect(retiredRouteDestination(path, "", true)).toBe("/settings/privacy");
    expect(retiredRouteDestination(path, "", false)).toBe("/settings/privacy");
  },
);

it.each([false, true])(
  "redirects legacy username registration to SMS registration, signed in: %s",
  (signedIn) => {
    for (const path of [
      "/auth/username-register",
      "/auth/username-register/",
    ]) {
      expect(
        retiredRouteDestination(path, "?next=%2Fsettings%2Fpassword", signedIn),
      ).toBe("/auth/register?next=%2Fsettings%2Fpassword");
    }
  },
);

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
    "/settings/privacy",
    "/settings/delete",
    "/settings/notifications",
    "/me/growth",
  ])("leaves independent flows intact: %s", (path) =>
    expect(retiredRouteDestination(path, "", true)).toBeNull(),
  );
  it.each([
    ["/topics/current", "/"],
    ["/submissions/abc", "/me"],
  ])("sends features backend v2 lacks elsewhere: %s", (path, target) =>
    expect(retiredRouteDestination(path, "", true)).toBe(target),
  );
});
