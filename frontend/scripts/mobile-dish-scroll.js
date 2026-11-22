// Playwright CLI run-code --filename frontend/scripts/mobile-dish-scroll.js
async (page) => {
  const base = new URL(page.url()).origin;
  const browser = page.context().browser();
  const engine = browser.browserType().name();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const p = await context.newPage(),
    errors = [],
    checks = [];
  p.setDefaultTimeout(10000);
  p.on("pageerror", (error) => errors.push(error.message));
  const assert = (value, message) => {
    if (!value) throw Error(message);
  };
  let fixture = {
    id: 71,
    name: "大肠豆腐",
    price: 7.5,
    category: "dish",
    restaurantId: 9,
    restaurantName: "山东大学（软件园校区）食堂",
    accountId: 10,
    pictureUrls: ["/prototype/assets/photos/sq_luosi.png"],
    description: "猎奇",
    likesCount: 1,
    isLiked: false,
    isFavorite: false,
  };
  // Both real-mode fixtures and demo actions stay local.
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== base) return route.abort();
    if (!url.pathname.startsWith("/api/")) return route.continue();
    let data = { items: [], totalItems: 0, hasNext: false };
    if (url.pathname === "/api/foods/detail/71") data = fixture;
    else if (url.pathname === "/api/restaurant/detail/9")
      data = {
        id: 9,
        name: fixture.restaurantName,
        address: "山东省济南市历城区舜华路1500号",
      };
    else if (url.pathname === "/api/campus/list")
      data = [{ id: 1, name: "软件园", open: true, isDefault: true }];
    else if (url.pathname === "/api/remote-config")
      data = {
        configVersion: 1,
        flags: {},
        params: {},
        maintenance: { mode: "NONE" },
        announcements: [],
        versions: {},
      };
    return route.fulfill({ json: { code: 0, data } });
  });
  const settle = () =>
    p.evaluate(async () => {
      await document.fonts.ready;
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
    });
  const scroll = async (fraction) => {
    await p.evaluate((fraction) => {
      const screen = document.querySelector(".mobile-dish-screen");
      const sheet = screen.querySelector(".dish-sheet");
      const toolbar = screen.querySelector(".dish-toolbar");
      const origin = scrollY + screen.getBoundingClientRect().top;
      window.scrollTo({
        top: origin + fraction * (sheet.offsetTop - toolbar.offsetHeight),
        behavior: "instant",
      });
    }, fraction);
    await settle();
  };
  const measure = () =>
    p.evaluate(() => {
      const toolbar = document.querySelector(".dish-toolbar");
      const hero = document.querySelector(".dish-hero");
      const sheet = document.querySelector(".dish-sheet");
      const summary = document.querySelector(".dish-toolbar-summary");
      const r = toolbar.getBoundingClientRect(),
        h = hero.getBoundingClientRect(),
        s = sheet.getBoundingClientRect();
      return {
        top: r.top,
        bottom: r.bottom,
        heroTop: h.top,
        sheetTop: s.top,
        opacity: Number(getComputedStyle(summary).opacity),
      corner: parseFloat(getComputedStyle(sheet).borderTopLeftRadius),
      headerShadow: getComputedStyle(toolbar, "::before").boxShadow,
        inert: hero.inert,
        hidden: summary.getAttribute("aria-hidden"),
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        coveredBySheet: !!document
          .elementFromPoint(innerWidth / 2, Math.max(s.top + 36, r.bottom + 36))
          ?.closest(".dish-sheet"),
        targets: [...toolbar.querySelectorAll(".dish-icon-button")].every(
          (el) => {
            const b = el.getBoundingClientRect();
            return (
              b.width >= 44 &&
              b.height >= 44 &&
              b.left >= 0 &&
              b.right <= innerWidth &&
              el.contains(
                document.elementFromPoint(
                  b.x + b.width / 2,
                  b.y + b.height / 2,
                ),
              )
            );
          },
        ),
      };
    });
  try {
    for (const [width, height] of [
      [320, 568],
      [390, 844],
      [520, 900],
      [390, 320],
    ]) {
      await p.setViewportSize({ width, height });
      await p.goto(base + "/?demo=0&view=mobile#/foods/71");
      await p
        .getByRole("heading", { name: fixture.name, exact: true })
        .waitFor();
      await settle();
      await scroll(0);
      const top = await measure();
      assert(
        top.opacity === 0 && !top.inert && top.targets && !top.overflow,
        "Initial layout: " + JSON.stringify(top),
      );
      await scroll(0.6);
      const middle = await measure();
      assert(
        middle.sheetTop < top.sheetTop &&
          middle.coveredBySheet &&
          middle.opacity > 0 &&
          middle.opacity < 1 &&
          middle.top === 0,
        "No progressive cover: " + JSON.stringify(middle),
      );
      if (height > 500)
        assert(
          Math.abs(top.heroTop - middle.heroTop) < 1,
          "Cover scrolls away instead of staying behind the sheet",
        );
      if (width === 390 && height === 844)
        await p.screenshot({
          path: `output/playwright/dish-scroll-${engine}-middle.png`,
        });
      await scroll(1);
      const full = await measure();
      assert(full.corner === 0 && full.headerShadow === "none", "A corner or divider leaves a seam below the toolbar");
      assert(
        full.sheetTop <= full.bottom + 1 &&
          full.opacity === 1 &&
          full.inert &&
          full.hidden === "false" &&
          full.targets &&
          !full.overflow,
        "Collapsed layout: " + JSON.stringify(full),
      );
      assert(
        (await p
          .getByRole("heading", { name: fixture.name, exact: true })
          .count()) === 1,
        "Duplicate accessible title",
      );
      await p.getByLabel("更多菜品操作", { exact: true }).click();
      await p
        .getByRole("button", { name: "举报这道菜", exact: true })
        .click({ trial: true });
      await p.keyboard.press("Escape");
      assert(
        await p
          .getByLabel("更多菜品操作", { exact: true })
          .evaluate(
            (el) => el === document.activeElement && !el.parentElement.open,
          ),
        "Menu focus was lost",
      );
      if (width === 390 && height === 844)
        await p.screenshot({
          path: `output/playwright/dish-scroll-${engine}-collapsed.png`,
        });
      await scroll(0);
      const restored = await measure();
      assert(restored.corner === 28, "Reverse scroll did not restore the rounded card");
      assert(
        restored.opacity === 0 && !restored.inert && restored.hidden === "true",
        "Reverse scroll did not restore cover",
      );
      if (width === 390 && height === 844) {
        const handle = p.locator(".dish-sheet-handle");
        const dimensions = await handle.evaluate(el => ({
          height: el.getBoundingClientRect().height,
          bar: el.firstElementChild.getBoundingClientRect().width,
          touch: getComputedStyle(el).touchAction,
        }));
        assert(dimensions.height >= 44 && dimensions.bar === 36 && dimensions.touch === "none", "Handle differs from the home sheet");
        const waitExpanded = async (value) => {
          await p.waitForFunction(value => document.querySelector(".dish-sheet-handle").getAttribute("aria-expanded") === String(value) && (value || scrollY <= 1), value);
          await settle();
        };
        await p.getByRole("button", {name:"展开菜品详情",exact:true}).click();
        await waitExpanded(true);
        assert((await measure()).corner === 0, "Handle expansion reintroduced the seam");
        await p.getByRole("button", {name:"收起菜品详情",exact:true}).click();
        await waitExpanded(false);
        await handle.press("Enter");
        await waitExpanded(true);
        await handle.press("Escape");
        await waitExpanded(false);
        for (const delta of [-160, 160]) {
          const bounds = await handle.boundingBox();
          const x = bounds.x + bounds.width / 2, y = bounds.y + 16;
          await p.mouse.move(x, y);
          await p.mouse.down();
          await p.mouse.move(x, y + delta, {steps: 12});
          await p.mouse.up();
          await waitExpanded(delta < 0);
        }
        assert((await measure()).corner === 28, "Drag did not restore rounded cover");
        checks.push("Matching handle: click, keyboard, drag up/down and seamless attachment");
      }
      checks.push(
        `${width}x${height}: progressive overlap, fixed actions, menu, reverse scroll`,
      );
    }
    await p.setViewportSize({ width: 320, height: 568 });
    fixture = {
      ...fixture,
      name: "鲜虾蟹籽云吞与酸辣牛筋面双人套餐",
      price: null,
      description: "这是一段完整保留的用餐感受。".repeat(35),
    };
    await p.reload();
    await p.getByRole("heading", { name: fixture.name, exact: true }).waitFor();
    await scroll(1);
    assert(
      (await measure()).targets && !(await measure()).overflow,
      "Long name squeezed actions",
    );
    assert(
      (await p.locator(".dish-description").innerText()) ===
        fixture.description,
      "Long text was truncated",
    );
    await p.setViewportSize({ width: 520, height: 900 });
    await settle();
    await scroll(1);
    assert(
      (await measure()).inert && (await measure()).targets,
      "Resize left stale collapse bounds",
    );
    checks.push(
      "Long name, missing price, full description and responsive remeasurement",
    );

    await p.emulateMedia({ reducedMotion: "reduce" });
    await scroll(0.6);
    assert(
      await p
        .locator(".dish-toolbar-summary")
        .evaluate((el) => getComputedStyle(el).transform === "none"),
      "Reduced motion still translates the title",
    );
    assert(
      await p
        .locator(".dish-hero")
        .evaluate((el) => getComputedStyle(el).position === "relative"),
      "Reduced motion retains parallax",
    );
    await scroll(1);
    assert(
      (await measure()).targets && (await measure()).opacity === 1,
      "Reduced motion lost header functions",
    );
    checks.push(
      "Reduced motion keeps information and actions without parallax",
    );
    await p.getByRole("button", {name:"收起菜品详情",exact:true}).click();
    await p.waitForFunction(() => scrollY <= 1);
    await p.getByRole("button", {name:"展开菜品详情",exact:true}).click();
    await settle();
    assert((await measure()).inert, "Reduced-motion handle failed to open instantly");

    await p.emulateMedia({ reducedMotion: "no-preference" });
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto(base + "/?demo=1&view=mobile#/foods/1");
    await p.locator(".dish-hero h1").waitFor();
    await scroll(1);
    const favorite = p.locator(".dish-favorite"),
      old = await favorite.getAttribute("aria-pressed");
    await favorite.click();
    await p.waitForFunction(
      (old) =>
        document
          .querySelector(".dish-favorite")
          .getAttribute("aria-pressed") !== old,
      old,
    );
    await favorite.click();
    await p.waitForFunction(
      (old) =>
        document
          .querySelector(".dish-favorite")
          .getAttribute("aria-pressed") === old,
      old,
    );
    await p.evaluate(() =>
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async (data) => {
          window.__dishShared = data;
        },
      }),
    );
    await p.getByRole("button", { name: "分享菜品", exact: true }).click();
    await p.getByRole("button", { name: "分享给朋友", exact: true }).click();
    await p.waitForFunction(() => window.__dishShared?.url === location.href);
    await p.getByRole("link", { name: "去这家店", exact: true }).click();
    await p.waitForURL("**#/restaurants/1");
    await p.goBack();
    await p.locator(".dish-toolbar").waitFor();
    await scroll(0);
    await p
      .getByRole("button", { name: "查看鲜虾蟹籽云吞大图", exact: true })
      .press("Enter");
    await p.getByRole("dialog").waitFor();
    await p.keyboard.press("Escape");
    await p.getByRole("dialog").waitFor({ state: "hidden" });
    await p.getByRole("link", { name: "返回", exact: true }).click();
    await p.locator(".mobile-dish-screen").waitFor({ state: "detached" });
    checks.push(
      "Favorite, share, restaurant, photo preview and back retain their existing behavior",
    );
    assert(!errors.length, errors.join("\n"));
    return { engine, checks, errors, realBackendRequests: 0 };
  } catch (error) {
    await p.screenshot({
      path: `output/playwright/dish-scroll-${engine}-failure.png`,
    });
    throw Error(
      JSON.stringify({ checks, error: String(error), errors, url: p.url() }),
    );
  } finally {
    await context.close();
  }
}
