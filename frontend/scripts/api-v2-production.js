async (page) => {
  const context = await page.context().browser().newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await context.newPage(), requests = [], errors = [], outside = [], writes = [];
  p.on("request", r => requests.push(r.url()));
  p.on("pageerror", e => errors.push(e.message));
  await context.route(u => u.hostname !== "127.0.0.1", r => { outside.push(r.request().url()); return r.abort(); });
  await context.route(u => u.pathname.startsWith("/api/"), r => {
    const path = new URL(r.request().url()).pathname;
    if (r.request().method() !== "GET") writes.push(path);
    if (path === "/api/policies/test-policy-v1.html") return r.fulfill({ contentType: "text/html", body: "<main><h1>test-policy-v1 授权政策</h1><p>生产产物隔离验收正文。</p></main>" });
    const data = path === "/api/auth/consent/policy" ? { version: "test-policy-v1", url: "/api/policies/test-policy-v1.html" } : path === "/api/foods/recommend" ? { items: [{ id: 71, restaurantId: 1, name: "隔离验收面", price: 12, pictureUrl: [], mealTimes: [], stageColor: "broth", likesCount: 2, isLiked: false, isFavorite: false }], currentPage: 1, totalPages: 1, totalItems: 1, hasNext: false } : [];
    return r.fulfill({ contentType: "application/json", body: JSON.stringify({ code: 0, data }) });
  });
  try {
    await p.goto("http://127.0.0.1:5174/?demo=1&view=desktop#/");
    await p.locator(".pc-food-card").first().waitFor();
    if (!await p.getByText("隔离验收面", { exact: true }).count()) throw new Error("recommendation items not rendered in production");
    const homeRequests = [...requests];
    await p.goto("http://127.0.0.1:5174/?demo=1&view=desktop#/auth/password");
    await p.getByRole("checkbox", { name: "我已阅读并同意跨站同步授权政策" }).check();
    if (await p.getByRole("button", { name: /Mock 登录|演示账号登录/ }).count()) throw new Error("production enabled demo without build opt-in");
    if (requests.some(u => /\/assets\/transport-|TJNCaptcha|\/auth\/captcha\/config/.test(u))) throw new Error("Mock or CAPTCHA eagerly requested");
    if (homeRequests.some(u => /\/assets\/(Admin-|ApiV2Routes-|DesktopPublish-|DesktopProfile-|G-)/.test(u))) throw new Error("secondary pages loaded eagerly");
    if (writes.length || outside.length) throw new Error("isolated preview accessed a live service");
    await p.screenshot({ path: "output/playwright/api-v2-production-auth.png" });
    return { checks: ["标准生产包即使携带demo=1也不启用Mock", "新版推荐items在生产首页正常渲染", "正文读取后才允许勾选政策", "腾讯SDK和验证配置按操作加载，管理与发布页面不进入首屏请求"], errors, outsideRequests: outside.length, writes: writes.length };
  } catch (error) { return { errors, failure: String(error), url: p.url(), text: (await p.locator("body").innerText()).slice(-1500) }; }
  finally { await context.close(); }
}
