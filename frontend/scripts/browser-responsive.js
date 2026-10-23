async (page) => {
  const checked = [];
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: width > 760 ? 1000 : 844 });
    for (const route of [
      "/",
      "/recommend",
      "/restaurants",
      "/foods/1",
      "/favorites",
      "/publish?restaurantId=1",
      "/me",
      "/settings",
    ]) {
      await page.goto("http://127.0.0.1:5173/?demo=1#" + route);
      await page.locator("main h1").waitFor();
      await page.waitForFunction(
        () => document.querySelectorAll(".loading-state").length === 0,
      );
      const state = await page.evaluate(() => ({
        width: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        images: [...document.images]
          .filter(
            (i) => i.loading !== "lazy" && i.complete && i.naturalWidth === 0,
          )
          .map((i) => i.alt),
      }));
      if (state.documentWidth > width)
        throw new Error(
          "Horizontal overflow: " +
            width +
            " " +
            route +
            " " +
            state.documentWidth,
        );
      if (state.images.length)
        throw new Error("Broken visible photos: " + state.images.join(","));
      checked.push({ width, route });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("http://127.0.0.1:5173/?demo=1&persona=admin#/admin");
  await page.getByRole("button", { name: "餐厅维护", exact: true }).click();
  await page.getByRole("cell", { name: "一食堂 · 日式面档 #1" }).waitFor();
  await page.screenshot({
    path: "output/playwright/app-desktop-admin.png",
    scale: "css",
  });
  await page.goto("http://127.0.0.1:5173/?demo=1#/foods/1");
  await page
    .getByRole("heading", { name: "溏心蛋豚骨拉面", exact: true })
    .waitFor();
  await page.screenshot({
    path: "output/playwright/app-desktop-detail.png",
    scale: "css",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:5173/?demo=1");
  await page
    .getByRole("heading", { name: "今天，想吃点什么？", exact: true })
    .waitFor();
  await page.screenshot({
    path: "output/playwright/app-mobile-discover.png",
    scale: "css",
  });
  await page.goto("http://127.0.0.1:5173/?demo=1#/recommend");
  await page
    .getByRole("heading", { name: "生活再忙， 也要好好吃饭。" })
    .waitFor();
  await page.screenshot({
    path: "output/playwright/app-mobile-recommend.png",
    scale: "css",
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("http://127.0.0.1:5173/?demo=1");
  await page
    .getByRole("heading", { name: "今天，想吃点什么？", exact: true })
    .waitFor();
  await page.screenshot({
    path: "output/playwright/app-desktop-discover.png",
    scale: "css",
  });
  return { responsiveChecks: checked.length, checked };
}
