async function validateFilterOrigin(page) {
  const context = await page.context().browser().newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  });
  const p = await context.newPage();
  try {
    await p.goto(new URL("/?demo=1&view=mobile#/users/21", page.url()).href);
    const button = p.getByRole("button", { name: "搜索和筛选分享" });
    const surface = p.getByRole("search", { name: "筛选食友分享" });
    await button.waitFor();
    await p.evaluate(() => document.fonts.ready);
    for (const position of [{ x: 14, y: 12 }, { x: 56, y: 31 }]) {
      await button.scrollIntoViewIfNeeded();
      const box = await button.boundingBox();
      const tap = { x: box.x + position.x, y: box.y + position.y };
      await button.evaluate((el) => {
        el.addEventListener("click", () => requestAnimationFrame(() => {
          const wrapper = document.querySelector(".mobile-user-filter-reveal");
          for (const animation of wrapper.getAnimations({ subtree: true })) {
            animation.pause();
            animation.currentTime = 0;
          }
        }), { once: true });
      });
      await button.tap({ position });
      await p.waitForFunction(() =>
        document.querySelector(".mobile-user-filters").getAnimations()
          .some((a) => a.playState === "paused"),
      );
      const seedAtTap = await surface.evaluate((form, { x, y }) => {
        const inside = (dx, dy) =>
          document.elementsFromPoint(x + dx, y + dy).some((el) => form.contains(el));
        return inside(0, 0) && !inside(6, 0) && !inside(-6, 0)
          && !inside(0, -6) && !inside(0, 6);
      }, tap);
      if (!seedAtTap) throw Error("The opening dot did not start at the touch point");

      await surface.evaluate((form) => {
        for (const a of form.closest(".mobile-user-filter-reveal").getAnimations({ subtree: true }))
          a.currentTime = 50;
      });
      if ((await surface.boundingBox()).y <= tap.y)
        throw Error("The surface should expand down from the filter button");
      await surface.evaluate((form) => {
        for (const a of form.closest(".mobile-user-filter-reveal").getAnimations({ subtree: true }))
          a.finish();
      });
      const bounds = await surface.boundingBox();
      if (bounds.width < 300 || bounds.height < 80 || bounds.y < box.y + box.height)
        throw Error("Expanded filters must fill a panel below the trigger");
      await button.tap();
      await surface.waitFor({ state: "hidden" });
      await p.waitForFunction(() =>
        getComputedStyle(document.querySelector(".mobile-user-filters")).visibility === "hidden",
      );
    }
    return { touchPoints: 2, downwards: true, rectangularPanel: true };
  } finally {
    await context.close();
  }
}
