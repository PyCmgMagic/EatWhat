import { describe, expect, it } from "vitest";
import { isPhoneAuthPath, normalizeAuthRoute } from "./auth-routes";

describe("phone-only registration routes", () => {
  it.each(["/auth/username-register", "/auth/username-register/"])(
    "maps the obsolete %s route to SMS registration without losing its return target",
    (path) => {
      expect(normalizeAuthRoute(path)).toBe("/auth/register");
      expect(
        normalizeAuthRoute(
          path + "?next=%2Ffoods%2F91%3Fsection%3Dcomments#help",
        ),
      ).toBe("/auth/register?next=%2Ffoods%2F91%3Fsection%3Dcomments#help");
      expect(isPhoneAuthPath(path)).toBe(true);
    },
  );
  it.each([
    "/auth",
    "/auth/password",
    "/auth/forgot",
    "/settings/username",
    "/auth/username-register-extra",
  ])("leaves the separate %s flow unchanged", (path) => {
    expect(normalizeAuthRoute(path)).toBe(path);
    expect(isPhoneAuthPath(path)).toBe(false);
  });
  it.each(["/auth/register", "/auth/register/", "/auth/register/confirm"])(
    "renders the SMS form at %s",
    (path) => expect(isPhoneAuthPath(path)).toBe(true),
  );
});
