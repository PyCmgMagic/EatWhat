async (page) => {
  const base = new URL(page.url()).origin;
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))
    throw new Error("Use a local development server.");

  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const verified = [];
  const errors = [];
  const blocked = [];
  for (const width of [390, 820, 1440]) {
    const context = await page.context().browser().newContext({
      viewport: { width, height: 940 },
      reducedMotion: "reduce",
    });
    const admin = await context.newPage();
    admin.setDefaultTimeout(8000);
    admin.on("pageerror", (error) => errors.push(error.message));
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== base) return route.abort();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      blocked.push(url.pathname);
      return route.abort();
    });

    try {
      await admin.goto(base + "/?demo=1&persona=admin#/admin");
      const nav = admin.getByRole("navigation", { name: "管理模块" });
      if (width <= 960) {
        const menu = admin.getByRole("button", { name: "打开管理菜单" });
        await menu.waitFor();
        assert(!(await nav.count()), "Collapsed navigation is still exposed");
        await menu.focus();
        await admin.keyboard.press("Enter");
        const current = nav.getByRole("link", { name: "数据概览" });
        await current.waitFor();
        assert(await current.evaluate((el) => el === document.activeElement), "Opening navigation did not focus the current module");
        await admin.keyboard.press("Escape");
        assert(await menu.evaluate((el) => el === document.activeElement), "Dismissed navigation did not return focus");
        await menu.click();
      }
      await nav.getByRole("link", { name: "菜品管理", exact: true }).click();
      await admin.getByRole("heading", { name: "菜品管理", exact: true }).waitFor();

      const edit = admin.getByRole("button", { name: /^编辑 / }).first();
      await edit.click();
      const drawer = admin.locator("dialog.ew-admin-drawer");
      const select = drawer.getByRole("combobox", { name: "基础分类" });
      const native = drawer.locator('select[name="category"]');
      const wasSnack = (await native.inputValue()) === "snack";
      const target = wasSnack ? { value: "staple", label: "主食" } : { value: "snack", label: "小吃" };
      await select.click();
      const popup = drawer.locator(".ew-select-popup");
      assert(await popup.isVisible(), "Select popup did not stay inside the native drawer");
      assert(await popup.evaluate((el) => el.getAnimations().length === 0), "Select ignored reduced motion");
      await drawer.getByRole("option", { name: target.label, exact: true }).click();
      assert((await native.inputValue()) === target.value, "Native form value does not match selection");
      await select.click();
      await select.press("Escape");
      assert(await drawer.isVisible() && !(await drawer.getByRole("listbox").count()), "Escape should close only the select");
      await select.click();
      await drawer.getByRole("textbox", { name: "菜品名称" }).click();
      assert(!(await drawer.getByRole("listbox").count()), "Clicking the drawer outside the select did not dismiss it");
      await drawer.getByRole("button", { name: "关闭", exact: true }).click();
      await drawer.waitFor({ state: "detached" });
      assert(!(await admin.locator(".ew-select-popup").count()), "Select popup leaked after the drawer closed");
      verified.push({ width, flow: "Drawer select, native form value, dismissal, reduced motion" });

      const jump = admin.getByRole("button", { name: "跳转到模块" });
      await jump.click();
      const palette = admin.getByRole("dialog", { name: "跳转到模块" });
      const input = palette.getByRole("combobox", { name: "模块名称" });
      await input.waitFor();
      await admin.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "模块名称");
      for (let step = 0; step < 4; step++) {
        await admin.keyboard.press("Tab");
        assert(await palette.evaluate((el) => document.activeElement === document.body || el.contains(document.activeElement)), "Tab reached the background while the palette was open");
      }
      await input.focus();
      await admin.keyboard.press("Escape");
      await palette.waitFor({ state: "detached" });
      assert(await jump.evaluate((el) => el === document.activeElement), "Dismissed palette did not return focus");

      await admin.keyboard.press("Control+k");
      await input.fill("用户");
      const previous = admin.url();
      await input.dispatchEvent("keydown", { key: "Enter", isComposing: true, bubbles: true, cancelable: true });
      assert(admin.url() === previous && await palette.isVisible(), "IME confirmation submitted a module");
      await input.press("Enter");
      await admin.getByRole("heading", { name: "用户管理", exact: true }).waitFor();
      await palette.waitFor({ state: "detached" });
      verified.push({ width, flow: "Module palette, Escape and focus, Chinese IME and navigation" });
    } catch (error) {
      throw new Error(width + "px — " + error.message, { cause: error });
    } finally {
      await context.close();
    }
  }

  assert(verified.length === 6, "An admin flow was skipped");
  assert(errors.length === 0 && blocked.length === 0, JSON.stringify({ errors, blocked }));
  return { verified, realBackendRequests: 0 };
}
