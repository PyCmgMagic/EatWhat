async function validateProfileDrag(page) {
  const context = await page
    .context()
    .browser()
    .newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
  const p = await context.newPage();
  const errors = [],
    checks = [];
  p.on("pageerror", (error) => errors.push(error.message));
  p.setDefaultTimeout(8000);
  const base = "http://127.0.0.1:5173/?demo=1&view=mobile#/me";
  const handle = p.locator(".mobile-profile-sheet-handle");
  const sheet = p.locator(".mobile-profile-sheet");
  const scroller = p.locator(".mobile-profile-sheet-content");
  async function resting(open) {
    await p.waitForFunction((expanded) => {
      const panel = document.querySelector(".mobile-profile-sheet");
      return (
        panel?.getAttribute("data-expanded") === String(expanded) &&
        !panel.hasAttribute("data-moving")
      );
    }, open);
    const bounds = await sheet.boundingBox();
    if (!bounds || bounds.y < 0 || bounds.y > 373)
      throw new Error("Sheet settled outside its bounds");
  }
  async function mouseDrag(distance) {
    const box = await handle.boundingBox();
    await p.mouse.move(box.x + box.width / 2, box.y + 15);
    await p.mouse.down();
    await p.mouse.move(box.x + box.width / 2, box.y + 15 + distance, {
      steps: 12,
    });
    return box;
  }
  try {
    await p.goto(base);
    await handle.waitFor();
    await p.getByRole("tab", { name: /^上传/ }).waitFor();
    await resting(false);
    const closed = await sheet.boundingBox();
    await mouseDrag(-140);
    const during = await sheet.boundingBox();
    if (Math.abs(during.y - (closed.y - 140)) > 2)
      throw new Error("Sheet does not follow the pointer");
    await p.mouse.move(195, 75, { steps: 8 });
    await p.mouse.up();
    await resting(true);
    if ((await handle.getAttribute("aria-expanded")) !== "true")
      throw new Error("Expanded semantics missing");
    if (
      await p.getByRole("link", { name: "编辑资料", exact: true }).isVisible()
    )
      throw new Error("Covered profile links remain focusable");
    await p.screenshot({
      path: "output/playwright/profile-sheet-expanded.png",
    });
    await mouseDrag(300);
    await p.mouse.up();
    await resting(false);
    await mouseDrag(-12);
    await p.waitForTimeout(140);
    await p.mouse.up();
    await resting(false);
    checks.push(
      "Mouse drag follows the pointer, snaps both ways, and ignores a small accidental drag",
    );

    await handle.click();
    await p.waitForTimeout(50);
    await mouseDrag(260);
    await p.mouse.up();
    await resting(false);
    await handle.focus();
    await p.keyboard.press("ArrowUp");
    await resting(true);
    await p.keyboard.press("Escape");
    await resting(false);
    await p.keyboard.press("Enter");
    await resting(true);
    await p.keyboard.press("Space");
    await resting(false);
    checks.push(
      "Interrupted animation retargets; keyboard arrows, Escape, Enter and Space work",
    );

    const cdp = await context.newCDPSession(p);
    const point = async () => {
      const box = await handle.boundingBox();
      return {
        x: Math.round(box.x + box.width / 2),
        y: Math.round(box.y + 16),
      };
    };
    const touch = (type, x, y) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints:
          type === "touchEnd" || type === "touchCancel" ? [] : [{ x, y }],
      });
    let start = await point();
    await touch("touchStart", start.x, start.y);
    for (let i = 1; i <= 12; i++)
      await touch("touchMove", start.x, start.y - i * 24);
    await touch("touchEnd");
    await resting(true);
    start = await point();
    await touch("touchStart", start.x, start.y);
    await touch("touchMove", start.x, start.y + 160);
    await touch("touchCancel");
    await resting(true);
    if (await sheet.getAttribute("data-dragging"))
      throw new Error("Cancelled touch left dragging active");
    start = await point();
    await touch("touchStart", start.x, start.y);
    for (let i = 1; i <= 12; i++)
      await touch("touchMove", start.x, start.y + i * 24);
    await touch("touchEnd");
    await resting(false);
    checks.push(
      "Native touch dragging and cancellation preserve a usable sheet",
    );

    for (const [width, height] of [
      [320, 568],
      [390, 844],
      [520, 844],
    ]) {
      await p.setViewportSize({ width, height });
      await resting(false);
      await handle.click();
      await resting(true);
      await p.getByRole("tab", { name: /^收藏/ }).click();
      await p.waitForFunction(
        () =>
          document.querySelectorAll(".mobile-profile-sheet .design-food-tile")
            .length === 3,
      );
      if (width === 320) {
        const before = await scroller.evaluate((el) => el.scrollTop);
        const bounds = await scroller.boundingBox();
        const x = Math.round(bounds.x + bounds.width / 2),
          y = Math.round(bounds.y + 220);
        await touch("touchStart", x, y);
        for (let i = 1; i <= 12; i++) await touch("touchMove", x, y - i * 12);
        await touch("touchEnd");
        await p.waitForFunction(
          (previous) =>
            document.querySelector(".mobile-profile-sheet-content").scrollTop >
            previous,
          before,
        );
        if ((await sheet.boundingBox()).y > 25)
          throw new Error("List scrolling dragged the sheet");
      }
      const layout = await p.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        outerScroll: window.scrollY,
        navs: document.querySelectorAll('nav[aria-label="主导航"]').length,
      }));
      if (layout.overflow || layout.outerScroll || layout.navs !== 1)
        throw new Error(`Invalid ${width}px layout: ${JSON.stringify(layout)}`);
      await handle.click();
      await resting(false);
      await scroller.evaluate((el) => {
        el.scrollTop = 0;
      });
    }
    checks.push(
      "320/390/520px layouts, native list scrolling and fixed single navigation",
    );
    await p.emulateMedia({ reducedMotion: "reduce" });
    await handle.click();
    await resting(true);
    if (
      (await sheet.evaluate(
        (el) => getComputedStyle(el).transitionDuration,
      )) !== "0s"
    )
      throw new Error("Reduced motion still animates");
    await p.setViewportSize({ width: 320, height: 640 });
    await resting(true);
    await handle.click();
    await resting(false);
    checks.push("Reduced motion and resizing preserve the chosen state");
    if (errors.length) throw new Error("Browser runtime errors");
    return { checks, errors };
  } catch (error) {
    return {
      checks,
      errors,
      failure: String(error),
      snapshot: await p.locator("body").innerText(),
    };
  } finally {
    await context.close();
  }
}
