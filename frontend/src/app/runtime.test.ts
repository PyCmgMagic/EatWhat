import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const values = new Map<string, string>();
const storedSession = { tokenName: "satoken", tokenValue: "test-live-session" };

beforeEach(() => {
  vi.resetModules();
  values.clear();
  vi.stubEnv("DEV", true);
  vi.stubEnv("VITE_ENABLE_DEMO", "false");
  vi.stubGlobal("location", { search: "" });
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Mock mode and isolated sessions", () => {
  it("opens development in Mock without reusing a real session", async () => {
    values.set("eatwhat-session", JSON.stringify(storedSession));
    const runtime = await import("./runtime");
    expect(runtime.isDemo).toBe(true);
    expect(runtime.readSession()?.tokenValue).toBe("isolated-demo-token");
    expect(values.get("eatwhat-session")).toBe(JSON.stringify(storedSession));
    expect(values.has("eatwhat-demo-session")).toBe(true);
  });

  it("keeps an explicit logout after reload and allows signing in again", async () => {
    const runtime = await import("./runtime");
    runtime.writeSession(null);
    expect(runtime.readSession()).toBeNull();
    vi.resetModules();
    const reloaded = await import("./runtime");
    expect(reloaded.readSession()).toBeNull();
    reloaded.writeSession({
      tokenName: "satoken",
      tokenValue: "isolated-demo-token",
    });
    vi.resetModules();
    expect((await import("./runtime")).readSession()?.tokenValue).toBe(
      "isolated-demo-token",
    );
  });

  it("uses only the real session when explicitly opting out of Mock", async () => {
    vi.stubGlobal("location", { search: "?demo=0&view=desktop" });
    values.set("eatwhat-session", JSON.stringify(storedSession));
    values.set(
      "eatwhat-demo-session",
      JSON.stringify({ tokenName: "satoken", tokenValue: "mock" }),
    );
    const runtime = await import("./runtime");
    expect(runtime.isDemo).toBe(false);
    expect(runtime.readSession()).toEqual(storedSession);
    runtime.writeSession(null);
    expect(values.has("eatwhat-session")).toBe(false);
    expect(values.has("eatwhat-demo-session")).toBe(true);
  });

  it("does not enable production Mock from a URL alone", async () => {
    vi.stubEnv("DEV", false);
    vi.stubGlobal("location", { search: "?demo=1" });
    const runtime = await import("./runtime");
    expect(runtime.isDemo).toBe(false);
    expect(runtime.readSession()).toBeNull();
  });

  it("requires both the production demo build flag and the explicit URL", async () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_ENABLE_DEMO", "true");
    expect((await import("./runtime")).isDemo).toBe(false);
    vi.resetModules();
    vi.stubGlobal("location", { search: "?demo=1" });
    expect((await import("./runtime")).isDemo).toBe(true);
  });

  it("still supports Mock login and logout when browser storage is unavailable", async () => {
    vi.stubGlobal("sessionStorage", {
      getItem() {
        throw new Error("Storage unavailable");
      },
      setItem() {
        throw new Error("Storage unavailable");
      },
      removeItem() {
        throw new Error("Storage unavailable");
      },
    });
    const runtime = await import("./runtime");
    expect(runtime.readSession()?.tokenValue).toBe("isolated-demo-token");
    runtime.writeSession(null);
    expect(runtime.readSession()).toBeNull();
  });
});
