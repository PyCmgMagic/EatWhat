import { createServer, type Server, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer as createViteServer, type ViteDevServer } from "vite";
import { createUploadProxy } from "../../config/upload-proxy";
import { UPLOAD_PROXY_PREFIX } from "./upload-target";

const bucket =
  "https://" + "a".repeat(32) + ".r2.cloudflarestorage.com/eatwhat";
const query =
  "?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=" +
  "a".repeat(64) +
  "&X-Amz-SignedHeaders=content-type%3Bhost&X-Amz-Credential=test%2Fauto%2Fs3%2Faws4_request";
const signedPath = "/eatwhat/staging/photo%20one" + query;

describe("fixed R2 development proxy", () => {
  it("is opt-in and rejects arbitrary hosts, paths and credentials", () => {
    expect(createUploadProxy()).toBeUndefined();
    for (const value of [
      "https://example.com/bucket",
      "http://127.0.0.1/bucket",
      bucket + "/extra",
      bucket + "?key=secret",
      bucket.replace("https://", "https://user:secret@"),
    ])
      expect(() => createUploadProxy(value)).toThrow();
  });
});

describe("real HTTP upload relay", () => {
  let upstream: Server, server: Server, vite: ViteDevServer, origin: string;
  const received: {
    url: string;
    headers: IncomingHttpHeaders;
    body: string;
  }[] = [];
  const listen = (server: Server) =>
    new Promise<string>((resolve) => {
      server.listen(0, "127.0.0.1", () =>
        resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`),
      );
    });
  beforeAll(async () => {
    upstream = createServer(async (req, res) => {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      received.push({
        url: req.url!,
        headers: req.headers,
        body: Buffer.concat(chunks).toString(),
      });
      // Deliberately no CORS response headers, like the currently unconfigured bucket.
      res.writeHead(200, {
        ETag: "test",
        "Set-Cookie": "storage_cookie=private",
      });
      res.end();
    });
    const upstreamOrigin = await listen(upstream);
    // The production configuration only allows an exact R2 bucket. This local
    // test replaces the destination after validation, so no real object is sent.
    const proxy = { ...createUploadProxy(bucket)!, target: upstreamOrigin };
    vite = await createViteServer({
      configFile: false,
      logLevel: "silent",
      appType: "custom",
      server: { middlewareMode: true, proxy: { [UPLOAD_PROXY_PREFIX]: proxy } },
      optimizeDeps: { noDiscovery: true, include: [] },
    });
    server = createServer(vite.middlewares);
    origin = await listen(server);
  }, 15_000);
  afterAll(async () => {
    await vite?.close();
    for (const item of [server, upstream]) {
      item?.closeAllConnections();
      if (item?.listening)
        await new Promise<void>((resolve) => item.close(() => resolve()));
    }
  });
  it("sends unchanged bytes and signature, strips all session headers and returns the upstream result", async () => {
    const response = await fetch(origin + UPLOAD_PROXY_PREFIX + signedPath, {
      method: "PUT",
      body: "raw image bytes",
      headers: {
        "Content-Type": "image/jpeg",
        Origin: origin,
        Cookie: "session=secret",
        Authorization: "Bearer private",
        "x-custom-session-name": "private",
      },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(received).toHaveLength(1);
    expect(received[0].url).toBe(signedPath);
    expect(received[0].body).toBe("raw image bytes");
    expect(received[0].headers["content-type"]).toBe("image/jpeg");
    for (const name of [
      "origin",
      "cookie",
      "authorization",
      "x-custom-session-name",
    ])
      expect(received[0].headers[name]).toBeUndefined();
  });
  it("rejects unsigned writes, other buckets, other methods and foreign origins before contacting storage", async () => {
    const before = received.length;
    for (const [method, path, site] of [
      ["PUT", "/eatwhat/staging/no-signature", origin],
      ["PUT", signedPath.replace("/eatwhat/", "/other/"), origin],
      ["DELETE", signedPath, origin],
      ["GET", signedPath, origin],
      ["PUT", signedPath, "https://unrelated.example"],
    ]) {
      const response = await fetch(origin + UPLOAD_PROXY_PREFIX + path, {
        method,
        headers: { Origin: site },
      });
      expect(response.status).toBe(404);
    }
    expect(received).toHaveLength(before);
  });
});
