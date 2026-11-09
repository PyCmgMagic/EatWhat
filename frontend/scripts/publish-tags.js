async function verifyPublishTags(browserPage) {
  const base = "http://127.0.0.1:5173";
  const checks = [],
    errors = [],
    unexpected = [];
  const assert = (value, message) => {
    if (!value) throw new Error(message);
  };
  for (const width of [600, 820, 1440]) {
    const context = await browserPage
      .context()
      .browser()
      .newContext({
        viewport: { width, height: 1000 },
        reducedMotion: "reduce",
      });
    const p = await context.newPage();
    p.setDefaultTimeout(10000);
    p.on("pageerror", (error) => errors.push(error.message));
    await context.route(
      () => true,
      (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== base || url.pathname.startsWith("/api/")) {
          unexpected.push(url.origin + url.pathname);
          return route.abort();
        }
        return route.continue();
      },
    );
    const entry = p.getByRole("textbox", { name: "发布个人标签" });
    const add = p.getByRole("button", { name: "添加个人标签", exact: true });
    const chips = p.locator(".pc-composer-tag-list li");
    const addValue = async (text, enter = false) => {
      await entry.fill(text);
      if (enter) await entry.press("Enter");
      else await add.click();
    };
    try {
      await p.goto(base + "/?demo=1&view=desktop#/publish");
      await entry.waitFor();
      await p.locator('form[aria-label="发布菜品表单"]').evaluate((form) => {
        window.tagTestSubmits = 0;
        form.addEventListener("submit", () => window.tagTestSubmits++);
      });
      await addValue("包子");
      await p
        .getByRole("button", { name: "移除标签 包子", exact: true })
        .waitFor();
      await addValue("早餐", true);
      assert((await chips.count()) === 2, "Enter did not add one chip");
      assert((await entry.inputValue()) === "", "Added entry was not cleared");
      assert(
        (await p.evaluate(() => window.tagTestSubmits)) === 0,
        "Tag Enter submitted the outer form",
      );
      await addValue(" 包子 ");
      assert((await chips.count()) === 2, "Duplicate tag was added");
      await entry.fill("中文输入");
      await entry.dispatchEvent("compositionstart");
      await entry.evaluate((node) =>
        node.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Enter",
            isComposing: true,
            bubbles: true,
          }),
        ),
      );
      assert(
        (await chips.count()) === 2 &&
          (await entry.inputValue()) === "中文输入",
        "IME confirmation was mistaken for tag submission",
      );
      await entry.dispatchEvent("compositionend");
      await entry.press("Enter");
      assert(
        (await chips.count()) === 3,
        "Confirmed Chinese entry cannot be added",
      );
      await p
        .getByRole("button", { name: "移除标签 中文输入", exact: true })
        .click();
      const invalid = "一二三四五六七八九十百";
      await addValue(invalid);
      await p.getByRole("alert").filter({ hasText: "1–10 个字" }).waitFor();
      assert(
        (await entry.inputValue()) === invalid && (await chips.count()) === 2,
        "Invalid tag text was lost or accepted",
      );
      await addValue("，、");
      await p
        .getByRole("alert")
        .filter({ hasText: "请填写个人标签内容" })
        .waitFor();
      assert(
        (await chips.count()) === 2 && (await entry.inputValue()) === "，、",
        "Separator-only input was accepted or discarded",
      );
      await addValue("午饭，晚饭、夜宵");
      assert(
        (await chips.count()) === 5,
        "Pasted list did not create separate chips",
      );
      await p.locator(".pc-composer-tags").screenshot({
        path: "output/playwright/publish-tags-" + width + ".png",
      });
      const extra = Array.from({ length: 15 }, (_, i) => "标签" + i);
      await addValue(extra.join("、"));
      assert((await chips.count()) === 20, "Did not allow twenty tags");
      await addValue("第21个");
      await p
        .getByRole("alert")
        .filter({ hasText: "最多添加 20 个" })
        .waitFor();
      assert(
        (await chips.count()) === 20 && (await entry.inputValue()) === "第21个",
        "Limit rejected incorrectly or lost pending text",
      );
      await p
        .getByRole("button", { name: "移除标签 包子", exact: true })
        .click();
      await add.click();
      assert((await chips.count()) === 20, "Cannot add after removing a chip");
      await entry.fill("待添加");
      await p.getByRole("button", { name: "暂存并离开", exact: true }).click();
      await p.getByRole("link", { name: "发布一道菜", exact: true }).click();
      await entry.waitFor();
      assert(
        (await chips.count()) === 20 && (await entry.inputValue()) === "待添加",
        "Navigation lost chips or pending input",
      );
      assert(
        !(await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        )),
        "Tag chips overflow at " + width,
      );
      checks.push(
        width +
          "px: click/Enter add, removable chips, duplicate and length validation, IME, paste, twenty-tag limit, draft and pending input retained",
      );
    } catch (error) {
      await p.screenshot({
        path: "output/playwright/publish-tags-failure.png",
        fullPage: false,
      });
      throw new Error(width + "px: " + error.message);
    } finally {
      await context.close();
    }
  }
  assert(errors.length === 0, errors.join("; "));
  assert(unexpected.length === 0, unexpected.join("; "));
  return { checks, errors, realBackendRequests: 0 };
}
