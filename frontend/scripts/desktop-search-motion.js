// Run with Playwright's browser_run_code_unsafe, as with the other browser checks.
// Use WebKit as well as Chromium: DOM-only tests cannot detect split animation clocks.
async function validateDesktopSearchMotion(browserPage) {
  const origin = await browserPage.evaluate(() => location.origin);
  const context = await browserPage.context().browser().newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  await context.route(
    (url) => url.origin !== origin || url.pathname.startsWith("/api/"),
    (route) => route.abort(),
  );
  try {
    await page.goto(origin + "/?demo=1&view=desktop#/");
    await page.locator(".pc-header-search-wrap").waitFor({ state: "attached" });
    const results = [];
    for (const width of [1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      for (const action of ["open", "close", "interrupt", "open", "close"]) {
        const frames = await page.evaluate(async (action) => {
          const wrap = document.querySelector(".pc-header-search-wrap");
          const form = wrap.querySelector("form");
          const input = form.querySelector("input");
          const compact = document.querySelector(".pc-compact-search");
          const read = () => {
            const visible = getComputedStyle(form).display !== "none";
            const rect = (visible ? form : compact).getBoundingClientRect();
            return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
          };
          const close = () => document.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
          );
          const frames = [read()];
          if (action === "close") close();
          else if (getComputedStyle(form).display === "none") compact.click();
          else input.focus({ preventScroll: true });
          if (action === "interrupt") {
            await new Promise((resolve) => setTimeout(resolve, 80));
            frames[0] = read();
            close();
          }
          const start = performance.now();
          while (performance.now() - start < 500) {
            await new Promise((resolve) => setTimeout(resolve, 16));
            frames.push(read());
          }
          return frames;
        }, action);
        const from = frames[0], to = frames.at(-1);
        if (Math.abs(to.w - from.w) < 10)
          throw new Error(`Search did not animate: ${width} ${action}`);
        // Every rectangle must follow the same interpolation, regardless of frame
        // rate. A compositor translate can advance ahead of layout width in Safari.
        let maxDrift = 0;
        let previousProgress = 0;
        for (const frame of frames) {
          const progress = (frame.w - from.w) / (to.w - from.w);
          for (const axis of ["x", "y", "h"]) {
            const expected = from[axis] + (to[axis] - from[axis]) * progress;
            maxDrift = Math.max(maxDrift, Math.abs(frame[axis] - expected));
          }
          if (progress < previousProgress - 0.01 || progress > 1.01)
            throw new Error(`Search reversed or overshot: ${width} ${action}`);
          previousProgress = progress;
        }
        if (maxDrift > 1)
          throw new Error(`Search geometry out of sync: ${width} ${action}: ${maxDrift}px`);
        const open = action === "open";
        if (await page.locator(".pc-header-search input").getAttribute("aria-expanded") !== String(open))
          throw new Error(`Search state did not settle: ${width} ${action}`);
        if (open && Math.abs(to.w - 540) > 1)
          throw new Error(`Wrong expanded width: ${width}: ${to.w}`);
        if (!open && await page.locator(".pc-header-search-panel").count())
          throw new Error(`Search panel remained after closing: ${width}`);
        results.push({ width, action, maxDrift: +maxDrift.toFixed(3) });
      }
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.locator(".pc-header-search input").focus();
    const animations = await page.locator(".pc-header-search").evaluate(
      (form) => form.getAnimations().length,
    );
    if (animations) throw new Error("Search ignored reduced motion");
    await page.keyboard.press("Escape");
    if (await page.locator(".pc-header-search-panel").count())
      throw new Error("Reduced-motion search did not close");
    return results;
  } finally {
    await context.close();
  }
}
