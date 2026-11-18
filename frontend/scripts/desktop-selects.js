async (page) => {
  const browser = page.context().browser(), checks = [], errors = [], issues = [];
  const base = "http://127.0.0.1:5173/?demo=1";
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  for (const width of [320, 390, 600, 820, 1024, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 940 }, hasTouch: width <= 820, isMobile: width < 600 });
    const p = await context.newPage();
    p.setDefaultTimeout(8000);
    p.on("pageerror", error => errors.push({ width, message: error.message }));
    await context.route(url => url.hostname !== "127.0.0.1" || url.pathname.startsWith("/api/"), route => route.abort());
    const press = async locator => width < 600 ? locator.tap() : locator.click();
    const bounds = async name => {
      await p.locator(".ew-select-popup").evaluate(async el => {
        await Promise.all(el.getAnimations().map(animation => animation.finished.catch(() => {})));
      });
      const result = await p.locator(".ew-select-popup").evaluate(el => {
        const rect = el.getBoundingClientRect();
        return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: innerWidth, height: innerHeight, scroll: document.documentElement.scrollWidth };
      });
      if (result.x < 0 || result.y < 0 || result.right > result.width + 1 || result.bottom > result.height + 1 || result.scroll > result.width + 1) issues.push({ width, name, ...result });
    };
    try {
      if (width >= 600) {
      await p.goto(base + "#/");
      await p.locator("body").ariaSnapshot();
      const campus = p.getByRole("combobox", { name: "推荐校区", exact: true });
      await campus.waitFor();
      await p.waitForFunction(() => !document.querySelector('[aria-label="推荐校区"][role="combobox"]')?.disabled);
      await press(campus);
      await p.getByRole("listbox").waitFor();
      await bounds("campus");
      assert(await p.getByRole("option").count() === 2, "campus placeholder should be hidden after selection");
      await press(p.getByRole("option", { name: "中心校区", exact: true }));
      assert((await campus.textContent()).includes("中心校区"), "campus did not update");
      await press(campus);
      await press(p.getByRole("option", { name: "软件园校区", exact: true }));
      await press(campus);
      await bounds("campus-reopen");
      if ([390, 1440].includes(width)) await p.screenshot({ path: `output/playwright/select-${width}-campus.png` });
      await campus.press("Escape");
      assert(await p.getByRole("listbox").count() === 0, "Escape did not close");
      const meal = p.getByRole("combobox", { name: "推荐饭点", exact: true });
      await press(meal);
      await press(p.getByRole("option", { name: "午饭", exact: true }));
      assert((await meal.textContent()).includes("午饭"), "meal did not update");
      await meal.press("ArrowDown");
      await meal.press("End");
      await meal.press("Enter");
      assert((await meal.textContent()).includes("夜宵"), "keyboard did not apply");
      await press(meal);
      await bounds("meal");
      if (width === 820) await p.screenshot({ path: "output/playwright/select-820-meal.png" });
      await p.mouse.click(width - 4, 4);
      assert(await p.getByRole("listbox").count() === 0, "outside pointer did not close");
      checks.push({ width, flow: "campus/meal, touch, keyboard, Escape, outside, placement" });

      }

      await p.goto(base + "#/search");
      await p.locator("body").ariaSnapshot();
      const category = p.getByRole("combobox", { name: "分类", exact: true });
      await press(category);
      await bounds("category");
      if (width === 390) await p.screenshot({ path: "output/playwright/select-390-category.png" });
      await press(p.getByRole("option", { name: "来杯喝的", exact: true }));
      const sort = p.getByRole("combobox", { name: "排序", exact: true });
      await sort.press("ArrowDown");
      await sort.press("End");
      await sort.press("Enter");
      await p.getByRole("button", { name: "查询", exact: true }).click();
      await p.waitForURL(/category=drink/);
      assert(p.url().includes("sort=PRICE_DESC"), "FormData sorting lost");
      await p.getByRole("button", { name: "重置", exact: true }).click();
      await p.waitForURL(url => !url.hash.includes("category="));
      assert((await category.textContent()).includes("全部"), "reset category label stale");
      checks.push({ width, flow: "search FormData submission/reset" });

      if (width >= 600) {
        await p.goto(base + "#/me/edit");
        await p.locator("body").ariaSnapshot();
        await press(p.getByRole("combobox", { name: "性别", exact: true }));
        await bounds("gender");
        await press(p.getByRole("option", { name: "女", exact: true }));
        assert((await p.locator("#profile-gender-native").inputValue()) === "female", "gender value mismatch");
        if (width === 1440) await p.screenshot({ path: "output/playwright/select-1440-profile.png", fullPage: true });
        checks.push({ width, flow: "profile gender" });
      }

      for (const route of ["/users/21", "/history", "/foods/1/edit"]) {
        await p.goto(base + "#" + route);
        await p.getByRole("combobox").first().waitFor();
        await p.locator("body").ariaSnapshot();
        const selects = p.getByRole("combobox");
        for (let index = 0; index < await selects.count(); index++) {
          const select = selects.nth(index);
          if (!await select.isEnabled()) continue;
          await press(select);
          await p.getByRole("listbox").waitFor();
          await bounds(route + ":" + index);
          if (route === "/foods/1/edit" && index === 0 && width === 1440) await p.screenshot({ path: "output/playwright/select-1440-palette.png" });
          await select.press("Escape");
        }
        const overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        assert(!overflow, "page overflow: " + route);
        checks.push({ width, flow: "menus " + route });
      }
    } catch (error) {
      issues.push({ width, error: String(error), url: p.url(), text: (await p.locator("body").innerText()).slice(-1200) });
      await p.screenshot({ path: `output/playwright/select-${width}-failure.png` });
    } finally { await context.close(); }
  }
  return { checks, issues, errors };
}
