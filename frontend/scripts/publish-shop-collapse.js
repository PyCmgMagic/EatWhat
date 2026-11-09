async function verifyPublishShopCollapse(browserPage) {
  const base = "http://127.0.0.1:5173";
  const browser = browserPage.context().browser();
  const checks = [],
    sizes = [],
    errors = [];
  const assert = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  const shops = [
    {
      id: 1,
      name: "破皮包子（舜泰店）",
      address: "舜华路街道舜泰广场9号楼1-105-1",
    },
    { id: 2, name: "滨寿司", address: "高新万达4F" },
    ...Array.from({ length: 10 }, (_, i) => ({
      id: i + 3,
      name: "校园小馆 " + (i + 1),
      address: "软件园校区",
    })),
  ];
  for (const width of [600, 820, 1062, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: width === 1062 ? "no-preference" : "reduce",
    });
    const p = await context.newPage();
    p.setDefaultTimeout(10000);
    p.on("pageerror", (error) => errors.push(error.message));
    let failDetail = false;
    await context.addInitScript(() =>
      localStorage.setItem(
        "eatwhat-session",
        JSON.stringify({ tokenName: "x-shop-test", tokenValue: "isolated" }),
      ),
    );
    await context.route(
      () => true,
      async (route) => {
        const request = route.request(),
          url = new URL(request.url()),
          path = url.pathname;
        if (url.origin !== base) return route.abort();
        if (!path.startsWith("/api/")) return route.continue();
        let data = { items: [] };
        if (path === "/api/user/info")
          data = { id: 90, displayName: "食友", verified: true, banned: false };
        else if (path === "/api/campus/list")
          data = [{ id: 1, name: "软件园校区", open: true, isDefault: true }];
        else if (path === "/api/remote-config") data = {};
        else if (path === "/api/notification/unread/count") data = 0;
        else if (path.startsWith("/api/restaurant/detail/")) {
          if (failDetail && path.endsWith("/1"))
            return route.fulfill({
              status: 503,
              json: { code: 50000, msg: "餐厅暂时无法读取" },
            });
          data = shops.find(
            (shop) => shop.id === Number(path.split("/").at(-1)),
          );
        } else if (
          path === "/api/restaurant/browse" ||
          path === "/api/restaurant/search"
        ) {
          data = {
            items: shops.filter((shop) =>
              shop.name.includes(url.searchParams.get("keyword") ?? ""),
            ),
            totalPages: 1,
            currentPage: 1,
          };
        } else if (path === "/api/foods/tags/system") data = [];
        else if (path === "/api/user/activity") data = null;
        else if (request.method() !== "GET")
          throw new Error("Unexpected write: " + path);
        return route.fulfill({ json: { code: 0, data } });
      },
    );
    const card = p.locator(".pc-composer-shops");
    const picker = p.locator(".pc-composer-shop-picker");
    const selected = card.locator(".pc-composer-selected strong");
    async function waitClosed() {
      await p.getByRole("button", { name: "更换餐厅", exact: true }).waitFor();
      await p.waitForFunction(
        () =>
          document
            .querySelector(".pc-composer-shop-picker")
            .getBoundingClientRect().height < 1,
      );
      assert(
        (await picker.getAttribute("aria-hidden")) === "true",
        "Closed picker still exposed to assistive technology",
      );
      assert(
        await picker.evaluate((node) => node.inert),
        "Closed controls still focusable",
      );
    }
    try {
      await p.goto(base + "/?demo=0#/publish");
      const first = p.getByRole("radio").filter({ hasText: shops[0].name });
      await first.waitFor();
      const expanded = (await card.boundingBox()).height;
      await p
        .getByRole("textbox", { name: "菜名", exact: true })
        .fill("菜品草稿");
      await p.getByRole("spinbutton", { name: "价格", exact: true }).fill("12");
      await p.getByRole("textbox", { name: "发布个人标签" }).fill("包子、早餐");
      if (width === 1062)
        await card.screenshot({
          path: "output/playwright/publish-shops-expanded.png",
        });
      await first.click();
      await waitClosed();
      const collapsed = (await card.boundingBox()).height;
      assert(
        collapsed < 190 && collapsed < expanded * 0.6,
        "Card did not shrink: " + width + ": " + expanded + " -> " + collapsed,
      );
      assert(
        (await selected.innerText()) === shops[0].name,
        "Selected shop summary missing",
      );
      assert(
        await p
          .getByRole("button", { name: "更换餐厅" })
          .evaluate((node) => node === document.activeElement),
        "Focus left in collapsed content",
      );
      sizes.push({
        width,
        expanded: Math.round(expanded),
        collapsed: Math.round(collapsed),
      });
      await card.screenshot({
        path: "output/playwright/publish-shops-collapsed-" + width + ".png",
      });
      await p.getByRole("button", { name: "更换餐厅" }).click();
      const search = p.getByRole("textbox", { name: "搜索发布餐厅" });
      assert(
        await search.evaluate((node) => node === document.activeElement),
        "Reopen did not focus search",
      );
      if (width === 1062)
        assert(
          await picker.evaluate(
            (node) => parseFloat(getComputedStyle(node).transitionDuration) > 0,
          ),
          "Pointer expansion is not animated",
        );
      await search.fill("寿司");
      await p.getByRole("radio").filter({ hasText: shops[1].name }).click();
      await waitClosed();
      assert(
        (await selected.innerText()) === shops[1].name,
        "Changing shop did not update summary",
      );
      assert(
        (await p
          .getByRole("textbox", { name: "菜名", exact: true })
          .inputValue()) === "菜品草稿",
        "Changing shop lost food name",
      );
      assert(
        (await p
          .getByRole("spinbutton", { name: "价格", exact: true })
          .inputValue()) === "12",
        "Changing shop lost price",
      );
      assert(
        (await p
          .getByRole("textbox", { name: "发布个人标签" })
          .inputValue()) === "包子、早餐",
        "Changing shop lost tags",
      );
      await p.getByRole("button", { name: "更换餐厅" }).focus();
      await p.keyboard.press("Enter");
      await p.getByRole("button", { name: "收起餐厅列表" }).waitFor();
      await search.press("Escape");
      await waitClosed();
      assert(
        await picker.evaluate(
          (node) => parseFloat(getComputedStyle(node).transitionDuration) === 0,
        ),
        "Keyboard interaction should be instant",
      );
      assert(
        !(await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        )),
        "Horizontal overflow at " + width,
      );
      checks.push(
        width +
          "px: auto-collapse, summary, reopen/search/change, draft retained, keyboard and overflow",
      );
      await p.goto(base + "/?demo=0#/publish/dish");
      await p.reload();
      await p.waitForFunction(
        (name) =>
          document.querySelector(".pc-composer-selected strong")
            ?.textContent === name,
        shops[0].name,
      );
      await waitClosed();
      checks.push(width + "px: preselected shop starts compact");
      if (width === 1062) {
        failDetail = true;
        await p.reload();
        await p.getByRole("button", { name: "重新读取所选餐厅" }).waitFor();
        assert(
          (await picker.getAttribute("aria-hidden")) === "false",
          "Detail failure left picker closed",
        );
        await p.getByRole("radio").filter({ hasText: shops[1].name }).click();
        await waitClosed();
        checks.push(
          "Failed selected-shop read reopens choices and allows recovery",
        );
      }
    } catch (error) {
      await p.screenshot({
        path: "output/playwright/publish-shop-collapse-failure.png",
        fullPage: false,
      });
      throw new Error(
        width + "px: " + error.message + "; " + errors.join("; "),
      );
    } finally {
      await context.close();
    }
  }
  assert(errors.length === 0, errors.join("; "));
  return { checks, sizes, errors, realBackendRequests: 0 };
}
