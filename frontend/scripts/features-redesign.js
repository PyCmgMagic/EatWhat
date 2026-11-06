async (page) => {
  const base = new URL(page.url()).origin + "/";
  const browser = page.context().browser();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const p = await context.newPage();
  const errors = [],
    unexpected = [],
    checks = [],
    layouts = [];
  p.setDefaultTimeout(8000);
  p.on("pageerror", (error) => errors.push(error.message));
  await context.route(
    (url) =>
      !["127.0.0.1", "localhost"].includes(url.hostname) ||
      url.pathname.startsWith("/api/"),
    (route) => {
      unexpected.push(route.request().url());
      return route.abort();
    },
  );
  const assert = (ok, label) => {
    if (!ok) throw new Error(label);
  };
  const waitForCount = (count) => p.waitForFunction(
    expected => document.querySelectorAll('.feature-link').length === expected,
    count,
  );
  const settle = async () => {
    await p.waitForFunction(() =>
      Boolean(document.querySelector('.pc-app')) === (innerWidth >= 600) &&
      document.querySelector('.feature-search'),
    );
    await p.getByRole("heading", { name: "全部功能", exact: true }).waitFor();
    await p.evaluate(async () => {
      await document.fonts.ready;
    });
  };
  try {
    await p.goto(base + "?demo=1#/features");
    await settle();
    assert(
      (await p.locator(".feature-link").count()) === 20,
      "All 20 directory entries remain accessible",
    );
    assert(
      (await p.locator(".feature-admin").count()) === 0,
      "Member must not see admin entry",
    );
    await p.getByRole("button", { name: "账号与安全 5", exact: true }).click();
    await waitForCount(5);
    assert((await p.locator(".feature-link").count()) === 5, "Category filter");
    await p
      .getByRole("searchbox", { name: "搜索功能", exact: true })
      .fill("  手机  换绑  ");
    await waitForCount(1);
    assert(
      (await p.locator(".feature-link").count()) === 1,
      "Whitespace and multi-term search",
    );
    const savedSearch = p.url();
    await p.locator(".feature-link").click();
    await p.getByRole("heading", { name: "更换手机号", exact: true }).waitFor();
    await p.locator(".v4-heading-home").click();
    await settle();
    assert(p.url() === savedSearch, "In-page return preserves search");
    await p.locator(".feature-link").click();
    await p.getByRole("heading", { name: "更换手机号", exact: true }).waitFor();
    await p.getByRole("link", { name: "返回", exact: true }).click();
    await settle();
    assert(p.url() === savedSearch, "Breadcrumb return preserves search");
    await p
      .getByRole("searchbox", { name: "搜索功能", exact: true })
      .fill("不存在的功能xyz");
    await p
      .getByRole("heading", { name: "没有找到相关功能", exact: true })
      .waitFor();
    await p.getByRole("button", { name: "查看全部功能", exact: true }).click();
    await waitForCount(20);
    assert(
      (await p.locator(".feature-link").count()) === 20,
      "Empty-state recovery",
    );
    assert(
      await p
        .getByRole("searchbox", { name: "搜索功能", exact: true })
        .evaluate((el) => el === document.activeElement),
      "Clear restores input focus",
    );
    await p
      .getByRole("searchbox", { name: "搜索功能", exact: true })
      .fill("收藏");
    await p
      .getByRole("searchbox", { name: "搜索功能", exact: true })
      .press("Escape");
    await waitForCount(20);
    assert(
      (await p.locator(".feature-link").count()) === 20,
      "Escape resets search",
    );
    checks.push(
      "Search, categories, multi-term matching, empty state, keyboard clear, two in-app return paths",
    );

    for (const width of [320, 390, 600, 820, 1024, 1440]) {
      await p.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
      await settle();
      const layout = await p.evaluate(() => {
        const search = document.querySelector(".feature-search");
        const input = search.querySelector("input");
        const group = document.querySelector(".feature-directory-heading");
        const bounds = [
          ...document.querySelectorAll(".feature-link, .feature-quick-link"),
        ].map((el) => el.getBoundingClientRect());
        return {
          width: innerWidth,
          overflow: document.documentElement.scrollWidth - innerWidth,
          searchWidth: search.getBoundingClientRect().width,
          headingWidth: group.getBoundingClientRect().width,
          inputBorder: getComputedStyle(input).borderTopWidth,
          minTargetHeight: Math.min(...bounds.map((rect) => rect.height)),
          outOfBounds: bounds.some(
            (rect) => rect.left < 0 || rect.right > innerWidth + 1,
          ),
        };
      });
      assert(
        layout.overflow <= 1 && !layout.outOfBounds,
        "Overflow at " + width,
      );
      assert(layout.minTargetHeight >= 44, "Small tap target at " + width);
      assert(layout.inputBorder === "0px", "Nested search border at " + width);
      if (width < 600)
        assert(
          Math.abs(layout.searchWidth - layout.headingWidth) < 2,
          "Mobile search must fill row",
        );
      layouts.push(layout);
      if (width === 390 || width === 1440)
        await p.screenshot({
          path:
            "output/playwright/features-redesign-" +
            (width === 390 ? "mobile" : "desktop") +
            ".png",
          fullPage: true,
        });
    }
    await p.getByRole("button", { name: "账号与安全 5", exact: true }).click();
    await waitForCount(5);
    const savedCategory = p.url();
    await p.locator('.feature-link[href="#/settings/devices"]').click();
    await p.getByRole("heading", { name: "登录设备", exact: true }).waitFor();
    await p.goBack();
    await settle();
    assert(
      p.url() === savedCategory &&
        (await p.locator(".feature-link").count()) === 5,
      "Browser back preserves category",
    );
    await p.goto(base + "?demo=1#/me");
    await p.locator('.pc-profile-menu a[href="#/features"]').waitFor();
    await p.locator('.pc-profile-menu a[href="#/features"]').click();
    await settle();
    assert(
      (await p
        .getByRole("navigation", { name: "桌面主导航", exact: true })
        .getByRole("link", { name: "我的", exact: true })
        .getAttribute("aria-current")) === "page",
      "Feature center belongs to My navigation",
    );
    checks.push("Profile entry and browser back");
    await p.goto(base + "?demo=1&persona=admin#/features");
    await p.locator(".feature-admin").waitFor();
    checks.push("Admin entry is role-gated");
    assert(
      errors.length === 0 && unexpected.length === 0,
      JSON.stringify({ errors, unexpected }),
    );
    return {
      checks,
      layouts,
      pageErrors: errors,
      realApiRequests: unexpected.length,
    };
  } catch (error) {
    await p.screenshot({
      path: "output/playwright/features-redesign-failure.png",
      fullPage: true,
    });
    throw error;
  } finally {
    await context.close();
  }
}
