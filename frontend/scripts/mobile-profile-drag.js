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
  let phase = "initial";
  p.on("pageerror", (error) => errors.push(error.message));
  p.setDefaultTimeout(8000);
  const base = new URL("/?demo=1&view=mobile&persona=admin#/me", page.url())
    .href;
  const handle = p.locator(".mobile-profile-sheet-handle");
  const sheet = p.locator(".mobile-profile-sheet");
  const scroller = p.locator(".mobile-profile-screen");
  const toolbar = p.locator(".mobile-profile-actions");
  async function resting(open) {
    await p.waitForFunction((expanded) => {
      const panel = document.querySelector(".mobile-profile-sheet");
      return (
        panel?.getAttribute("data-expanded") === String(expanded) &&
        (expanded || panel.parentElement.scrollTop === 0)
      );
    }, open);
    const bounds = await sheet.boundingBox();
    const stage = await p.locator(".mobile-profile-stage").boundingBox();
    if (!bounds || !stage || (!open && Math.abs(bounds.y - stage.height) > 2))
      throw new Error("Sheet settled outside its bounds");
  }
  async function toolbarState() {
    return toolbar.evaluate((bar) => {
      const summary = bar.querySelector(".mobile-profile-summary");
      return {
        top: bar.getBoundingClientRect().top,
        nameOpacity: Number(getComputedStyle(summary).opacity),
        labelOpacity: Number(
          getComputedStyle(bar.querySelector("a > :last-child")).opacity,
        ),
        actions: Array.from(bar.querySelectorAll("a"), (link) => {
          const { x, width, height } = link.getBoundingClientRect();
          return { x, width, height };
        }),
      };
    });
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
    const initialBar = await toolbarState();
    if (
      initialBar.nameOpacity !== 0 ||
      initialBar.labelOpacity !== 1 ||
      initialBar.actions.length !== 3
    )
      throw new Error(
        "Expanded profile should show all three labeled admin actions",
      );
    const closed = await sheet.boundingBox();
    await mouseDrag(-140);
    const during = await sheet.boundingBox();
    if (Math.abs(during.y - (closed.y - 140)) > 2)
      throw new Error("Sheet does not follow the pointer");
    const partial = await toolbarState();
    if (
      partial.actions[0].width >= initialBar.actions[0].width ||
      partial.actions[0].width <= 44 ||
      partial.actions[0].x <= initialBar.actions[0].x
    )
      throw new Error("Toolbar did not track the partial drag");
    await p.mouse.move(195, closed.y - 55, { steps: 5 });
    if ((await toolbarState()).actions[0].width <= partial.actions[0].width)
      throw new Error("Toolbar did not reverse with the pointer");
    await p.mouse.move(195, 75, { steps: 8 });
    await p.mouse.up();
    await resting(true);
    if ((await handle.getAttribute("aria-expanded")) !== "true")
      throw new Error("Expanded semantics missing");
    const compact = await toolbarState();
    if (
      compact.nameOpacity !== 1 ||
      compact.labelOpacity !== 0 ||
      compact.top !== 0 ||
      compact.actions.some((a) => Math.abs(a.width - 44) > 1 || a.height < 44)
    )
      throw new Error(
        "Compact header is missing the identity or icon-sized actions",
      );
    for (const name of ["切换到管理后台", "编辑资料", "设置"])
      await p.getByRole("link", { name, exact: true }).click({ trial: true });
    if (
      await p
        .locator(".mobile-profile-statistics a")
        .first()
        .evaluate((link) => {
          link.focus();
          return document.activeElement === link;
        })
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

    phase = "interrupt opening";
    await handle.click();
    await p.waitForTimeout(50);
    await handle.press("Escape");
    await resting(false);
    phase = "keyboard up";
    await handle.focus();
    await p.keyboard.press("ArrowUp");
    await resting(true);
    phase = "keyboard escape";
    await p.keyboard.press("Escape");
    await resting(false);
    phase = "keyboard enter";
    await p.keyboard.press("Enter");
    await resting(true);
    phase = "keyboard space";
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

    phase = "swipe on the cards";
    const card = await p
      .locator(".mobile-profile-panel .design-food-tile")
      .first()
      .boundingBox();
    const cardX = Math.round(card.x + card.width / 2);
    const cardY = Math.round(card.y + card.height / 2);
    await touch("touchStart", cardX, cardY);
    for (let i = 1; i <= 16; i++)
      await touch("touchMove", cardX, cardY - i * 25);
    await touch("touchEnd");
    await resting(true);
    await touch("touchStart", cardX, 180);
    for (let i = 1; i <= 16; i++) await touch("touchMove", cardX, 180 + i * 25);
    await touch("touchEnd");
    await resting(false);
    checks.push(
      "Swiping the card list in either direction folds and restores the profile",
    );

    phase = "list scroll and tabs";
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
            document.querySelector(".mobile-profile-screen").scrollTop >
            previous,
          before,
        );
        const nav = await p.locator(".mobile-profile-sheet-nav").boundingBox();
        const bar = await toolbar.boundingBox();
        if (Math.abs(nav.y - bar.height) > 1 || bar.y !== 0)
          throw new Error("List scrolling moved the toolbar or tabs");
        await p.getByRole("tab", { name: "上传", exact: true }).click();
        await resting(true);
        if (Math.abs((await sheet.boundingBox()).y - bar.height) > 1)
          throw new Error("Tab change did not bring the new list to its start");
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
    await mouseDrag(-85);
    if ((await toolbarState()).labelOpacity !== 1)
      throw new Error("Reduced motion still interpolates the labels");
    await p.mouse.up();
    await handle.press("Escape");
    await resting(false);
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
    await handle.press("ArrowUp");
    await resting(true);
    await p.getByRole("link", { name: "编辑资料", exact: true }).tap();
    await p.getByRole("heading", { name: "编辑资料", exact: true }).waitFor();
    checks.push("The compact edit icon opens the profile editor");
    if (errors.length) throw new Error("Browser runtime errors");
    return { checks, errors };
  } catch (error) {
    return {
      checks,
      errors,
      failure: String(error),
      phase,
      snapshot: await p.locator("body").innerText(),
    };
  } finally {
    await context.close();
  }
}
