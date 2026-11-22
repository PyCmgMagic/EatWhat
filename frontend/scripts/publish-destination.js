async function validatePublishDestination(page) {
  const base = "http://127.0.0.1:5173",
    checks = [],
    errors = [];
  const shops = [
    { id: 7, name: "渔见17码头", address: "校园美食街" },
    {
      id: 9,
      name: "校园风味餐厅软件园校区二楼特色面食档口",
      address: "软件园二楼",
    },
  ];
  const context = await page
    .context()
    .browser()
    .newContext({ viewport: { width: 390, height: 844 } });
  const p = await context.newPage();
  p.setDefaultTimeout(10000);
  p.on("pageerror", (e) => errors.push(e.message));
  const assert = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  let detailFails = true;
  await context.addInitScript(() => {
    if (location.hostname === "127.0.0.1")
      localStorage.setItem(
        "eatwhat-session",
        JSON.stringify({
          tokenName: "x-session",
          tokenValue: "isolated-publish-destination",
        }),
      );
  });
  await context.route(
    (u) => u.origin !== base,
    (r) => r.abort(),
  );
  await context.route(
    (u) => u.pathname.startsWith("/api/"),
    async (r) => {
      const path = new URL(r.request().url()).pathname;
      if (r.request().method() !== "GET") {
        errors.push("Unexpected mutation: " + path);
        return r.abort();
      }
      let data = [];
      if (path === "/api/user/info")
        data = {
          id: 10,
          displayName: "发布测试",
          verified: true,
          banned: false,
        };
      else if (path.startsWith("/api/restaurant/detail/")) {
        const failing = detailFails;
        await new Promise((resolve) => setTimeout(resolve, 400));
        if (failing)
          return r.fulfill({
            status: 503,
            json: { code: 50000, msg: "店名暂时无法读取" },
          });
        const id = Number(path.split("/").at(-1));
        data = shops.find((s) => s.id === id) ?? {
          id: 1,
          name: "校园风味食堂",
        };
      } else if (
        ["/api/restaurant/browse", "/api/restaurant/search"].includes(path)
      )
        data = {
          items: shops,
          totalItems: 2,
          totalPages: 1,
          page: 1,
          pageSize: 12,
        };
      else if (path === "/api/remote-config")
        data = {
          configVersion: 1,
          flags: {},
          params: {},
          maintenance: { mode: "NONE" },
          announcements: [],
          versions: {},
        };
      else if (path === "/api/campus/list")
        data = [{ id: 1, name: "软件园", open: true, isDefault: true }];
      else if (path === "/api/notification/unread/count") data = 0;
      return r.fulfill({ status: 200, json: { code: 0, data } });
    },
  );
  const destination = p.locator(".mobile-publish-destination");
  try {
    await p.goto(base + "/?demo=0#/publish");
    const failure = p.waitForResponse((r) =>
      r.url().includes("/restaurant/detail/7"),
    );
    await p.getByRole("button", { name: /渔见17码头/ }).click();
    await destination.getByText(shops[0].name, { exact: true }).waitFor();
    assert(
      !(await destination.innerText()).includes("所选餐厅"),
      "Placeholder remained during detail load",
    );
    await failure;
    await destination.getByText(shops[0].name, { exact: true }).waitFor();
    checks.push(
      "Selected name is immediate and survives failed detail loading",
    );
    await p
      .getByRole("textbox", { name: "菜名", exact: true })
      .fill("店名验证菜");
    const chooser = p.waitForEvent("filechooser");
    await p.getByRole("button", { name: "再加一张照片", exact: true }).click();
    await (
      await chooser
    ).setFiles({
      name: "sq_luosi.png",
      mimeType: "image/png",
      buffer: await (
        await p.request.get(base + "/prototype/assets/photos/sq_luosi.png")
      ).body(),
    });
    await p.waitForURL(/#\/publish\/crop/);
    await p.getByRole("slider", { name: "缩放", exact: true }).fill("1.2");
    await p.getByRole("link", { name: "完成", exact: true }).click();
    await p.waitForURL(/#\/publish\/dish/);
    await destination.getByText(shops[0].name, { exact: true }).waitFor();
    assert(
      (await p
        .getByRole("textbox", { name: "菜名", exact: true })
        .inputValue()) === "店名验证菜",
      "Crop return lost form data",
    );
    await p.screenshot({
      path: "output/playwright/publish-destination-390.png",
      fullPage: true,
    });
    checks.push("Crop completion preserves selected name and dish draft");
    await destination
      .getByRole("link", { name: "换一家", exact: true })
      .click();
    await p.getByRole("button", { name: new RegExp(shops[1].name) }).click();
    await destination.getByText(shops[1].name, { exact: true }).waitFor();
    assert(
      !(await destination.innerText()).includes(shops[0].name),
      "Old restaurant name leaked into new selection",
    );
    for (const width of [320, 390, 520]) {
      await p.setViewportSize({ width, height: 844 });
      const layout = await destination.evaluate((el) => {
        const name = el.querySelector("strong").getBoundingClientRect(),
          change = el.querySelector("a").getBoundingClientRect(),
          row = el.getBoundingClientRect();
        return {
          fits: name.right < change.left && change.right <= row.right + 1,
          overflow: document.documentElement.scrollWidth > innerWidth,
          text: el.innerText,
        };
      });
      assert(
        layout.fits && !layout.overflow,
        "Long name overlaps change link: " + JSON.stringify({ width, layout }),
      );
      await p.screenshot({
        path: `output/playwright/publish-destination-long-${width}.png`,
        fullPage: true,
      });
    }
    checks.push(
      "Changing restaurants updates ID/name together; long names fit at 320/390/520px",
    );
    // Fresh direct entry has no remembered selection. Failed reads need an honest state and retry.
    await p.goto(base + "/?demo=0#/publish/dish");
    await p.reload();
    await destination.getByText("店名暂时无法读取", { exact: true }).waitFor();
    assert(
      !(await destination.innerText()).includes(shops[1].name),
      "Fresh destination reused stale restaurant name",
    );
    detailFails = false;
    await destination
      .getByRole("button", { name: "重新读取店名", exact: true })
      .click();
    await destination.getByText("校园风味食堂", { exact: true }).waitFor();
    checks.push(
      "No cached name: readable error and retry restore the correct destination",
    );
    assert(errors.length === 0, errors.join("; "));
    return { checks, errors, realBackendRequests: 0 };
  } catch (error) {
    await p.screenshot({
      path: "output/playwright/publish-destination-failure.png",
      fullPage: true,
    });
    throw new Error(
      String(error) + "\n" + (await p.locator("body").innerText()),
    );
  } finally {
    await context.close();
  }
}
