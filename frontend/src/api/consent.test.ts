import { describe, expect, it, vi } from "vitest";
import { createApi, classifyAuth } from "./service";
import { createTransport } from "./client";

describe("legacy consent API compatibility (no UI entry)", () => {
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
    expect(classifyAuth({ code: 0, data: status }).kind).toBe("error");
  });
  it("rejects failed or missing status responses instead of inventing consent fields", async () => {
    const failed = createApi(async () => ({ code: 20006, data: null }));
    await expect(failed.consent()).rejects.toMatchObject({ code: 20006 });
    const missing = createApi(async () => ({ code: 0, data: null }));
    await expect(missing.consent()).rejects.toMatchObject({
      code: "MISSING_DATA",
    });
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
    ).toBe("error");
  });
});
