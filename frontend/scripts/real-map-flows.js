async (page) => {
  const context = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, permissions: ["geolocation"], geolocation: { longitude: 117.134, latitude: 36.667 } });
  const p = await context.newPage(), checks = [], errors = [], tileResponses = [], unexpected = [], searches = [], creations = [];
  p.setDefaultTimeout(15000);
  p.on("pageerror", e => errors.push(e.message.replace(/ak=[^&\s]+/g, "ak=[redacted]")));
  p.on("response", r => { if (/(^|\.)(baidu\.com|bdimg\.com|bcebos\.com)$/.test(new URL(r.url()).hostname)) tileResponses.push(r.status()); });
  let blockTiles = false;
  const shops = [
    { id: 81, name: "校内餐厅甲", address: "软件园东侧", gcjLng: 117.1401, gcjLat: 36.6673, pictureUrl: ["/prototype/assets/photos/sq_luosi.png"] },
    { id: 82, name: "校内餐厅乙", address: "软件园北侧", gcjLng: 117.1424, gcjLat: 36.669, pictureUrl: [] },
    { id: 83, name: "尚未标注位置的店", address: "保留在列表中", gcjLng: null, gcjLat: null, pictureUrl: [] },
  ];
  await context.addInitScript(() => {
    if (location.hostname === "127.0.0.1") localStorage.setItem("eatwhat-session", JSON.stringify({ tokenName: "x-map-test", tokenValue: "isolated-map-test" }));
  });
  const reply = (r, data) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ code: 0, data, msg: "ok" }) });
  await context.route(() => true, r => {
    const request = r.request(), url = new URL(request.url());
    if (/(^|\.)(baidu\.com|bdimg\.com|bcebos\.com)$/.test(url.hostname)) {
      if (request.headers()["x-map-test"]) throw new Error("Session token sent to tile provider");
      return blockTiles ? r.abort() : r.continue();
    }
    if (url.hostname !== "127.0.0.1") { unexpected.push(url.origin); return r.abort(); }
    if (url.pathname === "/src/features/BaiduMap.tsx") {
      return r.fetch().then(async response => {
        const original = await response.text();
        const body = original.replace("map.current = instance;", "map.current = instance; window.__baiduTestMap = instance;");
        if (body === original) throw new Error("Map test instrumentation did not match");
        return r.fulfill({ response, body });
      });
    }
    if (!url.pathname.startsWith("/api/")) return r.continue();
    if (url.pathname === "/api/user/info") return reply(r, { id: 10, displayName: "地图验收用户", verified: true, banned: false, role: "user" });
    if (url.pathname === "/api/campus/list") return reply(r, [{ id: 1, name: "软件园", gcjLng: 117.1401, gcjLat: 36.6673, open: true, isDefault: true }]);
    if (url.pathname === "/api/notification/unread/count") return reply(r, 0);
    if (["/api/restaurant/browse", "/api/restaurant/search"].includes(url.pathname)) {
      searches.push({ path: url.pathname, query: Object.fromEntries(url.searchParams) });
      const rows = shops.filter(s => s.name.includes(url.searchParams.get("keyword") || ""));
      return reply(r, { items: rows, totalItems: rows.length, totalPages: 1, currentPage: 1, hasNext: false });
    }
    if (url.pathname === "/api/restaurant/add") { const body = request.postDataJSON(); creations.push(body); return reply(r, { id: 901 }); }
    if (url.pathname === "/api/restaurant/detail/901") return reply(r, { ...creations[creations.length - 1], id: 901 });
    if (url.pathname.startsWith("/api/restaurant/detail/")) return reply(r, shops.find(s => s.id === Number(url.pathname.split("/").pop())) || shops[0]);
    if (url.pathname === "/api/foods/tags/system") return reply(r, []);
    return reply(r, { items: [], totalItems: 0, hasNext: false });
  });
  const base = "http://127.0.0.1:5173/";
  const loaded = async () => {
    await p.locator(".restaurant-map-canvas").waitFor();
    await p.locator('.restaurant-map-canvas[data-map-state="ready"]').waitFor();
    if (!await p.locator(".restaurant-map-canvas canvas").count()) throw new Error("Baidu renderer did not create its canvas");
  };
  try {
    for (const width of [320, 390, 820, 1440]) {
      await p.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
      await p.goto(base + "#/nearby");
      await loaded();
      if (await p.locator(".restaurant-map-marker").count() !== 2) throw new Error("Missing coordinates produced an arbitrary map pin");
      await p.getByText("1 家店暂缺坐标，可在列表中查看", { exact: true }).waitFor();
      await p.getByRole("button", { name: "选择校内餐厅乙", exact: true }).click();
      await p.locator('.restaurant-map-marker.is-selected[aria-label="选择校内餐厅乙"]').waitFor();
      if (width < 600) {
        if (!(await p.locator(".mobile-nearby-shop.is-selected").innerText()).includes("校内餐厅乙")) throw new Error("Marker did not select mobile list row");
        await p.getByRole("radio", { name: "校内餐厅甲 软件园东侧", exact: true }).click();
      } else {
        if ((await p.locator(".pc-map-selected h2").innerText()) !== "校内餐厅乙") throw new Error("Marker did not update the desktop card");
        await p.getByRole("button", { name: "校内餐厅甲 软件园东侧", exact: true }).click();
      }
      await p.locator('.restaurant-map-marker.is-selected[aria-label="选择校内餐厅甲"]').waitFor();
      if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw new Error("Map causes horizontal overflow");
      if (!(await p.locator(".restaurant-map-canvas").innerText()).includes("Baidu")) throw new Error("Missing Baidu attribution");
      if (!await p.evaluate(() => window.BMap.coordType === BMAP_COORD_BD09 && window.BMapGL.coordType === BMAP_COORD_BD09)) throw new Error("Baidu map is not using the backend coordinate system");
      await p.screenshot({ path: `output/playwright/baidu-map-${width}.png` });
      checks.push(`${width}px: Baidu map loaded, coordinate-based pins, missing-location handling, marker/list selection and visible attribution`);
    }
    await p.getByRole("button", { name: "放大地图", exact: true }).click();
    await loaded();
    checks.push("Map supports actual zoom and tile updates");
    const queryCount = searches.length;
    await p.getByRole("button", { name: "回到我的位置", exact: true }).click();
    await p.waitForFunction(() => document.body.innerText.includes("当前位置"));
    await p.locator(".restaurant-map-device-dot").waitFor();
    await p.waitForFunction(() => document.querySelector(".pc-nearby-list-scroll")?.getAttribute("aria-busy") === "false");
    const search = searches.slice(queryCount).find(s => s.path.endsWith("/search"));
    if (!search || Math.abs(Number(search.query.gcjLng) - 117.134) < 0.001) throw new Error("Device coordinates were not converted for the backend");
    const mapBox = await p.locator(".restaurant-map-canvas").boundingBox();
    await p.mouse.move(mapBox.x + 70, mapBox.y + 100); await p.mouse.down(); await p.mouse.move(mapBox.x + 160, mapBox.y + 160, { steps: 8 }); await p.mouse.up();
    await p.getByRole("button", { name: "回到我的位置", exact: true }).click();
    await p.waitForFunction(async target => {
      const center = window.__baiduTestMap?.getCenter();
      const { baiduToGcj } = await import("/src/features/map-geometry.ts");
      const gcj = center && baiduToGcj(center.lng, center.lat);
      return gcj && Math.abs(gcj.gcjLng - target.lng) < 1e-5 && Math.abs(gcj.gcjLat - target.lat) < 1e-5;
    }, { lng: Number(search.query.gcjLng), lat: Number(search.query.gcjLat) });
    checks.push("Opt-in geolocation converts WGS84 to GCJ02 for searches and repeated location clicks recenter after dragging");
    blockTiles = true;
    await p.reload();
    await p.getByText("地图暂时无法显示", { exact: true }).waitFor();
    if (!await p.locator(".pc-shop-row").count()) throw new Error("Tile failure removed restaurant list");
    blockTiles = false;
    await p.getByRole("button", { name: "重新加载地图", exact: true }).click();
    await loaded();
    await p.evaluate(() => Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: (success, failure) => failure({ code: 1 }) } }));
    await p.getByRole("button", { name: "回到我的位置", exact: true }).click();
    await p.getByText("定位权限被拒绝，请在浏览器的站点设置中允许定位，并检查系统是否允许浏览器访问位置。", { exact: true }).waitFor();
    checks.push("Tile failures are retryable without losing the list; denied location is reported honestly");
    for (const width of [390, 1440]) {
      await p.setViewportSize({ width, height: 1000 });
      await p.goto(base + "#/restaurants/new/details");
      await p.reload();
      await loaded();
      if (await p.locator('input[name="lng"], input[name="lat"]').count()) throw new Error("Manual coordinate fields remain");
      const submit = p.getByRole('button', {name:width < 640 ? '添加并继续' : '提交新店',exact:true});
      if (!await submit.isDisabled()) throw new Error("Campus center silently became a shop location");
      const picked = () => p.evaluate(async () => {
        const marker = window.__baiduTestMap.getOverlays().find(o => o.getTitle?.() === '店铺位置，可拖动调整');
        const value = marker.getPosition();
        const { baiduToGcj } = await import('/src/features/map-geometry.ts');
        return baiduToGcj(value.lng, value.lat);
      });
      const box = await p.locator(".restaurant-map-canvas").boundingBox();
      await p.locator(".restaurant-map-canvas").click({ position: { x: box.width * 0.55, y: box.height * 0.45 } });
      await p.locator('.restaurant-map-canvas [title="店铺位置，可拖动调整"]').waitFor();
      const {gcjLng:selectedLng,gcjLat:selectedLat} = await picked();
      if (Math.abs(selectedLng - 117.14) > 0.03 || Math.abs(selectedLat - 36.667) > 0.03) throw new Error("Map pick did not fill converted coordinates");
      const pin = await p.locator('.restaurant-map-canvas [title="店铺位置，可拖动调整"]').boundingBox();
      await p.mouse.move(pin.x + pin.width / 2, pin.y + pin.height / 2); await p.mouse.down(); await p.mouse.move(pin.x + 40, pin.y + 40, { steps: 8 }); await p.mouse.up();
      const afterDrag = await picked();
      if (afterDrag.gcjLng === selectedLng && afterDrag.gcjLat === selectedLat) throw new Error("Dragging the picked pin did not update coordinates");
      await p.getByLabel(width < 640 ? "店名" : "店铺名称", { exact: true }).fill(`地图选点验收${width}`);
      await p.getByLabel("详细地址", { exact: true }).fill("验收地址，不会写入真实后端");
      await submit.click();
      await p.waitForURL("**#/publish/dish");
      if (creations[creations.length - 1]?.gcjLng == null) throw new Error("Picked coordinates were omitted from the create request");
      checks.push(`${width}px: map click/drag fills GCJ02 coordinates; isolated create request preserves the picked point`);
    }
    if (unexpected.length || errors.length || !tileResponses.some(s => s === 200)) throw new Error("Unexpected browser errors, provider requests or no successful Baidu map");
    return { checks, errors, baiduResponses: tileResponses.length, baiduSuccessResponses: tileResponses.filter(s => s === 200).length, unexpected, isolatedCreates: creations.length };
  } catch (error) {
    await p.screenshot({ path: "output/playwright/baidu-map-failure.png" });
    return { checks, errors, failure: String(error), url: p.url(), debug: await p.evaluate(() => ({ center: window.__baiduTestMap?.getCenter(), overlays: window.__baiduTestMap?.getOverlays().map(o => o.getPoint?.() || o.getPosition?.()), dot: document.querySelector(".restaurant-map-device-dot")?.getBoundingClientRect().toJSON(), map: document.querySelector(".restaurant-map-canvas")?.getBoundingClientRect().toJSON() })), snapshot: (await p.locator("body").innerText()).slice(-2200) };
  } finally { await context.close(); }
}
