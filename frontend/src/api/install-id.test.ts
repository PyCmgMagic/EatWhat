import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.resetModules();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("install id", () => {
  it("generates a UUID v7 once and keeps it", async () => {
    const { installId, uuidV7 } = await import("./install-id");
    const v7 = uuidV7(Date.UTC(2026, 10, 15));
    expect(v7).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(parseInt(v7.replace(/-/g, "").slice(0, 12), 16)).toBe(
      Date.UTC(2026, 10, 15),
    );
    const id = installId();
    expect(installId()).toBe(id);
    expect(store.get("eatwhat.installId")).toBe(id);
  });

  it("replaces a damaged value and survives storage that throws", async () => {
    store.set("eatwhat.installId", "not-a-uuid");
    const { installId } = await import("./install-id");
    expect(installId()).not.toBe("not-a-uuid");
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    const first = installId();
    expect(installId()).toBe(first);
  });

  it("registers the device only when its profile changes and stays quiet on failure", async () => {
    const { registerDevice, installId } = await import("./install-id");
    const send = vi.fn(async (_body: unknown) => undefined);
    await registerDevice(send);
    await registerDevice(send);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({
      installId: installId(),
      platform: "web",
    });

    store.delete("eatwhat.deviceRegistered");
    const failing = vi.fn(async () => {
      throw new Error("offline");
    });
    await expect(registerDevice(failing)).resolves.toBeUndefined();
    await registerDevice(send);
    expect(send).toHaveBeenCalledTimes(2);
  });
});
