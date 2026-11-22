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
    await context.addInitScript(() => {
      const shops = Array.from({ length: 25 }, (_, i) => ({
        id: i + 1,
        name: `测试店铺${i + 1}号`,
        address: "软件园",
        hubId: 1,
        kind: "food",
      }));
      localStorage.setItem("eatwhat-v2-demo-data", JSON.stringify({ shops }));
      localStorage.setItem(
        "eatwhat-session",
        JSON.stringify({
          tokenName: "satoken",
          tokenValue: "v2-demo-student",
        }),
      );
    });
    const rows = tab
      .getByRole("group", { name: "选择店铺" })
      .getByRole("button");
    const search = tab.getByRole("searchbox", { name: "搜店名" });
    const newShop = tab.getByRole("link", { name: "没找到？新建一家店" });
    const waitForCount = (count) =>
      tab.waitForFunction(
        (expected) =>
          document.querySelectorAll(".mobile-pick-shop-row").length ===
          expected,
        count,
      );
    for (const width of [360, 390]) {
      await tab.setViewportSize({ width, height: width === 360 ? 668 : 844 });
      await tab.goto(new URL("/?demo=v2#/publish", page.url()).href);
      await waitForCount(5);
      const otherShop = Array.from(
        { length: 25 },
        (_, i) => `测试店铺${i + 1}号`,
      );
      const suggestions = await rows
        .locator(".mobile-pick-shop-name")
        .allTextContents();
      const target = otherShop.find((name) => !suggestions.includes(name));
      await rows.first().tap();
      await tab
        .locator(".mobile-publish-destination")
        .getByText(suggestions[0], { exact: true })
        .waitFor();
      await tab
        .getByRole("textbox", { name: "菜名", exact: true })
        .fill("我的菜品草稿");
      await tab.getByRole("link", { name: "换一家" }).tap();
      await search.fill("测试店铺");
      await waitForCount(12);
      await rows.first().scrollIntoViewIfNeeded();
      const {
        x,
        y,
        width: rowWidth,
        height: rowHeight,
      } = await rows.first().boundingBox();
      const start = { x: x + rowWidth / 2, y: y + rowHeight / 2 };
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [start],
      });
      for (const delta of [30, 60, 90, 120])
        await touch.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: start.x, y: start.y - delta }],
        });
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await tab.waitForFunction(() => window.scrollY > 0);
      await newShop.scrollIntoViewIfNeeded();
      await newShop.tap({ trial: true });
      if ((await rows.count()) !== 12) throw new Error("滑动后店铺结果被追加");
      await search.fill(target);
      await rows.filter({ hasText: target }).tap();
      await tab
        .locator(".mobile-publish-destination")
        .getByText(target, { exact: true })
        .waitFor();
      if (
        (await tab
          .getByRole("textbox", { name: "菜名", exact: true })
          .inputValue()) !== "我的菜品草稿"
      )
        throw new Error("换店时菜品草稿丢失");
      await tab.getByRole("link", { name: "换一家" }).tap();
      await search.fill("查无此店");
      await tab.getByText("没有找到匹配的店铺").waitFor();
      await newShop.tap();
      await tab.getByRole("heading", { name: "添加一家店" }).waitFor();
    }
  } finally {
    await context.close();
  }
}
