async function validateNearbySheet(page) {
  const base = new URL(page.url()).origin;
  const context = await page
    .context()
    .browser()
    .newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
  const p = await context.newPage(),
    checks = [],
    errors = [];
  p.setDefaultTimeout(15000);
  p.on("pageerror", (e) =>
    errors.push(e.message.replace(/ak=[^&\s]+/g, "ak=[redacted]")),
  );
  const shops = Array.from({ length: 12 }, (_, i) => ({
    id: 81 + i,
    name: `校园餐厅 ${i + 1}`,
    address: `软件园测试位置 ${i + 1}`,
    gcjLng: 117.1401 + i * 0.0001,
    gcjLat: 36.6673 + i * 0.00015,
    pictureUrl: [],
  }));
  await context.route(
    () => true,
    (route) => {
      const request = route.request(),
        url = new URL(request.url());
      if (/(^|\.)(baidu\.com|bdimg\.com|bcebos\.com)$/.test(url.hostname))
        return route.continue();
      if (url.origin !== base) return route.abort();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      if (request.method() !== "GET") {
        errors.push("Unexpected write: " + url.pathname);
        return route.abort();
      }
      let data = [];
      if (url.pathname === "/api/campus/list")
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
      else if (
        ["/api/restaurant/browse", "/api/restaurant/search"].includes(
          url.pathname,
        )
      ) {
        const rows = shops.filter((r) =>
          r.name.includes(url.searchParams.get("keyword") || ""),
        );
        data = {
          items: rows,
          totalItems: rows.length,
          totalPages: 1,
          currentPage: 1,
          hasNext: false,
        };
      } else if (url.pathname.startsWith("/api/restaurant/detail/"))
        data = shops[0];
      else if (url.pathname === "/api/remote-config")
        data = {
          configVersion: 1,
          flags: {},
          params: {},
          maintenance: { mode: "NONE" },
          announcements: [],
          versions: {},
        };
      return route.fulfill({ status: 200, json: { code: 0, data } });
    },
  );
  const assert = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  const sheet = p.locator(".mobile-nearby-sheet"),
    handle = sheet.locator(".mobile-sheet-handle"),
    results = sheet.locator(".mobile-nearby-results"),
    map = p.locator(".mobile-nearby-map"),
    toolbar = p.locator(".mobile-nearby-toolbar"),
    nav = p.getByRole("navigation", { name: "主导航", exact: true });
  async function settled(expanded) {
    await p.waitForFunction((state) => {
      const el = document.querySelector(".mobile-nearby-sheet");
      return (
        el
          ?.querySelector(".mobile-sheet-handle")
          ?.getAttribute("aria-expanded") === String(state) &&
        !el.hasAttribute("data-sheet-moving")
      );
    }, expanded);
  }
  const cdp = await context.newCDPSession(p);
  async function touch(type, x, y) {
    await cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: ["touchEnd", "touchCancel"].includes(type) ? [] : [{ x, y }],
    });
  }
  async function dragTouch(distance, cancelled = false) {
    const box = await handle.boundingBox(),
      x = Math.round(box.x + box.width / 2),
      y = Math.round(box.y + box.height / 2);
    await touch("touchStart", x, y);
    for (let i = 1; i <= 12; i++)
      await touch("touchMove", x, Math.max(4, y + (distance * i) / 12));
    await touch(cancelled ? "touchCancel" : "touchEnd");
  }
  try {
    await p.goto(base + "/?demo=0#/nearby");
    await handle.waitFor();
    await p
      .locator('.restaurant-map-canvas[data-map-state="ready"]')
      .waitFor({ timeout: 30000 });
    await p.getByRole("radio").first().waitFor();
    const initial = await sheet.boundingBox(),
      control = await handle.boundingBox();
    const mapElement = await map.elementHandle();
    await p.mouse.move(control.x + control.width / 2, control.y + 15);
    await p.mouse.down();
    await p.mouse.move(control.x + control.width / 2, control.y - 85, {
      steps: 8,
    });
    assert(
      Math.abs((await sheet.boundingBox()).y - (initial.y - 100)) < 3,
      "Sheet does not follow the pointer",
    );
    await p.mouse.move(
      control.x + control.width / 2,
      (await toolbar.boundingBox()).height + 20,
      { steps: 8 },
    );
    await p.mouse.up();
    await settled(true);
    let open = await sheet.boundingBox(),
      header = await toolbar.boundingBox();
    assert(
      Math.abs(open.y - (header.y + header.height + 8)) < 3,
      "Expanded sheet covers the search toolbar",
    );
    assert(
      open.height > initial.height + 100,
      "Expanded list gains no usable height",
    );
    assert(
      (await map.evaluate((el) => el.inert)) &&
        !(await toolbar.evaluate((el) => el.inert)),
      "Covered map/search focus state is wrong",
    );
    assert(
      await map.evaluate((el, old) => el === old, mapElement),
      "Map was remounted during dragging",
    );
    checks.push(
      "Mouse drag follows the pointer; expansion preserves search and enlarges the list without remounting the map",
    );

    const box = await results.boundingBox(),
      x = Math.round(box.x + box.width / 2),
      y = Math.round(box.y + box.height * 0.75);
    await touch("touchStart", x, y);
    for (let i = 1; i <= 12; i++) await touch("touchMove", x, y - i * 16);
    await touch("touchEnd");
    await p.waitForFunction(
      () => document.querySelector(".mobile-nearby-results").scrollTop > 60,
    );
    assert(
      Math.abs((await sheet.boundingBox()).y - open.y) < 2 &&
        (await p.evaluate(() => scrollY === 0)),
      "List scrolling moved the sheet or page",
    );
    await dragTouch(120, true);
    await settled(true);
    await dragTouch(initial.y - open.y);
    await settled(false);
    assert(
      !(await map.evaluate((el) => el.inert)),
      "Map remained inert after collapse",
    );
    await p.getByRole("button", { name: "放大地图", exact: true }).click();
    await dragTouch(-(initial.y - open.y));
    await settled(true);
    checks.push(
      "Native touch scroll and drag stay separate; cancellation restores state and collapsing re-enables map controls",
    );

    await p
      .getByRole("searchbox", { name: "搜店名或地址", exact: true })
      .fill("餐厅 2");
    await p.waitForFunction(
      () => document.querySelectorAll(".mobile-nearby-shop").length === 1,
    );
    await settled(true);
    assert(
      (await handle.getAttribute("aria-expanded")) === "true",
      "Search reset the sheet state",
    );
    await p
      .getByRole("searchbox", { name: "搜店名或地址", exact: true })
      .fill("");
    await p.waitForFunction(
      () => document.querySelectorAll(".mobile-nearby-shop").length === 12,
    );
    await results.evaluate((el) => {
      el.scrollTop = 0;
    });
    await handle.focus();
    await p.keyboard.press("ArrowDown");
    await settled(false);
    await p.keyboard.press("ArrowUp");
    await settled(true);
    await p.keyboard.press("Escape");
    await settled(false);
    checks.push(
      "Search retains the chosen height; keyboard arrows and Escape control the same panel",
    );

    for (const [width, height] of [
      [320, 568],
      [390, 844],
      [520, 844],
    ]) {
      await p.setViewportSize({ width, height });
      await settled(false);
      await p.screenshot({
        path: `output/playwright/nearby-collapsed-${width}.png`,
        animations: "disabled",
      });
      await handle.click();
      await settled(true);
      open = await sheet.boundingBox();
      header = await toolbar.boundingBox();
      const navigation = await nav.boundingBox();
      assert(
        open.y >= header.y + header.height &&
          open.y + open.height <= navigation.y,
        "Sheet overlaps toolbar or navigation at " +
          width +
          JSON.stringify({ open, header, navigation }),
      );
      assert(
        !(await p.evaluate(
          () =>
            document.documentElement.scrollWidth > innerWidth || scrollY > 0,
        )),
        "Page overflow at " + width,
      );
      await p.screenshot({
        path: `output/playwright/nearby-expanded-${width}.png`,
        animations: "disabled",
      });
      await handle.click();
      await settled(false);
    }
    // Retarget a running transition rather than jumping to either endpoint.
    await handle.click();
    await p.waitForTimeout(50);
    await dragTouch(250);
    await settled(false);
    await p.emulateMedia({ reducedMotion: "reduce" });
    await handle.click();
    await settled(true);
    assert(
      (await sheet.evaluate(
        (el) => getComputedStyle(el).transitionDuration,
      )) === "0s",
      "Reduced motion still animates",
    );
    checks.push(
      "320/390/520px layouts, interrupted animation and reduced motion are usable; navigation remains visible",
    );
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto(base + "/?demo=1#/restaurants/1");
    await p.locator(".mobile-restaurant-menu").getByRole("link").first().click();
    await p.waitForURL((url) => /^#\/foods\/\d+$/.test(url.hash));
    checks.push("A dish can be opened from the restaurant menu");

    await p.goto(base + "/?demo=1#/publish/dish");
    const existing = p.getByRole("button", { name: /(展开|收起)发布表单$/ });
    await existing.waitFor();
    const original = await existing.boundingBox();
    await existing.focus();
    await p.keyboard.press("ArrowUp");
    assert(
      (await existing.getAttribute("aria-expanded")) === "true" &&
        (await existing.boundingBox()).y < 40,
      "Publishing sheet stopped expanding",
    );
    await p.keyboard.press("ArrowDown");
    assert(
      (await existing.getAttribute("aria-expanded")) === "false" &&
        Math.abs((await existing.boundingBox()).y - original.y) < 2,
      "Publishing sheet did not restore its position",
    );
    checks.push("The shared handle still expands and collapses the publishing form");
    assert(!errors.length, "Browser errors: " + errors.join("; "));
    return { checks, errors, realBackendWrites: 0 };
  } catch (error) {
    await p.screenshot({
      path: "output/playwright/nearby-sheet-failure.png",
      animations: "disabled",
    });
    throw new Error(
      String(error) +
        "\n" +
        JSON.stringify({ checks, errors }) +
        "\n" +
        (await p.locator("body").innerText()),
    );
  } finally {
    await context.close();
  }
}
