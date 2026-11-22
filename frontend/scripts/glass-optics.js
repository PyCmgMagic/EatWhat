// Run with playwright-cli run-code --filename against the current dev/preview URL.
async function verifyGlassOptics(page) {
  const base = new URL(page.url()).origin;
  const context = await page
    .context()
    .browser()
    .newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
      permissions: ["geolocation"],
      geolocation: { latitude: 36.667, longitude: 117.134 },
      storageState: await page.context().storageState(),
    });
  await context.addInitScript(() => {
    localStorage.setItem(
      "eatwhat-session",
      JSON.stringify({ tokenName: "satoken", tokenValue: "v2-demo-student" }),
    );
  });
  await context.route(
    (url) => url.pathname.startsWith("/api/"),
    (route) => route.abort(),
  );
  const p = await context.newPage();
  const errors = [],
    themes = [];
  p.on("pageerror", (error) => errors.push(error.message));
  const assert = (value, message) => {
    if (!value) throw new Error(message);
  };
  try {
    await p.goto(base + "/?demo=v2&view=mobile#/settings/personalization");
    const chromium = await p.evaluate(
      () =>
        "chrome" in window ||
        /\b(Chrome|HeadlessChrome|Chromium|Edg)\//.test(navigator.userAgent),
    );
    for (const [name, theme] of [
      ["浅色", "light"],
      ["深色", "dark"],
    ]) {
      await p.getByRole("radio", { name, exact: true }).check();
      await p.waitForFunction(
        (theme) => document.documentElement.dataset.theme === theme,
        theme,
      );
      await p.waitForFunction(
        () => document.querySelectorAll('[data-optics="true"]').length === 2,
      );
      const surfaces = await p
        .locator(".design-glass-backdrop")
        .evaluateAll((elements) =>
          elements.map((element) => ({
            refraction: element.dataset.refracting === "true",
            filter: getComputedStyle(element).backdropFilter,
            inset: getComputedStyle(element).boxShadow,
            outline: getComputedStyle(element.parentElement, "::before")
              .backgroundImage,
            reflection: getComputedStyle(
              element,
              "::after",
            ).backgroundImage.startsWith('url("data:image/png'),
            hidden: element.getAttribute("aria-hidden"),
          })),
        );
      assert(
        surfaces.every(
          (s) =>
            s.refraction === chromium && s.filter.includes("url(") === chromium,
        ),
        "Browser-specific refraction: " + JSON.stringify(surfaces),
      );
      assert(
        surfaces.every(
          (s) =>
            s.inset === "none" &&
            s.outline === "none" &&
            s.reflection &&
            s.hidden === "true",
        ),
        "Shared surface lighting: " + JSON.stringify(surfaces),
      );
      themes.push({ theme, surfaces });
      await p.getByRole("img", { name: "底部导航外观预览" }).screenshot({
        path: `output/playwright/glass-optics-${chromium ? "chromium" : "fallback"}-${theme}.png`,
      });
      await p.emulateMedia({ contrast: "more" });
      await p.waitForFunction(
        () => !document.querySelector('[data-optics="true"]'),
      );
      assert(
        await p
          .locator(".design-glass-backdrop")
          .evaluateAll((elements) =>
            elements.every(
              (e) => getComputedStyle(e).backdropFilter === "none",
            ),
          ),
        "Contrast preference removes optics",
      );
      await p.emulateMedia({ contrast: "no-preference" });
      await p.waitForFunction(
        () => document.querySelectorAll('[data-optics="true"]').length === 2,
      );
    }
    await p.getByRole("radio", { name: "浅色", exact: true }).check();
    await p.goto(base + "/?demo=v2&view=mobile#/");
    const nav = p.getByRole("navigation", { name: "主导航", exact: true });
    await nav.waitFor();
    await p.waitForFunction(
      () => document.querySelectorAll('[data-optics="true"]').length === 2,
    );
    const map = await nav
      .locator(".design-glass-backdrop")
      .getAttribute("style");
    await nav.hover();
    await p.evaluate(() => window.scrollBy(0, 300));
    assert(
      (await nav.locator(".design-glass-backdrop").getAttribute("style")) ===
        map,
      "Scrolling and pointer movement reuse the map",
    );
    for (const name of ["附近", "我的", "发现"]) {
      await nav.getByRole("link", { name, exact: true }).click();
      await p.waitForFunction(
        (name) =>
          document
            .querySelector('nav[aria-label="主导航"] [aria-current="page"]')
            ?.textContent.trim() === name,
        name,
      );
    }
    await p.getByRole("button", { name: "发布一道菜", exact: true }).click();
    await p.waitForURL(/#\/publish/);
    assert(!errors.length, errors.join("\n"));
    return {
      chromium,
      themes,
      contrastRestoration: true,
      mapsReused: true,
      navigation: true,
      publish: true,
      pageErrors: errors,
    };
  } catch (error) {
    await p
      .screenshot({
        path: "output/playwright/glass-optics-failure.png",
        timeout: 5000,
      })
      .catch(() => {});
    throw error;
  } finally {
    await context.close();
  }
}
