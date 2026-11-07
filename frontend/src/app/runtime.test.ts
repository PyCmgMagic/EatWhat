import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const values = new Map<string, string>();
const legacyValues = new Map<string, string>();
const storedSession = { tokenName: "satoken", tokenValue: "test-live-session" };

beforeEach(() => {
  vi.resetModules();
  values.clear();
  legacyValues.clear();
  vi.stubEnv("DEV", true);
  vi.stubEnv("VITE_ENABLE_DEMO", "false");
  vi.stubGlobal("location", { search: "" });
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => legacyValues.get(key) ?? null,
    setItem: (key: string, value: string) => legacyValues.set(key, value),
    removeItem: (key: string) => legacyValues.delete(key),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Mock mode and isolated sessions", () => {
  it.each(["", "?view=mobile", "?view=desktop"])(
    "uses the real account by default for %s without loading a stored demo session",
    async (search) => {
      vi.stubGlobal("location", { search });
      values.set("eatwhat-session", JSON.stringify(storedSession));
      values.set(
        "eatwhat-demo-session",
        JSON.stringify({ tokenName: "satoken", tokenValue: "mock" }),
      );
      const runtime = await import("./runtime");
      expect(runtime.isDemo).toBe(false);
      expect(runtime.readSession()).toEqual(storedSession);
    },
  );

  it("keeps a visitor logged out by default instead of creating a demo account", async () => {
    const runtime = await import("./runtime");
    expect(runtime.isDemo).toBe(false);
    expect(runtime.readSession()).toBeNull();
    expect(values.has("eatwhat-demo-session")).toBe(false);
  });

  it("opens explicitly requested development Mock without reusing a real session", async () => {
    vi.stubGlobal("location", { search: "?demo=1&view=mobile" });
    values.set("eatwhat-session", JSON.stringify(storedSession));
    const runtime = await import("./runtime");
    expect(runtime.isDemo).toBe(true);
    expect(runtime.readSession()?.tokenValue).toBe("isolated-demo-token");
    expect(values.get("eatwhat-session")).toBe(JSON.stringify(storedSession));
    expect(values.has("eatwhat-demo-session")).toBe(true);
  });

  it("keeps an explicit logout after reload and allows signing in again", async () => {
    vi.stubGlobal("location", { search: "?demo=1" });
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
    expect(values.get("eatwhat-session")).toBe("null");
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
    vi.stubGlobal("location", { search: "?demo=1" });
    vi.stubGlobal("localStorage", {
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

describe("shared persistent login", () => {
  it("keeps login and logout in memory when storage reads work but writes fail", async () => {
    values.set("eatwhat-session", JSON.stringify(storedSession));
    const runtime = await import("./runtime");
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("Quota exceeded");
    });
    runtime.writeSession(null);
    expect(runtime.readSession()).toBeNull();
    const next = { tokenName: "satoken", tokenValue: "new-memory-session" };
    runtime.writeSession(next);
    expect(runtime.readSession()).toEqual(next);
    vi.restoreAllMocks();
    runtime.writeSession(next);
    expect(values.get("eatwhat-session")).toBe(JSON.stringify(next));
  });

  it("restores a login in a new tab with empty sessionStorage", async () => {
    const firstTab = await import("./runtime");
    firstTab.writeSession(storedSession);
    legacyValues.clear();
    vi.resetModules();
    const secondTab = await import("./runtime");
    expect(secondTab.readSession()).toEqual(storedSession);
    secondTab.writeSession(null);
    expect(firstTab.readSession()).toBeNull();
    vi.resetModules();
    expect((await import("./runtime")).readSession()).toBeNull();
  });

  it("migrates the current tab's old login without copying unrelated tab state", async () => {
    legacyValues.set("eatwhat-session", JSON.stringify(storedSession));
    legacyValues.set("eatwhat:live:draft:profile:10", "draft");
    const runtime = await import("./runtime");
    expect(runtime.readSession()).toEqual(storedSession);
    expect(values.get("eatwhat-session")).toBe(JSON.stringify(storedSession));
    expect(legacyValues.has("eatwhat-session")).toBe(false);
    expect(legacyValues.get("eatwhat:live:draft:profile:10")).toBe("draft");
  });

  it.each(["null", JSON.stringify(storedSession)])(
    "keeps shared state %s instead of resurrecting another tab's old login",
    async (shared) => {
      values.set("eatwhat-session", shared);
      legacyValues.set(
        "eatwhat-session",
        JSON.stringify({ tokenName: "satoken", tokenValue: "old-account" }),
      );
      const runtime = await import("./runtime");
      expect(runtime.readSession()).toEqual(JSON.parse(shared));
      expect(legacyValues.has("eatwhat-session")).toBe(false);
    },
  );

  it("migrates a Mock logout without importing a real account", async () => {
    vi.stubGlobal("location", { search: "?demo=1" });
    legacyValues.set("eatwhat-session", JSON.stringify(storedSession));
    legacyValues.set("eatwhat-demo-session", "null");
    const runtime = await import("./runtime");
    expect(runtime.readSession()).toBeNull();
    expect(values.get("eatwhat-demo-session")).toBe("null");
    expect(values.has("eatwhat-session")).toBe(false);
    expect(legacyValues.has("eatwhat-session")).toBe(true);
  });

  it.each([
    null,
    "null",
    "broken-json",
    "{}",
    '{"tokenName":"","tokenValue":"x"}',
  ])(
    "does not restore an in-memory login after storage changes to %s",
    async (raw) => {
      const runtime = await import("./runtime");
      runtime.writeSession(storedSession);
      if (raw === null) values.delete("eatwhat-session");
      else values.set("eatwhat-session", raw);
      expect(runtime.readSession()).toBeNull();
    },
  );

  it("notifies only for this mode's shared storage, reads current state and unsubscribes", async () => {
    const target = new EventTarget();
    vi.stubGlobal("window", target);
    const runtime = await import("./runtime");
    const listener = vi.fn();
    const unsubscribe = runtime.subscribeSession(listener);
    const dispatch = (key: string | null, storageArea = localStorage) => {
      target.dispatchEvent(
        Object.assign(new Event("storage"), { key, storageArea }),
      );
    };
    values.set("eatwhat-session", JSON.stringify(storedSession));
    dispatch("eatwhat-demo-session");
    dispatch("eatwhat-area");
    dispatch("eatwhat-session", sessionStorage);
    expect(listener).not.toHaveBeenCalled();
    dispatch("eatwhat-session");
    expect(listener).toHaveBeenLastCalledWith(storedSession);
    values.clear();
    dispatch(null);
    expect(listener).toHaveBeenLastCalledWith(null);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    dispatch("eatwhat-session");
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
