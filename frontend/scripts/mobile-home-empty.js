async (page) => {
  const context = await page.context().browser().newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  });
  const p = await context.newPage(), checks = [], errors = [], remote = [];
  let status = 200, available = false, calls = 0;
  const food = {
    id: 71, name: "接口返回的午餐", restaurantName: "校内餐厅", restaurantId: 9,
    price: 12, category: "staple", pictureUrl: ["/prototype/assets/photos/sq_luosi.png"],
  };
  p.setDefaultTimeout(10000);
  p.on("pageerror", e => errors.push(e.message));
  await context.route(u => u.hostname !== "127.0.0.1", r => {
    remote.push(r.request().url());
    return r.abort();
  });
  const reply = (r, data, code = 200) => r.fulfill({
    status: code, contentType: "application/json",
    body: JSON.stringify({ code: code === 200 ? 0 : code, data, msg: code === 200 ? "ok" : "推荐服务暂不可用" }),
  });
  await context.route(u => u.pathname.startsWith("/api/"), r => {
    const url = new URL(r.request().url());
    if (url.pathname === "/api/campus/list")
      return reply(r, [{ id: 1, name: "软件园", open: true, isDefault: true }]);
    if (url.pathname === "/api/foods/recommend") {
      calls++;
      const items = available && !url.searchParams.has("category") ? [food] : [];
      return reply(r, { items, totalItems: items.length, hasNext: false }, status);
    }
    return reply(r, { items: [], totalItems: 0, hasNext: false });
  });
  const base = "http://127.0.0.1:5173/?view=mobile#";
  const nav = p.getByRole("navigation", { name: "主导航", exact: true });
  const shell = async () => {
    await nav.waitFor();
    for (const name of ["发现", "附近", "我的"])
      if (!await nav.getByRole("link", { name, exact: true }).isVisible())
        throw new Error(`navigation ${name} disappeared`);
    if (!await p.getByRole("link", { name: "搜索", exact: true }).isVisible())
      throw new Error("search disappeared");
    if (!await p.getByRole("tablist", { name: "推荐分类", exact: true }).isVisible())
      throw new Error("recommendation filters disappeared");
    const box = await nav.boundingBox(), viewport = p.viewportSize();
    if (!box || box.y + box.height > viewport.height + 1)
      throw new Error("navigation is below the viewport");
    if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth))
      throw new Error("horizontal overflow");
  };
  try {
    for (const [width, height] of [[320, 568], [390, 844], [520, 900]]) {
      await p.setViewportSize({ width, height });
      for (const path of ["/", "/home-photo"]) {
        await p.goto(base + path);
        await p.getByRole("heading", { name: "暂时没有推荐", exact: true }).waitFor();
        await shell();
        if (await p.locator(".design-food-tile").count() || await p.getByText("就它了", { exact: true }).count())
          throw new Error("empty response rendered prototype food or an invalid selection action");
        const before = calls;
        const refreshBox = await p.getByRole("button", { name: "刷新推荐", exact: true }).boundingBox();
        const navBox = await nav.boundingBox();
        if (!refreshBox || !navBox || refreshBox.y + refreshBox.height > navBox.y)
          throw new Error("refresh is covered by the bottom navigation");
        await p.getByRole("button", { name: "刷新推荐", exact: true }).click();
        await p.waitForFunction(() => document.querySelector('.design-food-grid')?.getAttribute('aria-busy') === 'false');
        if (calls <= before) throw new Error("refresh did not request recommendations");
        await p.getByRole("tab", { name: "主食", exact: true }).click();
        await p.getByRole("heading", { name: "这个分类还没有推荐", exact: true }).waitFor();
        await p.getByRole("tab", { name: "今日推荐", exact: true }).click();
        await p.getByRole("heading", { name: "暂时没有推荐", exact: true }).waitFor();
        if (path === "/")
          await p.screenshot({ path: `output/playwright/mobile-home-empty-${width}.png` });
        await p.getByRole("link", { name: "逛逛附近", exact: true }).click();
        await p.waitForURL("**#/nearby");
        await p.goto(base + path);
        await p.getByRole("link", { name: "分享一道菜", exact: true }).click();
        await p.waitForURL("**#/publish");
        checks.push(`${width}x${height} ${path}: empty recommendations keep the shell, filters, refresh and working nearby/publish links`);
      }
    }
    status = 503;
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto(base + "/");
    await p.reload();
    await p.getByRole("heading", { name: "推荐暂时没端上来", exact: true }).waitFor();
    await shell();
    await p.screenshot({ path: "output/playwright/mobile-home-recommendation-error.png" });
    status = 200;
    available = true;
    await p.getByRole("button", { name: "重新加载推荐", exact: true }).click();
    await p.locator(".design-food-tile").getByRole("heading", { name: food.name, exact: true }).waitFor();
    await shell();
    if (await p.locator(".mobile-home-unavailable").count())
      throw new Error("recovered recommendations kept the empty hero");
    await p.getByRole("tab", { name: "主食", exact: true }).click();
    await p.getByRole("heading", { name: "这个分类还没有推荐", exact: true }).waitFor();
    await shell();
    await p.getByRole("tab", { name: "今日推荐", exact: true }).click();
    await p.locator(".design-food-tile").getByRole("heading", { name: food.name, exact: true }).waitFor();
    checks.push("API failure preserves navigation; retry restores the real hero and food; empty category does not hide the home");
    if (errors.length || remote.length) throw new Error("Unexpected runtime errors or remote requests");
    return { checks, errors, remoteRequests: remote.length };
  } catch (error) {
    await p.screenshot({ path: "output/playwright/mobile-home-empty-failure.png" });
    return { checks, errors, failure: String(error), url: p.url(), snapshot: await p.locator(".mobile-viewport").innerText() };
  } finally {
    await context.close();
  }
}
