// @vitest-environment jsdom
import { beforeEach, expect, it, vi, afterEach } from "vitest";
import {
  claimVerificationReturn,
  readVerificationCallback,
  rememberVerificationReturn,
  verificationCallbackUrl,
  verificationDestination,
  verificationReturn,
  verificationReturnKey,
} from "./verification-return";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
it("normalizes the actual fixed server callback into the verification result, not home", () => {
  expect(
    verificationCallbackUrl("https://eat.v50to.you/home?result=success&code=0"),
  ).toBe("/#/verify?result=success&code=0");
  expect(
    verificationCallbackUrl(
      "https://eat.v50to.you/home?result=failure&code=30012",
    ),
  ).toBe("/#/verify?result=failure&code=30012");
  expect(
    verificationCallbackUrl(
      "https://eat.v50to.you/app/auth/callback?result=success&code=0",
    ),
  ).toBe("/#/verify?result=success&code=0");
});
it("keeps preview preferences but never copies arbitrary callback credentials or redirect targets", () => {
  expect(
    verificationCallbackUrl(
      "https://app.test/home?demo=0&view=mobile&result=success&code=0&token=secret&state=secret&next=https://evil.test",
    ),
  ).toBe("/?demo=0&view=mobile#/verify?result=success&code=0");
});
it.each([
  "https://app.test/",
  "https://app.test/home",
  "https://app.test/home?result=unknown",
  "https://app.test/foods/7?result=success&code=0",
  "https://app.test/home?result=success&code=0#/foods/7",
])("does not change a normal navigation: %s", (url) => {
  expect(verificationCallbackUrl(url)).toBeUndefined();
});
it("treats callback values as hints and rejects malformed values", () => {
  expect(readVerificationCallback("?result=success&code=0")).toEqual({
    result: "success",
    code: "0",
  });
  expect(readVerificationCallback("?result=failure&code=<script>")).toEqual({
    result: "failure",
    code: "",
  });
  expect(readVerificationCallback("?result=verified")).toBeUndefined();
});
it.each([
  "//evil.test",
  "https://evil.test",
  "/\\evil.test",
  "/auth/password",
  "/verify?next=/verify",
  "/home?result=success",
])("rejects an unsafe or recursive origin: %s", (path) => {
  expect(verificationDestination(path)).toBeUndefined();
});
it("keeps the page and its query when a new noopener tab receives the callback", () => {
  rememberVerificationReturn(10, "/foods/71?from=nearby");
  sessionStorage.clear();
  const result = verificationReturn(10);
  expect(result.intent?.returnTo).toBe("/foods/71?from=nearby");
  claimVerificationReturn(result.intent!);
  expect(localStorage.getItem(verificationReturnKey)).toBeNull();
  expect(verificationReturn(10).intent?.returnTo).toBe("/foods/71?from=nearby");
  expect(
    Object.keys(
      JSON.parse(sessionStorage.getItem(verificationReturnKey)!),
    ).sort(),
  ).toEqual(["accountId", "expiresAt", "id", "returnTo"]);
});
it("keeps per-tab origins independent from a later request in another tab", () => {
  rememberVerificationReturn(10, "/foods/71");
  const own = sessionStorage.getItem(verificationReturnKey)!;
  rememberVerificationReturn(10, "/restaurants/9");
  sessionStorage.setItem(verificationReturnKey, own);
  expect(verificationReturn(10).intent?.returnTo).toBe("/foods/71");
});
it("does not restore another account's origin", () => {
  rememberVerificationReturn(10, "/foods/71");
  expect(verificationReturn(20)).toEqual({
    intent: undefined,
    accountChanged: true,
  });
});
it("expires recovery context and tolerates unavailable browser storage", () => {
  vi.useFakeTimers();
  rememberVerificationReturn(10, "/foods/71");
  vi.advanceTimersByTime(31 * 60 * 1000);
  expect(verificationReturn(10)).toEqual({
    intent: undefined,
    accountChanged: false,
  });
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("unavailable");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("unavailable");
  });
  expect(() => rememberVerificationReturn(10, "/foods/71")).not.toThrow();
  expect(verificationReturn(10).intent).toBeUndefined();
});
