async (page) => {
  const context = await page
    .context()
    .browser()
    .newContext({
      viewport: { width: 1440, height: 1000 },
    });
  const p = await context.newPage();
  const errors = [];
  const checks = [];
  let delayedModules = 0;
  let releaseModules;
  const modulesGate = new Promise((resolve) => {
    releaseModules = resolve;
  });
  p.on("pageerror", (error) => {
    errors.push({
      message: error.message,
      stack: error.stack?.replace(/\?[^\s)]+/g, "?[redacted]"),
    });
  });
  await context.route(
    (url) =>
      !["127.0.0.1", "localhost"].includes(url.hostname) &&
      !/(^|\.)(baidu\.com|bdimg\.com|bcebos\.com)$/.test(url.hostname),
    (route) => route.abort(),
  );
  // Demo business data stays local while the real map SDK loads its modules.
  await context.route(
    (url) => url.pathname.startsWith("/api/"),
    (route) => route.abort(),
  );
  await context.route(
    (url) =>
      url.hostname === "api.map.baidu.com" && url.pathname === "/getmodules",
    async (route) => {
      delayedModules++;
      await modulesGate;
      await route.continue();
    },
  );
  try {
    const moduleRequest = p.waitForRequest(
      (request) => new URL(request.url()).pathname === "/getmodules",
    );
    await p.goto("http://127.0.0.1:5173/?demo=1#/nearby");
    await p.locator(".BMap_mask").waitFor();
    await moduleRequest;
    await p.getByRole("link", { name: "我的", exact: true }).click();
    await p.waitForURL(/#\/me$/);
    releaseModules();
    await p.waitForLoadState("networkidle");
    if (!delayedModules) throw new Error("SDK module delay was not exercised");
    checks.push(
      "Leaving before SDK controls load does not access a destroyed map",
    );

    for (const width of [1440, 390]) {
      await p.setViewportSize({ width, height: 1000 });
      await p.getByRole("link", { name: "附近", exact: true }).click();
      await p.locator(".restaurant-map-canvas canvas").waitFor();
      await p.getByRole("button", { name: "放大地图", exact: true }).click();
      await p.getByRole("link", { name: "我的", exact: true }).click();
      await p.waitForURL(/#\/me$/);
      await p.waitForLoadState("networkidle");
      checks.push(`${width}px map navigation during camera animation`);
    }
    await p.getByRole("link", { name: "附近", exact: true }).click();
    await p.locator('.restaurant-map-canvas[data-map-state="ready"]').waitFor();
    if (!(await p.locator(".restaurant-map-marker").count()))
      throw new Error("Reused map did not restore restaurant markers");
    checks.push("Reused map renders restaurant markers and finishes loading");
    if (errors.length) throw new Error(JSON.stringify({ checks, errors }));
    return { checks, pageErrors: errors, delayedModules };
  } finally {
    releaseModules();
    await context.close();
  }
}
