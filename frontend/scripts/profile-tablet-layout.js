async function validateTabletProfile(browserPage) {
  const origin = await browserPage.evaluate(() => location.origin);
  const context = await browserPage
    .context()
    .browser()
    .newContext({
      viewport: { width: 900, height: 900 },
      reducedMotion: "reduce",
    });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await context.route(
    (url) => url.origin !== origin || url.pathname.startsWith("/api/"),
    (route) => route.abort(),
  );
  const menu = page.getByRole("navigation", { name: "个人中心", exact: true });
  const summary = page.locator(".profile-overview-summary");
  const mobile = page.locator(".mobile-profile-screen");
  const results = [];
  try {
    await page.goto(origin + "/?demo=1#/me");
    await summary.waitFor();
    await page.locator(".profile-overview-favorite").first().waitFor();
    const timeOrigin = await page.evaluate(() => performance.timeOrigin);
    for (const width of [640, 720, 820, 900, 1023]) {
      await page.setViewportSize({ width, height: 900 });
      const geometry = await page.evaluate(() => {
        const viewport = document.documentElement;
        const rail = document.querySelector(".pc-profile-rail");
        const menu = document.querySelector(".pc-profile-menu");
        const panel = document.querySelector(".pc-profile-workspace-content");
        const favorites = document.querySelector(".profile-overview-favorites");
        const railRect = rail.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        return {
          railWidth: railRect.width,
          panelWidth: panelRect.width,
          sideBySide: railRect.right < panelRect.left,
          vertical: getComputedStyle(menu).flexDirection === "column",
          menuOverflow: menu.scrollWidth > menu.clientWidth + 1,
          pageOverflow: viewport.scrollWidth > innerWidth + 1,
          cardsOverflow: favorites.scrollWidth > favorites.clientWidth + 1,
        };
      });
      if (
        !geometry.sideBySide ||
        !geometry.vertical ||
        geometry.menuOverflow ||
        geometry.pageOverflow ||
        geometry.cardsOverflow
      )
        throw new Error(width + "px: " + JSON.stringify(geometry));
      results.push({ width, ...geometry });
    }
    await page.setViewportSize({ width: 720, height: 900 });
    await menu.getByRole("link", { name: "我的收藏", exact: true }).click();
    await menu.locator('[aria-current="page"]').getByText("我的收藏").waitFor();
    await menu.getByRole("link", { name: "个人总览", exact: true }).click();
    await summary.waitFor();

    await page.setViewportSize({ width: 639, height: 900 });
    await mobile.waitFor();
    if (await menu.count())
      throw new Error("Desktop rail survived the mobile breakpoint");
    await page.setViewportSize({ width: 640, height: 900 });
    await summary.waitFor();
    await page.setViewportSize({ width: 1024, height: 900 });
    await menu.waitFor();
    if ((await page.evaluate(() => performance.timeOrigin)) !== timeOrigin)
      throw new Error("Layout switch reloaded the document");
    if (errors.length) throw new Error(errors.join("\n"));
    return results;
  } finally {
    await context.close();
  }
}
