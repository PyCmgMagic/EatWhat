async (page) => {
  const context = await page.context().browser().newContext({ viewport: { width: 390, height: 844 } });
  const p = await context.newPage();
  let failed = true;
  const errors = [];
  p.on("pageerror", e => errors.push(e.message.replace(/ak=[^&\s]+/g, "ak=[redacted]")));
  await context.route(u => u.pathname.startsWith("/api/"), r => {
    const path = new URL(r.request().url()).pathname;
    let data = null, status = 200;
    if (path === "/api/campus/list") data = [{ id: 1, name: "软件园", isDefault: true, open: true, gcjLng: 117.14, gcjLat: 36.667 }];
    else if (path.startsWith("/api/restaurant/")) { status = failed ? 503 : 200; data = { items: [], totalItems: 0, hasNext: false }; }
    return r.fulfill({ status, contentType: "application/json", body: JSON.stringify({ code: status === 200 ? 0 : status, data, msg: "店铺接口暂不可用" }) });
  });
  try {
    await p.goto("http://127.0.0.1:5173/?view=mobile#/nearby");
    await p.getByRole("heading", { name: "附近的店暂时没加载成功", exact: true }).waitFor();
    await p.locator('.restaurant-map-canvas[data-map-state="ready"]').waitFor();
    if (!await p.getByRole("navigation", { name: "主导航", exact: true }).isVisible()) throw new Error("API failure removed navigation");
    failed = false;
    await p.getByRole("button", { name: "重新加载店铺", exact: true }).click();
    await p.getByRole("heading", { name: "还没找到这家店", exact: true }).waitFor();
    if (await p.locator(".restaurant-map-marker").count()) throw new Error("Empty API response generated fake pins");
    if (errors.length) throw new Error("Browser errors occurred");
    return { mapProvider: "baidu", apiFailureRetainsMapAndNavigation: true, restaurantRetryRecovers: true, fakePins: 0, errors };
  } finally { await context.close(); }
}
