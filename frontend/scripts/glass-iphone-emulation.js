async function verifyIphoneGlassEmulation(page) {
  // Exercise the actual component with a Safari UA inside Chromium.
  const browser = page.context().browser();
  const context = await browser.newContext({
    viewport: { width: 440, height: 956 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    permissions: ["geolocation"],
    geolocation: { latitude: 36.667, longitude: 117.134 },
  });
  const p = await context.newPage();
  const errors = [];
  p.on("pageerror", (error) => errors.push(error.message));
  await context.route(
    (url) => url.pathname.startsWith("/api/"),
    (route) => route.abort(),
  );
  try {
    await p.goto("http://127.0.0.1:5173/?demo=v2&view=mobile#/");
    await p.getByRole("navigation", { name: "主导航", exact: true }).waitFor();
    await p.waitForFunction(
      () => document.querySelectorAll(".design-glass-backdrop").length === 2,
    );
    await p.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    const actual = await p.evaluate(() => ({
      ua: navigator.userAgent,
      chromiumRuntime: "chrome" in window,
      surfaces: [...document.querySelectorAll(".design-glass-backdrop")].map(
        (element) => ({
          refracting: element.dataset.refracting === "true",
          filter: getComputedStyle(element).backdropFilter,
          background: getComputedStyle(element).backgroundImage,
        }),
      ),
    }));
    if (
      !actual.surfaces.every(
        (surface) => surface.refracting && surface.filter.includes("url("),
      )
    )
      throw new Error(JSON.stringify(actual));
    await p.emulateMedia({ contrast: "more" });
    await p.waitForFunction(() =>
      [...document.querySelectorAll(".design-glass-backdrop")].every(
        (element) => getComputedStyle(element).backdropFilter === "none",
      ),
    );
    await p.emulateMedia({ contrast: "no-preference" });
    await p.waitForFunction(
      () => document.querySelectorAll('[data-refracting="true"]').length === 2,
    );
    await p.screenshot({ path: "output/playwright/glass-iphone-440.png" });
    if (errors.length) throw new Error(JSON.stringify(errors));
    return {
      actual,
      highContrastFallback: true,
      restoredRefraction: true,
      pageErrors: errors,
    };
  } finally {
    await context.close();
  }
}
