import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { createApiProxy } from "../../config/api-proxy";

describe("business gateway proxy", () => {
  it("does not enable a remote proxy without configuration", () => {
    expect(createApiProxy()).toBeUndefined();
    expect(createApiProxy(" ")).toBeUndefined();
  });
  it("preserves paths for existing origin-only gateway deployments", () => {
    const proxy = createApiProxy("https://example.com")!;
    expect(proxy.target).toBe("https://example.com");
    expect(proxy.rewrite!("/api/foods/list?page=1")).toBe(
      "/api/foods/list?page=1",
    );
  });
  it("maps a full gateway base without duplicating or stripping controller prefixes", () => {
    const proxy = createApiProxy("https://eat.v50to.you/api/")!;
    expect(proxy.target).toBe("https://eat.v50to.you");
    expect(proxy.rewrite!("/api/foods/list?minPrice=0&page=2")).toBe(
      "/api/foods/list?minPrice=0&page=2",
    );
    expect(proxy.rewrite!("/api/api/location/provinces")).toBe(
      "/api/api/location/provinces",
    );
    expect(proxy.rewrite!("/api?check=1")).toBe("/api?check=1");
  });
  it("removes the browser Origin from upstream proxy requests", () => {
    const proxy = createApiProxy("https://eat.v50to.you/api")!;
    const server = new EventEmitter();
    proxy.configure!(
      server as Parameters<NonNullable<typeof proxy.configure>>[0],
      proxy,
    );
    const request = { removeHeader: vi.fn() };
    server.emit("proxyReq", request);
    expect(request.removeHeader).toHaveBeenCalledWith("origin");
  });
});
