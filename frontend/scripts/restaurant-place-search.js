async function validateRestaurantPlaceSearch(page) {
  const base = "http://127.0.0.1:5173",
    checks = [],
    errors = [];
  const assert = (value, message) => {
    if (!value) throw Error(message);
  };
  for (const width of [320, 390, 1440]) {
    const context = await page
      .context()
      .browser()
      .newContext({ viewport: { width, height: 960 } });
    const p = await context.newPage(),
      creates = [];
    p.setDefaultTimeout(20000);
    p.on("pageerror", (e) =>
      errors.push(e.message.replace(/ak=[^&\s]+/g, "ak=[redacted]")),
    );
    p.on("dialog", (d) =>
      d.type() === "beforeunload" ? d.accept() : d.dismiss(),
    );
    await context.addInitScript(() =>
      localStorage.setItem(
        "eatwhat-session",
        JSON.stringify({
          tokenName: "x-map-search-test",
          tokenValue: "isolated-test",
        }),
      ),
    );
    await context.route(
      () => true,
      async (route) => {
        const req = route.request(),
          url = new URL(req.url());
        if (/(^|\.)(baidu\.com|bdimg\.com|bcebos\.com)$/.test(url.hostname)) {
          assert(
            !req.headers()["x-map-search-test"],
            "Session token leaked to provider",
          );
          return route.continue();
        }
        if (url.origin !== base) return route.abort();
        if (url.pathname === "/src/features/BaiduMap.tsx") {
          const response = await route.fetch(),
            original = await response.text();
          const body = original.replace(
            "map.current = instance;",
            "map.current = instance; window.__placeSearchMap = instance;",
          );
          assert(body !== original, "Map instrumentation did not match");
          return route.fulfill({ response, body });
        }
        if (!url.pathname.startsWith("/api/")) return route.continue();
        let data = { items: [], totalItems: 0, hasNext: false };
        if (url.pathname === "/api/user/info")
          data = {
            id: 10,
            displayName: "地点搜索验收",
            verified: true,
            banned: false,
            role: "user",
          };
        else if (url.pathname === "/api/campus/list")
          data = [
            {
              id: 1,
              name: "软件园",
              gcjLng: 117.14,
              gcjLat: 36.667,
              open: true,
              isDefault: true,
            },
          ];
        else if (url.pathname === "/api/remote-config")
          data = { flags: {}, params: {}, maintenance: { mode: "NONE" } };
        else if (
          ["/api/user/activity", "/api/device/register"].includes(url.pathname)
        )
          data = null;
        else if (url.pathname === "/api/restaurant/add") {
          creates.push(req.postDataJSON());
          if (creates.length > 1)
            return route.fulfill({
              json: {
                code: 90004,
                data: null,
                msg: "未捕获异常",
                timestamp: 1794153014570,
              },
            });
          return route.fulfill({
            status: 400,
            json: { code: 900, msg: "测试：保留草稿后重试" },
          });
        } else
          assert(req.method() === "GET", "Unexpected write: " + url.pathname);
        return route.fulfill({ json: { code: 0, data } });
      },
    );
    try {
      await p.goto(base + "/?demo=0#/restaurants/new");
      const keyword = p.getByRole("searchbox", { name: "搜索店名或地址" });
      await keyword.waitFor();
      assert(
        (await p
          .locator('.restaurant-map-canvas, input[name="name"]')
          .count()) === 0,
        "Initial search shows the details form or map",
      );
      if (width === 390) {
        await p.screenshot({
          path: "../output/playwright/new-shop-search-390.png",
        });
      }
      await keyword.pressSequentially("肯德基", { delay: 60 });
      const first = p.locator(".restaurant-place-results button").first();
      await first.waitFor();
      assert(creates.length === 0, "Typing submitted the restaurant form");
      await keyword.fill("");
      assert(
        (await p.locator(".restaurant-place-results").count()) === 0,
        "Clearing input kept old matches",
      );
      await keyword.fill("三江源");
      await first.waitFor();
      assert(
        (await first.textContent()).includes("三江源"),
        "Matches did not update with the new keyword",
      );
      const selected = await first.evaluate((el) => ({
        name: el.querySelector("strong").textContent,
        address: el.querySelector("small").textContent,
      }));
      assert(
        await first.evaluate((el) => {
          const button = el.getBoundingClientRect();
          const text = el
            .querySelector(".new-shop-result-name")
            .getBoundingClientRect();
          return text.width >= button.width - 105;
        }),
        "Result icons squeeze the name and address",
      );
      assert(
        (await p.locator(".restaurant-place-results button").count()) > 0,
        "No live POIs returned",
      );
      assert(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        "Horizontal overflow",
      );
      if (width === 390) {
        await p.evaluate(() => window.scrollTo(0, 0));
        await p.screenshot({
          path: "../output/playwright/place-search-results-390.png",
        });
      }
      await first.click();
      await p.waitForURL(/#\/restaurants\/new\/details$/);
      const name = p.getByLabel(width < 640 ? "店名" : "店铺名称", {
        exact: true,
      });
      const address = p.getByLabel("详细地址", { exact: true });
      assert(
        (await name.inputValue()) === selected.name,
        "POI name was not filled",
      );
      assert(
        (await address.inputValue()) === selected.address,
        "Precise POI address was replaced",
      );
      assert(
        (await p.locator(".restaurant-place-results").count()) === 0,
        "Results did not close on selection",
      );
      const adjust = p.getByRole("button", { name: "调整位置", exact: true });
      assert(
        (await adjust.getAttribute("aria-expanded")) === "false",
        "Map opens before it is needed",
      );
      if (width === 390) {
        await p.screenshot({
          path: "../output/playwright/new-shop-details-390.png",
        });
      }
      await adjust.click();
      await p.locator('.restaurant-map-canvas[data-map-state="ready"]').waitFor();
      await p.waitForFunction(() => {
        const map = window.__placeSearchMap;
        if (!map) return false;
        const marker = map
          .getOverlays()
          .find((o) => o.getTitle?.() === "店铺位置，可拖动调整");
        if (!marker) return false;
        const a = map.getCenter(),
          b = marker.getPosition();
        return (
          Math.abs(a.lng - b.lng) < 0.00001 && Math.abs(a.lat - b.lat) < 0.00001
        );
      });
      const point = await p.evaluate(async () => {
        const marker = window.__placeSearchMap
          .getOverlays()
          .find((o) => o.getTitle?.() === "店铺位置，可拖动调整");
        const p = marker.getPosition();
        const { baiduToGcj } = await import("/src/features/map-geometry.ts");
        return baiduToGcj(p.lng, p.lat);
      });
      if (width === 390) {
        await p.waitForLoadState("networkidle");
        await p.evaluate(() => window.scrollTo(0, 0));
        await p.screenshot({
          path: "../output/playwright/place-search-selected-390.png",
        });
      }
      await name.fill("地图检索验收小店");
      await address.fill("检索地址二楼3号窗口");
      const submit = p.getByRole("button", {
        name: width < 640 ? "添加并继续" : "提交新店",
        exact: true,
      });
      await submit.click();
      await p.getByText("测试：保留草稿后重试", { exact: true }).waitFor();
      assert(creates.length === 1, "Expected one intercepted submission");
      assert(
        creates[0].name === "地图检索验收小店" &&
          creates[0].address === "检索地址二楼3号窗口",
        "Manual edits lost",
      );
      assert(
        Math.abs(creates[0].gcjLng - point.gcjLng) < 0.000001 &&
          Math.abs(creates[0].gcjLat - point.gcjLat) < 0.000001,
        "Incorrect submitted coordinate system",
      );
      await submit.click();
      await p
        .getByText("服务端处理请求时出现异常（错误码 90004）。", {
          exact: true,
        })
        .waitFor();
      assert(
        await submit.isDisabled(),
        "Unknown failure allows a duplicate write",
      );
      assert(
        creates.length === 2,
        "Unexpected automatic retry after unknown failure",
      );
      assert(
        (await name.inputValue()) === "地图检索验收小店" &&
          (await address.inputValue()) === "检索地址二楼3号窗口",
        "Unknown failure lost form details",
      );
      checks.push(
        `${width}px: live matches, selection/focus, GCJ submission, retained draft and HTTP 200/code 90004 duplicate-write guard pass`,
      );
    } finally {
      await context.close();
    }
  }
  assert(errors.length === 0, errors.join("; "));
  return { checks, errors };
}
