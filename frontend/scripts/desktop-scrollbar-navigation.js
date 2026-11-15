async function validateDesktopScrollbar(browserPage) {
  const origin = await browserPage.evaluate(() => location.origin);
  const context = await browserPage
    .context()
    .browser()
    .newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });
  const page = await context.newPage();
  const measure = () =>
    page.evaluate(() => {
      const header = document
        .querySelector(".pc-header")
        .getBoundingClientRect();
      const brand = document.querySelector(".pc-header .pc-brand");
      const actions = document.querySelector(".pc-header-actions");
      return {
        gutter: innerWidth - header.width,
        headerWidth: header.width,
        brandX: brand.getBoundingClientRect().left,
        actionsX: actions.getBoundingClientRect().right,
      };
    });
  await context.route(
    (url) => url.origin !== origin || url.pathname.startsWith("/api/"),
    (route) => route.abort(),
  );
  try {
    await page.goto(origin + "/?demo=1#/");
    await page.locator(".pc-home").waitFor();
    const header = page.locator(".pc-header");
    const results = [];
    for (const viewport of [
      { width: 1024, height: 768 },
      { width: 1440, height: 900 },
      { width: 1920, height: 1200 },
    ]) {
      await page.setViewportSize(viewport);
      const home = await measure();
      await header.getByRole("link", { name: "我的", exact: true }).click();
      await page.locator(".pc-profile-workspace").waitFor();
      const profile = await measure();
      await header.getByRole("link", { name: "发现", exact: true }).click();
      await page.locator(".pc-home").waitFor();
      const returned = await measure();
      if (
        JSON.stringify(home) !== JSON.stringify(profile) ||
        JSON.stringify(home) !== JSON.stringify(returned)
      ) {
        throw new Error(
          "Desktop header shifted across routes: " +
            JSON.stringify({ viewport, home, profile, returned }),
        );
      }
      results.push({ viewport, ...home });
    }
    return results;
  } finally {
    await context.close();
  }
}
