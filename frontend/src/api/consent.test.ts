import { describe, expect, it, vi } from "vitest";
import {
  policyDocumentUrl,
  policyIdentity,
  requirePolicyAcceptance,
  type ConsentPolicy,
} from "./consent";
import { createApi, classifyAuth } from "./service";
import { createTransport } from "./client";

const policy: ConsentPolicy = {
  version: "policy-v3",
  url: "/api/policies/policy-v3.html",
};
describe("explicit current-policy consent", () => {
  it("reads the three-field status without treating granted consent as a login session", async () => {
    const status = {
      status: "GRANTED",
      identityReady: true,
      policyVersion: "accepted-policy-v2",
    };
    const transport = vi.fn(async () => ({ code: 0, data: status }));
    const api = createApi(transport);
    await expect(api.consent()).resolves.toEqual(status);
    expect(transport).toHaveBeenCalledWith("/auth/consent", {});
    expect(classifyAuth({ code: 0, data: status }).kind).toBe("consent");
  });
  it("rejects failed or missing status responses instead of inventing consent fields", async () => {
    const failed = createApi(async () => ({ code: 20006, data: null }));
    await expect(failed.consent()).rejects.toMatchObject({ code: 20006 });
    const missing = createApi(async () => ({ code: 0, data: null }));
    await expect(missing.consent()).rejects.toMatchObject({
      code: "MISSING_DATA",
    });
  });
  it("requires a loaded policy and explicit acceptance of its exact version and document", () => {
    expect(() => requirePolicyAcceptance("")).toThrow("尚未加载");
    expect(() => requirePolicyAcceptance("", policy)).toThrow("请先阅读");
    const accepted = policyIdentity(policy);
    expect(requirePolicyAcceptance(accepted, policy)).toEqual({
      crossBorderConsent: true,
      consentPolicyVersion: "policy-v3",
    });
    expect(() =>
      requirePolicyAcceptance(accepted, {
        ...policy,
        version: "policy-v4",
      }),
    ).toThrow("已更新");
    expect(() =>
      requirePolicyAcceptance(accepted, {
        ...policy,
        url: "/api/policies/changed.html",
      }),
    ).toThrow("已更新");
  });
  it("resolves site-absolute and HTTPS URLs without repeating the API prefix", () => {
    expect(policyDocumentUrl(policy, "https://eat.v50to.you/api")).toBe(
      "https://eat.v50to.you/api/policies/policy-v3.html",
    );
    expect(
      policyDocumentUrl({
        ...policy,
        url: "https://docs.example.test/policy.html",
      }),
    ).toBe("https://docs.example.test/policy.html");
    for (const url of [
      null,
      "",
      "//other.test/x",
      "javascript:alert(1)",
      "data:text/html,x",
      "http://other.test/x",
      "relative.html",
    ])
      expect(policyDocumentUrl({ ...policy, url })).toBeUndefined();
    expect(policyIdentity({ ...policy, url: null })).toBe("");
    expect(() =>
      requirePolicyAcceptance("anything", { ...policy, url: null }),
    ).toThrow();
  });
  it("keeps proof-only consent requests public and session-based grants authenticated", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(
        async () => new Response(JSON.stringify({ code: 0, data: null })),
      );
    const api = createApi(
      createTransport(
        "/api",
        () => ({ tokenName: "x-session", tokenValue: "old-session" }),
        fetcher,
      ),
    );
    await api.grantConsent({
      proof: "one-time-proof",
      policyVersion: "policy-v3",
    });
    await api.grantConsent({ policyVersion: "policy-v3" });
    expect(
      new Headers(fetcher.mock.calls[0][1]?.headers).has("x-session"),
    ).toBe(false);
    expect(
      new Headers(fetcher.mock.calls[1][1]?.headers).get("x-session"),
    ).toBe("Bearer old-session");
    expect(
      classifyAuth({
        code: 0,
        data: {
          status: "GRANTED",
          identityReady: true,
          registrationAccepted: true,
        },
      }).kind,
    ).toBe("consent");
  });
});
