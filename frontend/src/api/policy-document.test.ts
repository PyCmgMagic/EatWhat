// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadPolicyDocument, readablePolicyHtml } from "./policy-document";

const url = "https://example.test/api/policies/policy-v3.html";
const html = `<!doctype html><html><head><title>政策标题</title>
<style>body { display:none }</style></head><body><main>
<h1>跨站同步授权说明</h1><p>版本：policy-v3</p>
<h2>你的选择</h2><p>请主动选择；旧版本授权不会自动升级。</p>
<ul><li>可撤回</li><li>保留与清理说明</li></ul>
<a href="./withdraw.html">撤回说明</a></main></body></html>`;
afterEach(() => vi.unstubAllGlobals());

describe("readable official policy document", () => {
  it("preserves the full reading structure and resolves links against the original document", () => {
    const result = readablePolicyHtml(html, url, "policy-v3");
    const element = document.createElement("article");
    element.innerHTML = result;
    expect(element.querySelector("h1")?.textContent).toBe("跨站同步授权说明");
    expect(element.querySelectorAll("li")).toHaveLength(2);
    expect(element.textContent).toContain("旧版本授权不会自动升级。");
    expect(element.querySelector("a")?.href).toBe(
      "https://example.test/api/policies/withdraw.html",
    );
    expect(element.querySelector("a")?.rel).toBe("noopener noreferrer");
    expect(element.querySelector("style, title, html, body")).toBeNull();
  });
  it("removes executable markup, hidden styling, remote assets, and DOM-clobbering attributes", () => {
    const result = readablePolicyHtml(
      `<main id="location" style="display:none">
      <h1 onclick="alert(1)">policy-v3</h1><script>alert(1)</script>
      <img src="https://tracking.test/a" onerror="alert(1)">
      <svg onload="alert(1)"></svg><iframe src="https://tracking.test/b"></iframe>
      <form><input name="cookie"></form><a href="javascript:alert(1)">说明</a>
      <p data-track="yes">真实正文</p></main>`,
      url,
      "policy-v3",
    );
    const element = document.createElement("article");
    element.innerHTML = result;
    expect(element.textContent).toContain("真实正文");
    expect(
      element.querySelector(
        "script, img, svg, iframe, form, input, [onclick], [onerror], [style], [id], [data-track]",
      ),
    ).toBeNull();
    expect(element.querySelector("a")?.hasAttribute("href")).toBe(false);
  });
  it("rejects an empty page or an HTML app fallback", () => {
    expect(() =>
      readablePolicyHtml("<div id='root'></div>", url, "policy-v3"),
    ).toThrow("正文为空");
  });
  it("rejects a different policy version instead of presenting it as current", () => {
    expect(() =>
      readablePolicyHtml("<p>policy-v2 旧版本</p>", url, "policy-v3"),
    ).toThrow("版本不一致");
    expect(() =>
      readablePolicyHtml("<p>policy-v30 其他版本</p>", url, "policy-v3"),
    ).toThrow("版本不一致");
  });
  it("loads public HTML without cookies or application authentication and allows cancellation", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(html, {
        headers: { "Content-Type": "text/html;charset=utf-8" },
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController();
    expect(
      await loadPolicyDocument(url, "policy-v3", controller.signal),
    ).toContain("跨站同步授权说明");
    const options = fetcher.mock.calls[0][1];
    expect(options.credentials).toBe("omit");
    expect(options.headers).toEqual({ Accept: "text/html" });
    expect(options.referrerPolicy).toBe("no-referrer");
    controller.abort();
    expect(options.signal.aborted).toBe(true);
  });
  it("reports HTTP failures instead of rendering their error pages", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("Service unavailable", { status: 503 }),
        ),
    );
    await expect(loadPolicyDocument(url, "policy-v3")).rejects.toThrow(
      "HTTP 503",
    );
  });
  it("rejects JSON success responses that are not policy documents", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response('{"code":0}', {
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    await expect(loadPolicyDocument(url, "policy-v3")).rejects.toThrow(
      "未返回政策网页",
    );
  });
});
