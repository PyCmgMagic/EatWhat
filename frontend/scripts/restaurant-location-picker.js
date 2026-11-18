async function validateRestaurantLocationPicker(page) {
  const base = "http://127.0.0.1:5173",
    checks = [],
    errors = [];
  const assert = (ok, message) => {
    if (!ok) throw Error(message);
  };
  for (const width of [320, 390, 1440]) {
    const context = await page
      .context()
      .browser()
      .newContext({
        viewport: { width, height: 920 },
        permissions: ["geolocation"],
        geolocation: { longitude: 117.134, latitude: 36.667 },
      });
    const p = await context.newPage(),
      creates = [];
    p.setDefaultTimeout(20000);
    p.on("pageerror", (e) =>
      errors.push(e.message.replace(/ak=[^&\s]+/g, "ak=[redacted]")),
    );
    p.on("dialog", (d) =>
      d.type() === "beforeunload" ? d.accept() : d.dismiss(),
    );
    let rejectCreate = true;
    await context.addInitScript(() =>
      localStorage.setItem(
        "eatwhat-session",
        JSON.stringify({
          tokenName: "x-location-picker-test",
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
            !req.headers()["x-location-picker-test"],
            "Session token leaked to map provider",
          );
          return route.continue();
        }
        if (url.origin !== base) return route.abort();
        if (url.pathname === "/src/features/BaiduMap.tsx") {
          const response = await route.fetch(),
            original = await response.text();
          const body = original.replace(
            "map.current = instance;",
            "map.current = instance; window.__shopTestMap = instance; instance.addEventListener('movestart', () => window.__shopTestMapMoving = true); instance.addEventListener('moveend', () => window.__shopTestMapMoving = false);",
          );
          assert(body !== original, "Map instrumentation did not match");
          return route.fulfill({ response, body });
        }
        if (!url.pathname.startsWith("/api/")) return route.continue();
        let data = { items: [], totalItems: 0, hasNext: false };
        if (url.pathname === "/api/user/info")
          data = {
            id: 10,
            displayName: "地图验收用户",
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
        else if (url.pathname === "/api/restaurant/add") {
          creates.push(req.postDataJSON());
          if (rejectCreate)
            return route.fulfill({
              status: 400,
              json: { code: 900, msg: "测试：请保留信息后重试" },
            });
          data = { id: 901 };
        } else if (
          ["/api/user/activity", "/api/device/register"].includes(url.pathname)
        )
          data = null;
        else if (url.pathname === "/api/restaurant/detail/901")
          data = { ...creates.at(-1), id: 901 };
        else
          assert(req.method() === "GET", "Unexpected write: " + url.pathname);
        return route.fulfill({ json: { code: 0, data } });
      },
    );
    const readPoint = () =>
      p.evaluate(async () => {
        const marker = window.__shopTestMap
          .getOverlays()
          .find(
            (o) => o.getPosition && o.getTitle?.() === "店铺位置，可拖动调整",
          );
        if (!marker) throw Error("No shop marker");
        const point = marker.getPosition();
        const { baiduToGcj } = await import("/src/features/map-geometry.ts");
        return baiduToGcj(point.lng, point.lat);
      });
    const panMap = async (x, y, dx, dy, label) => {
      await p.waitForFunction(() => !window.__shopTestMapMoving);
      const before = await p.evaluate(() => {
        const c = window.__shopTestMap.getCenter();
        return { lng: c.lng, lat: c.lat };
      });
      await p.mouse.move(x, y);
      await p.mouse.down();
      await p.mouse.move(x + dx, y + dy, { steps: 12 });
      await p.mouse.up();
      await p.waitForFunction((previous) => {
        const c = window.__shopTestMap.getCenter();
        return (
          Math.abs(c.lng - previous.lng) > 0.000001 ||
          Math.abs(c.lat - previous.lat) > 0.000001
        );
      }, before);
      await p.waitForFunction(() => !window.__shopTestMapMoving);
      checks.push(`${width}px: mouse pans ${label}`);
    };
    try {
      await p.goto(base + "/?demo=0#/restaurants/new");
      await p
        .getByRole("heading", { name: "添加一家店", exact: true })
        .waitFor();
      await p
        .getByRole("button", { name: "搜不到？手动添加", exact: true })
        .click();
      const name = p.getByLabel(width < 640 ? "店名" : "店铺名称", {
        exact: true,
      });
      const address = p.getByLabel("详细地址", { exact: true });
      const submit = p.getByRole("button", {
        name: width < 640 ? "添加并继续" : "提交新店",
        exact: true,
      });
      await name.fill("地图选点验收小店");
      await address.fill("软件园食堂二层");
      assert(
        (await p
          .locator('input[name="lng"], input[name="lat"], input[type="number"]')
          .count()) === 0,
        "Coordinate inputs remain",
      );
      assert(await submit.isDisabled(), "Unselected location can submit");
      await name.evaluate((input) => input.form.requestSubmit());
      assert(creates.length === 0, "Missing location reached create API");
      await p
        .locator('.restaurant-map-canvas[data-map-state="ready"]')
        .waitFor();
      await p
        .getByRole("button", { name: "回到我的位置", exact: true })
        .click();
      await p.locator(".restaurant-map-device-dot").waitFor();
      assert(
        await submit.isDisabled(),
        "Device position silently became shop position",
      );
      checks.push(
        `${width}px: no coordinate fields; neither campus nor device center can be submitted as a shop`,
      );

      const canvas = p.locator(".restaurant-map-canvas");
      await canvas.scrollIntoViewIfNeeded();
      await p.waitForFunction(() => !window.__shopTestMapMoving);
      const dot = await p.locator(".restaurant-map-device-dot").boundingBox();
      await panMap(
        dot.x + dot.width / 2,
        dot.y + dot.height / 2,
        48,
        28,
        "from the current-location dot",
      );
      assert(
        await submit.isDisabled(),
        "Panning silently selected a shop position",
      );
      const background = await canvas.boundingBox();
      await panMap(
        background.x + background.width * 0.25,
        background.y + background.height * 0.25,
        24,
        40,
        "from the map background",
      );

      await address.fill("");
      const box = await canvas.boundingBox();
      await canvas.click({
        position: { x: box.width * 0.65, y: box.height * 0.4 },
      });
      await p.getByText("已选店铺位置", { exact: true }).waitFor();
      const marker = p.locator(
        '.restaurant-map-canvas [title="店铺位置，可拖动调整"]',
      );
      await marker.waitFor();
      const first = await readPoint();
      assert(
        Math.abs(first.gcjLng - 117.14) < 0.03 &&
          Math.abs(first.gcjLat - 36.667) < 0.03,
        "Map coordinates were not converted to GCJ02",
      );
      await p.waitForFunction(
        () => !document.body.innerText.includes("正在识别地址"),
      );
      const suggested = await address.inputValue();
      assert(
        suggested.length > 0 || (await p.getByText(/未能识别地址/).count()) > 0,
        "No address or fallback guidance",
      );
      await address.fill("软件园食堂二层3号窗口");
      const pin = await marker.boundingBox();
      await p.mouse.move(pin.x + pin.width / 2, pin.y + pin.height / 2);
      await p.mouse.down();
      await p.mouse.move(
        pin.x + pin.width / 2 + 38,
        pin.y + pin.height / 2 + 26,
        { steps: 8 },
      );
      await p.mouse.up();
      const selected = await readPoint();
      assert(
        Math.abs(first.gcjLng - selected.gcjLng) > 0.000001 ||
          Math.abs(first.gcjLat - selected.gcjLat) > 0.000001,
        "Dragging did not update shop position",
      );
      assert(
        (await address.inputValue()) === "软件园食堂二层3号窗口",
        "Map overwrote manual door/floor details",
      );
      const afterPick = await canvas.boundingBox();
      await panMap(
        afterPick.x + afterPick.width * 0.25,
        afterPick.y + afterPick.height * 0.25,
        -24,
        32,
        "after picking and dragging the shop pin",
      );
      const afterPan = await readPoint();
      assert(
        Math.abs(afterPan.gcjLng - selected.gcjLng) < 0.000001 &&
          Math.abs(afterPan.gcjLat - selected.gcjLat) < 0.000001,
        "Panning changed the selected shop location",
      );
      assert(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        "Horizontal overflow",
      );
      await p.evaluate(() => window.scrollTo(0, 0));
      await p.screenshot({
        path: `../output/playwright/restaurant-location-${width}.png`,
        fullPage: true,
      });
      checks.push(
        `${width}px: real Baidu map click/drag, address ${suggested ? "autofill" : "fallback"}, manual detail preservation and responsive layout`,
      );

      await submit.click();
      await p.getByText("测试：请保留信息后重试", { exact: true }).waitFor();
      assert(
        (await address.inputValue()) === "软件园食堂二层3号窗口",
        "Failed create lost address",
      );
      assert(
        (await name.inputValue()) === "地图选点验收小店",
        "Failed create lost name",
      );
      rejectCreate = false;
      await submit.click();
      await p.waitForURL("**#/publish/dish");
      const body = creates.at(-1);
      assert(
        creates.length === 2 &&
          Math.abs(body.gcjLng - selected.gcjLng) < 0.000001 &&
          Math.abs(body.gcjLat - selected.gcjLat) < 0.000001,
        "Create payload differs from selected pin",
      );
      checks.push(
        `${width}px: failed submission preserves form; retry sends selected map coordinates and continues publishing (mock API only)`,
      );
    } finally {
      await context.close();
    }
  }
  assert(!errors.length, errors.join("\n"));
  return { checks, errors, realBusinessWrites: 0 };
}
