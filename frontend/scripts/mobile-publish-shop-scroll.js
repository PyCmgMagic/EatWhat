async function verifyMobilePublishShopScroll(page) {
  const browser = page.context().browser();
  const context = await browser.newContext({
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  try {
    const tab = await context.newPage();
    const touch = await context.newCDPSession(tab);
    const lastShop = tab.getByRole("radio").last();
    const createShop = tab.getByRole("link", { name: "没找到？新建一家店" });
    const next = tab.getByRole("link", { name: /下一步，填写菜品/ });
    for (const viewport of [
      { width: 360, height: 668 },
      { width: 390, height: 844 },
    ]) {
      await tab.setViewportSize(viewport);
      await tab.goto(new URL("/?demo=1#/publish", page.url()).href);
      await lastShop.waitFor();
      const x = viewport.width / 2;
      const y = Math.round(viewport.height * 0.65);
      if (
        !(await tab.evaluate(
          ({ x, y }) =>
            !!document.elementFromPoint(x, y)?.closest('[role="radio"]'),
          { x, y },
        ))
      )
        throw new Error("滑动起点必须位于店铺卡片上");
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y }],
      });
      for (let offset = 30; offset <= 300; offset += 30) {
        await touch.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x, y: y - offset }],
        });
      }
      // Hold before lifting so the next tap selects a shop instead of stopping a fling.
      await tab.waitForTimeout(180);
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await tab
        .waitForFunction(() => window.scrollY > 0, null, { timeout: 2000 })
        .catch(() => {
          throw new Error("从店铺卡片上滑后，页面滚动距离仍为 0");
        });
      await tab.waitForFunction(
        () =>
          document
            .querySelector(".mobile-pick-shop-create")
            .getBoundingClientRect().bottom <=
          document
            .querySelector(".mobile-pick-shop-footer")
            .getBoundingClientRect().top +
            1,
      );
      const footer = await next.boundingBox();
      if (footer.y < 0 || footer.y + footer.height > viewport.height)
        throw new Error("滑到底部后，下一步按钮超出屏幕");
      await createShop.tap({ trial: true });
      await lastShop.tap();
      if ((await lastShop.getAttribute("aria-checked")) !== "true")
        throw new Error("最后一家店未被选中");
      await next.tap();
      await tab.waitForURL("**#/publish/dish");
    }
  } finally {
    await context.close();
  }
}
