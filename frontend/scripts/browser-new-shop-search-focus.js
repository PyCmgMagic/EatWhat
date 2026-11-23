async (seed) => {
  const base = new URL(seed.url()).origin;
  const context = await seed.context().browser().newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  const checks = [];
  await context.route(url => url.origin !== base, route => route.abort());
  try {
    for (const theme of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme: theme });
      for (const [view, width] of [["desktop", 1440], ["mobile", 390]]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${base}/?demo=1&view=${view}#/restaurants/new`);
        const input = page.getByRole("searchbox", { name: "搜索店名或地址", exact: true });
        await input.waitFor({ timeout: 10000 });
        const background = () => input.evaluate(el => getComputedStyle(el.closest("form")).backgroundColor);
        await input.evaluate(el => el.blur());
        const before = await background();
        await page.keyboard.press("Tab");
        await input.focus();
        const after = await background();
        const style = await input.evaluate(el => ({ border: getComputedStyle(el).borderWidth, shadow: getComputedStyle(el).boxShadow, focused: document.activeElement === el }));
        if (!style.focused || before === after || style.shadow !== "none" || style.border !== "0px")
          throw Error(JSON.stringify({ view, theme, before, after, style }));
        checks.push({ view, theme, focusVisible: before !== after, seamlessInput: true });
        await page.getByRole("button", { name: view === "desktop" ? "手动添加" : "搜不到？手动添加", exact: true }).click();
        await page.getByRole("heading", { name: "填写店铺信息", exact: true }).waitFor();
      }
    }
    return checks;
  } finally { await context.close(); }
}
