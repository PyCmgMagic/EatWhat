async function validateMapMarkers(page) {
  const base = "http://127.0.0.1:5173",
    checks = [],
    errors = [],
    writes = [];
  const assert = (ok, reason) => {
    if (!ok) throw new Error(reason);
  };
  const shops = [
    ...[
      [0, 0],
      [0.0002, 0],
      [0, 0.0002],
      [-0.0002, 0],
      [0, -0.0002],
    ].map(([dx, dy], i) => ({
      id: i + 1,
      name: [
        "校园家常菜",
        "一碗牛肉面",
        "巷口小火锅",
        "桂花甜品铺",
        "清晨豆浆店",
      ][i],
      address: "软件园美食街",
      gcjLng: 117.1401 + dx,
      gcjLat: 36.6673 + dy,
      pictureUrl: ["/prototype/assets/photos/sq_luosi.png"],
    })),
    ...["同楼烤肉店", "同楼饺子馆", "同楼茶饮店"].map((name, i) => ({
      id: i + 6,
      name,
      address: "校园生活中心二层",
      gcjLng: 117.1426,
      gcjLat: 36.6689,
      pictureUrl: [],
    })),
    {
      id: 9,
      name: "这是完整显示店名的测试餐厅软件园校区北门分店",
      address: "软件园北门",
      gcjLng: 117.1375,
      gcjLat: 36.6708,
      pictureUrl: [],
    },
    {
      id: 10,
      name: "尚未标注位置的店",
      address: "保留在列表中",
      gcjLng: null,
      gcjLat: null,
      pictureUrl: [],
    },
  ];
  for (const width of [1440, 390, 320, 820]) {
    const context = await page
      .context()
      .browser()
      .newContext({ viewport: { width, height: width < 600 ? 844 : 1000 } });
    const p = await context.newPage();
    p.setDefaultTimeout(15000);
    p.on("pageerror", (error) =>
      errors.push(error.message.replace(/ak=[^&\s]+/g, "ak=[redacted]")),
    );
    await p.emulateMedia({ reducedMotion: "reduce" });
    await context.addInitScript(() => {
      localStorage.setItem(
        "eatwhat-session",
        JSON.stringify({
          tokenName: "x-map-test",
          tokenValue: "isolated-map-test",
        }),
      );
      // Keep the deterministic campus fixtures in view. Geolocation is tested separately.
      navigator.geolocation.getCurrentPosition = () => {};
    });
    await context.route(
      () => true,
      async (route) => {
        const request = route.request(),
          url = new URL(request.url());
        if (/(^|\.)(baidu\.com|bdimg\.com|bcebos\.com)$/.test(url.hostname))
          return route.continue();
        if (url.origin !== base) return route.abort();
        if (url.pathname === "/src/features/BaiduMap.tsx") {
          const response = await route.fetch(),
            original = await response.text();
          const body = original.replace(
            "map.current = instance;",
            "map.current = instance; window.__baiduTestMap = instance;",
          );
          assert(body !== original, "Test map instrumentation did not match");
          return route.fulfill({ response, body });
        }
        if (!url.pathname.startsWith("/api/")) return route.continue();
        if (!["GET", "HEAD"].includes(request.method()))
          writes.push(url.pathname);
        let data = { items: [], totalItems: 0, hasNext: false };
        if (url.pathname === "/api/user/info")
          data = {
            id: 99,
            displayName: "地图验收",
            verified: true,
            banned: false,
            role: "user",
          };
        else if (url.pathname === "/api/campus/list")
          data = [
            {
              id: 1,
              name: "软件园",
              gcjLng: 117.1401,
              gcjLat: 36.6673,
              open: true,
              isDefault: true,
            },
          ];
        else if (url.pathname === "/api/remote-config")
          data = {
            configVersion: 1,
            flags: {},
            params: {},
            maintenance: { mode: "NONE" },
            announcements: [],
            versions: {},
          };
        else if (url.pathname === "/api/foods/recommend") data = [];
        else if (
          ["/api/restaurant/browse", "/api/restaurant/search"].includes(
            url.pathname,
          )
        ) {
          let rows = shops.filter((s) =>
            s.name.includes(url.searchParams.get("keyword") || ""),
          );
          if (url.searchParams.get("keyword") === "最大缩放")
            rows = [
              { ...shops[5], id: 21, name: "近邻甲", gcjLng: 117.1426 },
              { ...shops[5], id: 22, name: "近邻乙", gcjLng: 117.14264 },
            ];
          data = {
            items: rows,
            totalItems: rows.length,
            currentPage: 1,
            totalPages: 1,
            hasNext: false,
          };
        }
        return route.fulfill({ status: 200, json: { code: 0, data } });
      },
    );
    const marker = (key) =>
      p.locator(`.restaurant-map-marker[data-marker-key="${key}"]`);
    const panel = p.getByRole("dialog", { name: "这个位置的店铺" });
    const selectedRow = () =>
      p.locator(
        width < 600
          ? ".mobile-nearby-shop.is-selected"
          : '.pc-shop-row[aria-pressed="true"]',
      );
    const selectRow = async (id) => {
      const row = p.getByRole(width < 600 ? "radio" : "button", {
        name: `${shops[id - 1].name} ${shops[id - 1].address}`,
        exact: true,
      });
      await row.click();
    };
    const center = async (id, zoom) => {
      const shop = shops[id - 1];
      await p.evaluate(
        async ({ shop, zoom }) => {
          const { gcjToBaidu } = await import("/src/features/map-geometry.ts");
          const point = gcjToBaidu(shop);
          window.__baiduTestMap.centerAndZoom(
            new BMap.Point(point.lng, point.lat),
            zoom,
            { noAnimation: true },
          );
        },
        { shop, zoom },
      );
      await p.waitForFunction(
        (zoom) => window.__baiduTestMap.getZoom() === zoom,
        zoom,
      );
    };
    try {
      await p.goto(base + "/?demo=0#/nearby");
      await p.locator("body").ariaSnapshot();
      await p
        .locator('.restaurant-map-canvas[data-map-state="ready"]')
        .waitFor();
      await p.waitForFunction(
        () =>
          [...document.querySelectorAll(".restaurant-map-marker")].reduce(
            (sum, el) => sum + Number(el.dataset.count),
            0,
          ) === 9,
      );
      await p
        .getByText("1 家店暂缺坐标，可在列表中查看", { exact: true })
        .waitFor();
      assert(
        (await p.locator(".restaurant-map-cluster").count()) > 0,
        "Dense shops did not cluster",
      );
      assert(
        (await p.locator(".restaurant-map-marker img").count()) === 0,
        "Map pins still contain photos",
      );
      assert(
        (await p.locator(".restaurant-map-label.is-selected").innerText()) ===
          shops[0].name,
        "Selected name is missing from the cluster",
      );
      const cardCoversMarkers = await p.evaluate(() => {
        const card = document
          .querySelector(".pc-map-selected")
          ?.getBoundingClientRect();
        if (!card) return false;
        return [
          ...document.querySelectorAll(
            ".restaurant-map-pin, .restaurant-map-cluster-count",
          ),
        ].some((el) => {
          const r = el.getBoundingClientRect();
          return (
            r.left < card.right &&
            r.right > card.left &&
            r.top < card.bottom &&
            r.bottom > card.top
          );
        });
      });
      assert(
        !cardCoversMarkers,
        "Initial marker is covered by the desktop card",
      );
      await p.screenshot({
        path: `output/playwright/map-markers-overview-${width}.png`,
      });
      checks.push(
        `${width}px: dense shops cluster, all 9 located shops retained, missing location stays in list, no marker photos`,
      );

      await center(1, 17);
      await marker("1:2:3:4:5").waitFor();
      await marker("1:2:3:4:5").click();
      await p.waitForFunction(() => window.__baiduTestMap.getZoom() > 17);
      await p.waitForFunction(
        () =>
          !document.querySelector(
            '.restaurant-map-marker[data-marker-key="1:2:3:4:5"]',
          ),
      );
      if (!(await marker("1").count())) {
        await p.locator(".restaurant-map-cluster.is-selected").click();
        await p.waitForFunction(() => window.__baiduTestMap.getZoom() === 20);
      }
      await marker("1").waitFor();
      assert(
        (await marker("1:2:3:4:5").count()) === 0,
        "Zoom did not dissolve the cluster",
      );
      const sizes = await p
        .locator(".restaurant-map-marker:not(.is-selected) .restaurant-map-pin")
        .evaluateAll((nodes) => nodes.map((n) => getComputedStyle(n).width));
      assert(
        sizes.length > 0 &&
          sizes.every((s) => Math.abs(parseFloat(s) - 24) < 0.1),
        `Ordinary visible pins are not 24px: ${JSON.stringify(sizes)}`,
      );
      await marker("2").click();
      await p.waitForFunction(
        () =>
          document
            .querySelector('.restaurant-map-marker[data-marker-key="2"]')
            ?.getAttribute("aria-pressed") === "true",
      );
      assert(
        (await selectedRow().innerText()).includes(shops[1].name),
        "Pin selection did not update the list",
      );
      if (width >= 600)
        assert(
          (await p.locator(".pc-map-selected h2").innerText()) ===
            shops[1].name,
          "Pin selection did not update the card",
        );
      await p.screenshot({
        path: `output/playwright/map-markers-expanded-${width}.png`,
      });
      checks.push(
        `${width}px: cluster click zooms to individual 24px pins, marker selection updates list/card`,
      );

      await selectRow(6);
      await center(6, 18);
      await marker("6:7:8").waitFor();
      const before = await p.evaluate(() => window.__baiduTestMap.getZoom());
      await marker("6:7:8").click();
      await panel.waitFor();
      await panel.ariaSnapshot();
      assert(
        (await panel.locator(".restaurant-map-cluster-row").count()) === 3,
        "Colocated list lost shops",
      );
      assert(
        (await p.evaluate(() => window.__baiduTestMap.getZoom())) === before,
        "Colocated shops pointlessly zoomed",
      );
      const boxes = await p.evaluate(() => {
        const map = document
            .querySelector(".restaurant-map")
            .getBoundingClientRect(),
          list = document
            .querySelector(".restaurant-map-cluster-list")
            .getBoundingClientRect();
        return {
          contained:
            list.left >= map.left &&
            list.right <= map.right &&
            list.top >= map.top &&
            list.bottom <= map.bottom,
        };
      });
      assert(boxes.contained, "Selection popup overflowed the map");
      await p.screenshot({
        path: `output/playwright/map-markers-colocated-${width}.png`,
      });
      await p.keyboard.press("Escape");
      await panel.waitFor({ state: "hidden" });
      await p.waitForFunction(() =>
        document.activeElement?.classList.contains("restaurant-map-cluster"),
      );
      await p.keyboard.press("Enter");
      await panel.waitFor();
      await panel
        .getByRole("button", {
          name: "同楼茶饮店 校园生活中心二层",
          exact: true,
        })
        .click();
      await panel.waitFor({ state: "hidden" });
      await p.waitForFunction(
        () =>
          document.querySelector(".restaurant-map-label.is-selected")
            ?.textContent === "同楼茶饮店",
      );
      assert(
        (await selectedRow().innerText()).includes("同楼茶饮店"),
        "Popup selection did not update the list",
      );
      checks.push(
        `${width}px: colocated shops open a bounded scrollable list, Escape/Enter and selection work`,
      );

      await selectRow(9);
      await center(9, 18);
      await marker("9").waitFor();
      await p.waitForFunction(
        () =>
          document
            .querySelector('.restaurant-map-marker[data-marker-key="9"]')
            ?.getAttribute("aria-pressed") === "true",
      );
      const fullName = await marker("9")
        .locator(".restaurant-map-label")
        .evaluate((el) => {
          const map = document
              .querySelector(".restaurant-map")
              .getBoundingClientRect(),
            r = el.getBoundingClientRect();
          return {
            text: el.textContent,
            clipped: el.scrollHeight > el.clientHeight + 1,
            contained:
              r.left >= map.left &&
              r.right <= map.right &&
              r.top >= map.top &&
              r.bottom <= map.bottom,
          };
        });
      assert(
        fullName.text === shops[8].name &&
          !fullName.clipped &&
          fullName.contained,
        "Full selected name is clipped or outside map",
      );
      assert(
        !(await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        )),
        "Page has horizontal overflow",
      );
      await p.screenshot({
        path: `output/playwright/map-markers-long-name-${width}.png`,
      });
      const search = p.getByRole(width < 600 ? "searchbox" : "textbox", {
        name: width < 600 ? "搜店名或菜名" : "附近搜店名",
        exact: true,
      });
      await search.fill("没有这家店");
      await p.waitForFunction(
        () => document.querySelectorAll(".restaurant-map-marker").length === 0,
      );
      assert(
        (await panel.count()) === 0,
        "Stale cluster popup survived a search",
      );
      await search.fill("");
      await p.waitForFunction(
        () => document.querySelectorAll(".restaurant-map-marker").length > 0,
      );
      checks.push(
        `${width}px: full long selected name stays in map; empty search clears overlays and restoring search restores them`,
      );
      await search.fill("最大缩放");
      await p.waitForFunction(() =>
        [...document.querySelectorAll(".restaurant-map-marker")].some((el) =>
          el.dataset.markerKey?.includes("21"),
        ),
      );
      await center(6, 20);
      await marker("21:22").waitFor();
      await marker("21:22").click();
      await panel.waitFor();
      assert(
        (await panel.locator(".restaurant-map-cluster-row").count()) === 2,
        "Max zoom did not offer both nearby shops",
      );
      await p
        .getByRole("button", { name: "关闭店铺列表", exact: true })
        .click();
      await panel.waitFor({ state: "hidden" });
      checks.push(
        `${width}px: maximum zoom offers a list for nearby shops that still overlap`,
      );
    } catch (error) {
      await p.screenshot({
        path: `output/playwright/map-markers-failure-${width}.png`,
      });
      console.log(
        JSON.stringify({
          checks,
          errors,
          width,
          snapshot: await p.locator("body").ariaSnapshot(),
        }),
      );
      throw error;
    } finally {
      await context.close();
    }
  }
  assert(errors.length === 0, `Browser errors: ${errors.join("; ")}`);
  assert(writes.length === 0, `Unexpected writes: ${writes.join(", ")}`);
  return { checks, errors, writes };
}
