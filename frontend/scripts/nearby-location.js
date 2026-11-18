async function validateNearbyLocation(page) {
  const base = "http://127.0.0.1:5173",
    checks = [],
    errors = [];
  const assert = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  for (const width of [1440, 390]) {
    const context = await page
      .context()
      .browser()
      .newContext({
        viewport: { width, height: 900 },
        permissions: ["geolocation"],
        geolocation: { longitude: 117.134, latitude: 36.667 },
      });
    const p = await context.newPage(),
      searches = [],
      writes = [];
    p.setDefaultTimeout(15000);
    p.on("pageerror", (error) =>
      errors.push(error.message.replace(/ak=[^&\s]+/g, "ak=[redacted]")),
    );
    await p.emulateMedia({ reducedMotion: "reduce" });
    await context.addInitScript(() => {
      const native = navigator.geolocation.getCurrentPosition.bind(
        navigator.geolocation,
      );
      window.__geoCalls = 0;
      window.__geoMode = "native";
      navigator.geolocation.getCurrentPosition = (
        success,
        failure,
        options,
      ) => {
        window.__geoCalls++;
        if (window.__geoMode === "denied")
          return queueMicrotask(() => failure({ code: 1 }));
        if (window.__geoMode === "pending") {
          window.__geoResolve = success;
          return;
        }
        native(success, failure, options);
      };
      localStorage.setItem(
        "eatwhat-session",
        JSON.stringify({
          tokenName: "x-location-test",
          tokenValue: "isolated-location-test",
        }),
      );
    });
    const shop = {
      id: 81,
      name: "附近定位验收店",
      address: "软件园",
      gcjLng: 117.14,
      gcjLat: 36.6673,
      pictureUrl: [],
    };
    await context.route(
      () => true,
      (route) => {
        const request = route.request(),
          url = new URL(request.url());
        if (/(^|\.)(baidu\.com|bdimg\.com|bcebos\.com)$/.test(url.hostname))
          return route.continue();
        if (url.origin !== base) return route.abort();
        if (!url.pathname.startsWith("/api/")) return route.continue();
        if (!["GET", "HEAD"].includes(request.method()))
          writes.push(url.pathname);
        let data = { items: [], totalItems: 0, hasNext: false };
        if (url.pathname === "/api/user/info")
          data = {
            id: 10,
            displayName: "定位验收",
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
          url.pathname === "/api/restaurant/browse" ||
          url.pathname === "/api/restaurant/search"
        ) {
          searches.push({
            path: url.pathname,
            ...Object.fromEntries(url.searchParams),
          });
          data = {
            items: [shop],
            totalItems: 1,
            currentPage: 1,
            totalPages: 1,
            hasNext: false,
          };
        }
        return route.fulfill({ status: 200, json: { code: 0, data } });
      },
    );
    const navigate = (name) =>
      p.getByRole("link", { name, exact: true }).click();
    const rows = p.locator(
      width < 600 ? ".mobile-nearby-shop" : ".pc-shop-row",
    );
    const loaded = () =>
      p.locator('.restaurant-map-canvas[data-map-state="ready"]').waitFor();
    try {
      await p.goto(base + "/?demo=0#/");
      await p.waitForFunction(() => window.__geoCalls === 1);
      await p.locator("body").ariaSnapshot();
      assert(
        (await p.evaluate(() => window.__geoCalls)) === 1,
        "Startup requested location more than once",
      );
      const search = p.waitForResponse((response) => {
        const url = new URL(response.url());
        return (
          url.pathname === "/api/restaurant/search" &&
          url.searchParams.has("gcjLng")
        );
      });
      await navigate("附近");
      await search;
      await loaded();
      await rows.first().waitFor();
      await p.locator(".restaurant-map-device-dot").waitFor();
      await p.getByRole("button", { name: "当前位置", exact: true }).waitFor();
      const area = await p.evaluate(() =>
        JSON.parse(localStorage.getItem("eatwhat-area")),
      );
      const latest = searches.at(-1);
      assert(
        area.source === "device" &&
          Number(latest.gcjLng) === area.gcjLng &&
          Number(latest.gcjLat) === area.gcjLat,
        "Search did not use device coordinates",
      );
      assert(
        Math.abs(area.gcjLng - 117.134) > 0.001 &&
          Math.abs(area.gcjLng - 117.134) < 0.02,
        "Coordinates were not converted to GCJ02",
      );
      assert(
        (await p.evaluate(() => window.__geoCalls)) === 1,
        "Entry requested location more than once",
      );
      const input = p.getByRole(width < 600 ? "searchbox" : "textbox", {
        name: width < 600 ? "搜店名或菜名" : "附近搜店名",
        exact: true,
      });
      const filtered = p.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === "/api/restaurant/search" &&
          new URL(response.url()).searchParams.get("keyword") === "定位",
      );
      await input.fill("定位");
      await filtered;
      assert(
        (await p.evaluate(() => window.__geoCalls)) === 1,
        "Search rerender requested location again",
      );
      checks.push(
        `${width}px: entry auto-locates once, shows device position and sends converted coordinates to nearby search`,
      );
      await p.screenshot({
        path: `output/playwright/nearby-auto-location-${width}.png`,
      });

      await navigate("发现");
      await p.evaluate(() => {
        window.__geoMode = "denied";
      });
      await navigate("附近");
      await p
        .getByRole("button", { name: "回到我的位置", exact: true })
        .click();
      await p
        .getByText(
          "定位权限被拒绝，请在浏览器的站点设置中允许定位，并检查系统是否允许浏览器访问位置。",
          { exact: true },
        )
        .waitFor();
      await rows.first().waitFor();
      assert(
        (await p.evaluate(() => window.__geoCalls)) === 2,
        "Manual request did not report denial",
      );
      await p.evaluate(() => {
        window.__geoMode = "native";
      });
      await p
        .getByRole("button", { name: "回到我的位置", exact: true })
        .click();
      await p.waitForFunction(
        () =>
          !document.querySelector(".restaurant-map-location-error") &&
          document
            .querySelector(".restaurant-map-locate")
            ?.textContent.includes("我的位置"),
      );
      assert(
        (await p.evaluate(() => window.__geoCalls)) === 3,
        "Manual retry failed",
      );
      checks.push(
        `${width}px: denial keeps the list usable; manual retry restores location`,
      );

      await navigate("发现");
      await p.evaluate(() => {
        window.__geoMode = "pending";
      });
      await navigate("附近");
      await p
        .getByRole("button", { name: "回到我的位置", exact: true })
        .click();
      await p.waitForFunction(() => window.__geoCalls === 4);
      await p.getByText("正在定位…", { exact: true }).waitFor();
      const before = await p.evaluate(() =>
        localStorage.getItem("eatwhat-area"),
      );
      await navigate("发现");
      await p.evaluate(() =>
        window.__geoResolve({ coords: { longitude: 120, latitude: 30 } }),
      );
      assert(
        (await p.evaluate(() => localStorage.getItem("eatwhat-area"))) ===
          before,
        "Late permission result changed area after leaving",
      );
      await p.goto(base + "/?demo=0#/restaurants/new/details");
      await loaded();
      assert(
        (await p.evaluate(() => window.__geoCalls)) === 1,
        "Shop position editor added a second startup location request",
      );
      checks.push(
        `${width}px: leaving ignores late results; editor startup locates only once`,
      );
      assert(
        writes.length === 0,
        "Unexpected write requests: " + writes.join(", "),
      );
    } finally {
      await context.close();
    }
  }
  assert(errors.length === 0, JSON.stringify(errors));
  return { checks, errors, realBackendRequests: 0 };
}
