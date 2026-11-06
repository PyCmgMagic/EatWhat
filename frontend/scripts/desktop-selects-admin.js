async (page) => {
  const checks = [], issues = [], errors = [];
  for (const width of [390, 1440]) {
    const context = await page.context().browser().newContext({ viewport: { width, height: 940 }, reducedMotion: "reduce" });
    const p = await context.newPage();
    p.setDefaultTimeout(8000);
    p.on("pageerror", e => errors.push(e.message));
    await context.route(url => url.hostname !== "127.0.0.1" || url.pathname.startsWith("/api/"), r => r.abort());
    try {
      await p.goto("http://127.0.0.1:5173/?demo=1&persona=admin#/admin");
      await p.locator("body").ariaSnapshot();
      await p.getByRole("button", { name: "菜品维护", exact: true }).click();
      await p.getByRole("button", { name: "编辑", exact: true }).first().click();
      await p.locator("body").ariaSnapshot();
      const select = p.getByRole("combobox", { name: "基础分类", exact: true });
      await select.click();
      if (!await p.locator("dialog .ew-select-popup").isVisible()) throw new Error("popup outside native modal");
      if (await p.locator(".ew-select-popup").evaluate(el => getComputedStyle(el).animationName) !== "none") throw new Error("reduced motion ignored");
      await p.getByRole("option", { name: "小吃时间", exact: true }).click();
      if (await p.locator("#admin-food-category-native").inputValue() !== "snack") throw new Error("modal native value mismatch");
      await select.click();
      await select.press("Escape");
      if (!await p.locator("dialog.modal").isVisible() || await p.getByRole("listbox").count()) throw new Error("Escape closed the whole modal");
      await select.click();
      await p.locator("dialog [name=name]").click();
      if (await p.getByRole("listbox").count()) throw new Error("outside click failed inside dialog");
      await p.getByRole("button", { name: "关闭弹窗", exact: true }).click();
      await p.locator("dialog.modal").waitFor({ state: "detached" });
      if (await p.locator(".ew-select-popup").count()) throw new Error("orphan popup after modal close");
      checks.push({ width, flow: "native modal, selection, Escape, outside, reduced motion, cleanup" });
    } catch (error) {
      issues.push({ width, error: String(error) });
    } finally { await context.close(); }
  }
  return { checks, issues, errors };
}
