async function verifyMobilePublishFooter(page) {
  const context = await page
    .context()
    .browser()
    .newContext({
      viewport: { width: 390, height: 740 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
    });
  try {
    const tab = await context.newPage();
    await tab.goto(new URL("/?demo=1#/publish/dish", page.url()).href);
    const publish = tab.getByRole("button", { name: "发布", exact: true });
    const fields = tab.locator(".mobile-publish-fields");
    const note = tab.getByRole("textbox", { name: "说两句，选填" });
    async function checkFooter() {
      const pinned = await publish.evaluate((button) => {
        const footer = button.parentElement.getBoundingClientRect();
        const rect = button.getBoundingClientRect();
        const hit = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        );
        const viewport = window.visualViewport;
        return (
          Math.abs(footer.width - Math.min(520, viewport.width)) <= 2 &&
          Math.abs(footer.bottom - viewport.offsetTop - viewport.height) <= 2 &&
          button.contains(hit)
        );
      });
      if (!pinned) throw new Error("发布按钮未固定在可视区域底部");
    }
    for (const viewport of [
      { width: 390, height: 740 },
      { width: 360, height: 640 },
      { width: 430, height: 840 },
      { width: 520, height: 640 },
    ]) {
      await tab.setViewportSize(viewport);
      await tab.waitForFunction(
        (width) =>
          Math.abs(
            document.querySelector(".mobile-canvas").getBoundingClientRect()
              .width - width,
          ) <= 1,
        viewport.width,
      );
      await tab.evaluate(() => window.scrollTo(0, 0));
      await checkFooter();
      await tab.getByRole("button", { name: "展开发布表单" }).tap();
      const [nameLine, priceLine] = await Promise.all([
        fields.getByRole("textbox", { name: "菜名", exact: true }).boundingBox(),
        fields.getByRole("textbox", { name: "价格", exact: true }).locator("..").boundingBox(),
      ]);
      if (!nameLine || !priceLine || Math.abs(nameLine.y - priceLine.y) > 1 ||
          Math.abs(nameLine.y + nameLine.height - priceLine.y - priceLine.height) > 1) {
        throw new Error(`${viewport.width}px 下菜名和价格的输入行未对齐`);
      }
      for (const fraction of [0, 0.5, 1]) {
        await fields.evaluate((el, fraction) => {
          el.scrollTop = (el.scrollHeight - el.clientHeight) * fraction;
        }, fraction);
        await checkFooter();
      }
      await tab.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await checkFooter();
      const lastField = await note.boundingBox();
      const footer = await publish.locator("..").boundingBox();
      if (lastField.y + lastField.height > footer.y + 1)
        throw new Error("发布底栏遮挡备注输入框");
      await note.tap();
      await fields.evaluate((el) => {
        el.scrollTop = 0;
      });
      await tab.getByRole("button", { name: "收起发布表单" }).tap();
      await checkFooter();
    }
  } finally {
    await context.close();
  }
}
