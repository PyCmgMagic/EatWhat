async function validateTagEditor(page) {
  const base = "http://127.0.0.1:5173",
    checks = [],
    errors = [],
    reads = [],
    writes = [];
  const context = await page
    .context()
    .browser()
    .newContext({ viewport: { width: 390, height: 844 } });
  const p = await context.newPage();
  p.setDefaultTimeout(10000);
  p.on("pageerror", (e) => errors.push(e.message));
  await context.addInitScript(() => {
    if (location.hostname === "127.0.0.1")
      localStorage.setItem(
        "eatwhat-session",
        JSON.stringify({
          tokenName: "x-session",
          tokenValue: "isolated-tag-editor",
        }),
      );
  });
  let systemFail = true,
    writeFail = false,
    personal = [],
    publicTags = [],
    created;
  const system = [
    { id: 1, name: "汤鲜" },
    { id: 2, name: "平价" },
  ];
  const food = {
    id: 71,
    name: "标签验证菜",
    price: 12,
    restaurantId: 1,
    restaurantName: "测试食堂",
    category: "staple",
    pictureUrl: ["/prototype/assets/photos/sq_luosi.png"],
    accountId: 10,
    likesCount: 0,
  };
  await context.route(
    (u) => u.origin !== base,
    (r) => r.abort(),
  );
  await context.route(
    (u) => u.pathname === "/mock-storage/photo.jpg",
    (r) => r.fulfill({ status: 200, body: "" }),
  );
  await context.route(
    (u) => u.pathname.startsWith("/api/"),
    (r) => {
      const path = new URL(r.request().url()).pathname,
        method = r.request().method();
      let data = [];
      if (method === "GET") reads.push(path);
      else writes.push({ path, method, body: r.request().postDataJSON() });
      if (path === "/api/user/info")
        data = {
          id: 10,
          displayName: "标签测试",
          verified: true,
          banned: false,
        };
      else if (path.startsWith("/api/restaurant/detail/"))
        data = { id: 1, name: "测试食堂" };
      else if (path === "/api/foods/tags/system") {
        if (systemFail)
          return r.fulfill({
            status: 503,
            json: { code: 50000, msg: "口味标签暂时不可用" },
          });
        data = system;
      } else if (path === "/api/foods/tags/my")
        data = { items: personal, totalItems: personal.length, hasNext: false };
      else if (path === "/api/foods/71/tags")
        data = {
          systemTags: publicTags.map((id) => ({
            ...system.find((t) => t.id === id),
            taggedByMe: true,
          })),
          myCustomTags: personal,
        };
      else if (path === "/api/foods/71/tags/custom") {
        if (writeFail)
          return r.fulfill({
            status: 503,
            json: { code: 50000, msg: "标签保存失败，请重试" },
          });
        for (const name of r.request().postDataJSON().names)
          if (!personal.some((t) => t.name === name))
            personal.push({ id: 30 + personal.length, name });
        data = null;
      } else if (
        /^\/api\/foods\/71\/tags\/\d+$/.test(path) &&
        method === "DELETE"
      ) {
        const id = Number(path.split("/").at(-1));
        personal = personal.filter((t) => t.id !== id);
        publicTags = publicTags.filter((t) => t !== id);
        data = null;
      } else if (path === "/api/foods/detail/71") data = food;
      else if (path === "/api/upload/presign")
        data = {
          key: "foods/tag-editor.jpg",
          putUrl: base + "/mock-storage/photo.jpg",
        };
      else if (path === "/api/upload/complete")
        data = { key: "foods/tag-editor.jpg", size: 100, revision: 1 };
      else if (path === "/api/foods/upload") {
        created = r.request().postDataJSON();
        publicTags = created.systemTagIds;
        personal = created.myCustomTagNames.map((name, i) => ({
          id: 30 + i,
          name,
        }));
        data = { id: 71 };
      } else if (path === "/api/remote-config")
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
      else if (method !== "GET") {
        errors.push("Unexpected mutation: " + path);
        return r.abort();
      }
      return r.fulfill({ status: 200, json: { code: 0, data } });
    },
  );
  const assert = (ok, msg) => {
    if (!ok) throw new Error(msg);
  };
  const panel = p.getByRole("dialog", { name: "加标签", exact: true });
  const input = panel.getByRole("textbox", {
    name: "写一个我的标签",
    exact: true,
  });
  const add = panel.getByRole("button", { name: "添加", exact: true });
  const done = panel.getByRole("button", { name: /^完成/ });
  try {
    await p.goto(base + "/?demo=0#/publish/dish");
    await p
      .getByRole("textbox", { name: "菜名", exact: true })
      .fill("标签验证菜");
    await p.getByRole("textbox", { name: "价格", exact: true }).fill("12");
    await p.getByRole("button", { name: "+ 添加标签", exact: true }).click();
    await input.waitFor();
    await panel.getByText("口味标签暂时无法读取。", { exact: false }).waitFor();
    await input.fill("  考试周  ");
    await input.press("Enter");
    await panel
      .getByRole("button", { name: "考试周", exact: true, pressed: true })
      .waitFor();
    assert((await input.inputValue()) === "", "Added text not cleared");
    assert(writes.length === 0, "Draft tag caused a write to an existing food");
    assert(
      !reads.some((path) => /^\/api\/foods\/\d+/.test(path)),
      "Unpublished tag panel reads an unrelated food",
    );
    systemFail = false;
    await panel.getByRole("button", { name: "重试", exact: true }).click();
    await panel.getByRole("button", { name: "汤鲜", exact: true }).click();
    await input.fill(" 考试周 ");
    await add.click();
    assert(
      (await panel
        .getByRole("button", { name: "考试周", exact: true })
        .count()) === 1,
      "Duplicate draft tag",
    );
    await input.fill("一二三四五六七八九十百");
    await done.click();
    await panel
      .getByText("个人标签需为 1–10 个字。", { exact: true })
      .waitFor();
    assert(
      (await input.inputValue()) === "一二三四五六七八九十百",
      "Invalid input was silently lost",
    );
    await input.fill("想再吃");
    await done.click();
    await panel.waitFor({ state: "hidden" });
    const tags = p.locator(".mobile-publish-tags");
    await tags
      .getByRole("button", { name: "移除个人标签 考试周", exact: true })
      .waitFor();
    await tags
      .getByRole("button", { name: "移除个人标签 想再吃", exact: true })
      .waitFor();
    await tags
      .getByRole("button", { name: "移除口味标签 汤鲜", exact: true })
      .waitFor();
    checks.push(
      "One-click input, Enter/add/done save, duplicate and length validation, draft chips visible without server writes",
    );
    await tags
      .getByRole("button", { name: "移除个人标签 想再吃", exact: true })
      .click();
    await p.getByRole("button", { name: "+ 添加标签", exact: true }).click();
    await panel
      .getByRole("button", { name: "考试周", exact: true, pressed: true })
      .waitFor();
    assert(
      (await panel
        .getByRole("button", { name: "想再吃", exact: true })
        .count()) === 0,
      "Removed draft tag returned",
    );
    for (const width of [320, 390, 520]) {
      await p.setViewportSize({ width, height: 844 });
      await input.scrollIntoViewIfNeeded();
      const fit = await panel.evaluate((el) => {
        const r = el.getBoundingClientRect(),
          footer = el.querySelector("footer").getBoundingClientRect();
        return {
          fits:
            r.x >= 0 &&
            r.right <= innerWidth + 1 &&
            r.y >= 0 &&
            footer.bottom <= innerHeight + 1,
          overflow: el.scrollWidth > el.clientWidth + 1,
        };
      });
      assert(
        fit.fits && !fit.overflow,
        "Tag panel overflows at " + width + JSON.stringify(fit),
      );
      await p.screenshot({
        path: `output/playwright/tag-panel-${width}.png`,
        animations: "disabled",
        fullPage: true,
      });
    }
    await p.setViewportSize({ width: 390, height: 844 });
    await p.evaluate(() => {
      Object.defineProperty(window.visualViewport, "height", {
        configurable: true,
        value: 400,
      });
      window.visualViewport.dispatchEvent(new Event("resize"));
    });
    await p.waitForFunction(
      () => document.documentElement.dataset.viewportOccluded === "true",
    );
    await input.scrollIntoViewIfNeeded();
    const keyboard = await done.boundingBox();
    assert(
      keyboard && keyboard.y + keyboard.height <= 400,
      "Done action hidden behind keyboard",
    );
    await p.screenshot({
      path: "output/playwright/tag-panel-keyboard.png",
      animations: "disabled",
      fullPage: true,
    });
    await p.evaluate(() => {
      delete window.visualViewport.height;
      window.visualViewport.dispatchEvent(new Event("resize"));
    });
    await done.click();
    await panel.waitFor({ state: "hidden" });
    checks.push(
      "Remove and reopen work; 320/390/520px and keyboard-obscured viewport keep completion usable",
    );
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
    await p.getByRole("link", { name: "完成", exact: true }).click();
    await p.waitForURL(/#\/publish\/dish/);
    await p
      .getByRole("button", { name: "+ 添加标签", exact: true })
      .scrollIntoViewIfNeeded();
    await p.screenshot({
      path: "output/playwright/tag-publish-chips.png",
      animations: "disabled",
      fullPage: true,
    });
    await p.getByRole("link", { name: "发布", exact: true }).click();
    await p.waitForURL(/#\/foods\/71$/);
    assert(
      JSON.stringify(created.myCustomTagNames) === '["考试周"]' &&
        JSON.stringify(created.systemTagIds) === "[1]",
      "Published payload lost or resurrected tags: " + JSON.stringify(created),
    );
    checks.push(
      "Full mock publish carries selected public/private tags and excludes removed tags",
    );
    await p.getByRole("button", { name: /添加口味标签/ }).click();
    await input.waitFor();
    writeFail = true;
    await input.fill("再来一份");
    await add.click();
    await panel.getByText("标签保存失败，请重试", { exact: true }).waitFor();
    assert(
      (await input.inputValue()) === "再来一份",
      "Failed server save lost typed input",
    );
    writeFail = false;
    await add.click();
    await panel
      .getByRole("button", { name: "再来一份", exact: true, pressed: true })
      .waitFor();
    await done.click();
    await panel.waitFor({ state: "hidden" });
    await p.getByRole("button", { name: /添加口味标签/ }).click();
    await panel
      .getByRole("button", { name: "再来一份", exact: true, pressed: true })
      .waitFor();
    checks.push(
      "Existing food: failed save preserves input; manual retry persists and is visible on reopening",
    );
    assert(errors.length === 0, errors.join("; "));
    return { checks, errors, realBackendRequests: 0 };
  } catch (error) {
    await p.screenshot({
      path: "output/playwright/tag-editor-failure.png",
      fullPage: true,
    });
    throw new Error(
      String(error) +
        "\n" +
        JSON.stringify({ reads, writes, errors }) +
        "\n" +
        (await p.locator("body").innerText()),
    );
  } finally {
    await context.close();
  }
}
