// Run with playwright-cli run-code --filename frontend/scripts/appearance.js
// against the development server (the fixtures use its isolated demo mode).
async (page) => {
  const base = (await page.evaluate(() => location.origin)) + "/?demo=1";
  const context = await page.context().browser().newContext({
    viewport: { width: 1440, height: 960 }, colorScheme: "light",
  });
  const p = await context.newPage();
  const errors = [];
  context.on("page", (tab) => tab.on("pageerror", (e) => errors.push(e.message)));
  p.on("pageerror", (e) => errors.push(e.message));
  const toggle = p.getByRole("switch", { name: "深色模式" });
  const themeIs = (tab, value) => tab.waitForFunction(
    (theme) => document.documentElement.dataset.theme === theme &&
      getComputedStyle(document.documentElement).colorScheme === theme, value,
  );
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const openPersonalization = async () => {
    await p.goto(base + "#/settings");
    await p.getByRole("link", { name: /^个性化/ }).click();
    await p.getByRole("heading", { name: "个性化", exact: true }).waitFor();
  };
  const recommendationPaint = (selector) => p.locator(selector).evaluate((hero) => [
    getComputedStyle(hero).backgroundColor,
    getComputedStyle(hero.querySelector("h1")).color,
  ].join("/"));
  try {
    await p.goto(base + "#/");
    await p.locator(".pc-hero h1").waitFor();
    await themeIs(p, "light");
    const lightStage = await recommendationPaint(".pc-hero");
    await toggle.click();
    await themeIs(p, "dark");
    await p.waitForFunction(() => getComputedStyle(document.querySelector(".pc-app")).backgroundColor === "rgb(15, 15, 14)");
    await p.evaluate(async () => { await document.activeViewTransition?.finished; });
    assert(await recommendationPaint(".pc-hero") === lightStage, "Theme changed the recommended dish's palette");
    await p.screenshot({ path: "output/playwright/appearance-desktop.png" });
    await p.reload();
    await themeIs(p, "dark");
    await toggle.waitFor();
    const second = await context.newPage();
    await second.goto(base + "#/");
    await themeIs(second, "dark");
    await toggle.focus();
    await p.keyboard.press("Space");
    await themeIs(p, "light");
    await themeIs(second, "light");
    await second.close();
    await openPersonalization();
    await p.getByRole("radio", { name: "跟随系统" }).check();
    await p.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await themeIs(p, "dark");
    const light = p.getByRole("radio", { name: "浅色", exact: true });
    await light.check();
    await themeIs(p, "light");
    await p.reload();
    await themeIs(p, "light");
    await p.getByRole("radio", { name: "深色", exact: true }).check();
    await themeIs(p, "dark");
    await p.getByRole("link", { name: "返回设置", exact: true }).click();
    await p.getByRole("button", { name: "退出登录", exact: true }).click();
    const dialog = p.getByRole("dialog", { name: "退出当前账号？" });
    await dialog.waitFor();
    assert(await dialog.evaluate((el) => getComputedStyle(el).colorScheme === "dark"), "Dialog lost its theme");
    await dialog.getByRole("button", { name: "取消" }).click();
    await p.goto(base + "#/");
    for (const width of [1440, 1024, 768, 640, 390, 320]) {
      await p.setViewportSize({ width, height: 844 });
      const header = p.locator(width >= 640 ? ".pc-header" : ".mobile-home-toolbar");
      await header.getByRole("switch", { name: "深色模式" }).waitFor();
      const geometry = await toggle.boundingBox();
      assert(geometry && geometry.width >= 43 && geometry.height >= 43 &&
        geometry.x >= 0 && geometry.x + geometry.width <= width, "Theme switch clipped at " + width);
      assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Page overflows at " + width);
      if (width === 390) await p.screenshot({ path: "output/playwright/appearance-mobile.png" });
    }
    const mobileStage = await recommendationPaint(".mobile-home-hero");
    await toggle.click();
    await themeIs(p, "light");
    assert(await recommendationPaint(".mobile-home-hero") === mobileStage, "Mobile dish colours changed with the interface");
    await toggle.click();
    await themeIs(p, "dark");
    await p.goto(base + "#/foods/1");
    await p.locator(".dish-hero-copy h1").waitFor();
    await themeIs(p, "dark");
    await openPersonalization();
    const slider = p.getByRole("slider", { name: "透明度" });
    const glassPaint = (tab, container) => tab.locator(container + " .design-glass-backdrop")
      .evaluateAll((surfaces) => surfaces.map((el) => getComputedStyle(el).backgroundColor));
    assert(await slider.inputValue() === "87", "Missing default transparency");
    assert(await p.getByRole("img", { name: "底部导航外观预览" }).count() === 1, "No navigation preview");
    const home = await context.newPage();
    await home.setViewportSize({ width: 390, height: 844 });
    await home.goto(base + "#/");
    await home.getByRole("navigation", { name: "主导航" }).waitFor();
    await slider.press("Home");
    const opaque = await glassPaint(p, ".personalization-preview");
    for (const value of ["0", "100"]) {
      if (value === "100") await slider.press("End");
      await home.waitForFunction((v) => document.documentElement.style.getPropertyValue("--nav-transparency") === v + "%", value);
      const preview = await glassPaint(p, ".personalization-preview");
      const actual = await glassPaint(home, ".mobile-main-navigation");
      assert(preview.length === 2 && preview.length === actual.length && preview.every((color, i) => color === actual[i]), "Preview differs from navigation or publish button");
      assert(value === "0" || preview.every((color, i) => color !== opaque[i]), "Dark navigation tint did not change");
    }
    await slider.press("ArrowLeft");
    await p.reload();
    await slider.waitFor();
    assert(await slider.inputValue() === "99", "Slider choice lost on reload");
    await home.close();
    await p.getByRole("radio", { name: "跟随系统" }).check();
    await p.emulateMedia({ colorScheme: "light" });
    await themeIs(p, "light");
    // Disable the snapshot API to exercise the CSS fallback in this browser.
    await p.evaluate(() => { document.startViewTransition = undefined; });
    await p.emulateMedia({ reducedMotion: "no-preference" });
    await p.getByRole("radio", { name: "深色", exact: true }).check();
    await themeIs(p, "dark");
    await p.waitForFunction(() => !document.documentElement.hasAttribute("data-theme-changing"));
    const beforeApp = await context.newPage();
    await beforeApp.route((url) => url.pathname === "/src/main.tsx", (route) => route.abort());
    await beforeApp.goto(base);
    await themeIs(beforeApp, "dark");
    assert(await beforeApp.locator("#root").evaluate((el) => !el.childElementCount), "First-paint check ran after React mounted");
    await beforeApp.close();
    assert(!errors.length, errors.join("\n"));
    return "Theme controls, six widths, first paint, CSS fallback, system preference, keyboard, tab sync, navigation transparency, persistence, dish details and dialogs passed.";
  } finally {
    await context.close();
  }
}
