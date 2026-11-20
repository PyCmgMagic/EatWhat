async function verifyHomeDismissConfirmation(page) {
  const base = new URL(page.url()).origin;
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) throw Error("请在本地开发页面运行");
  const shops = ["东北饭庄", "香锅小站"].map((name, i) => ({
    id: i + 41, name, kind: "food",
    signatureFoods: [{ id: i + 11, name: ["锅包肉", "麻辣香锅"][i], price: 32 }],
  }));
  const assert = (condition, message) => { if (!condition) throw Error(message); };
  for (const width of [390, 1440]) {
    const context = await page.context().browser().newContext({
      viewport: { width, height: 900 }, reducedMotion: "reduce",
    });
    try {
      const p = await context.newPage();
      const posts = [];
      await context.addInitScript(() => localStorage.setItem("eatwhat-session",
        JSON.stringify({ tokenName: "satoken", tokenValue: "test-only" })));
      await context.route("**/*", route => {
        const url = new URL(route.request().url());
        if (url.origin !== base) return route.abort();
        if (!url.pathname.startsWith("/api/")) return route.continue();
        let data = [];
        if (url.pathname === "/api/recommend") data = { items: shops, hasNext: false, mealTime: "dinner" };
        if (url.pathname === "/api/user/info") data = { id: 1, userName: "食友", verified: true };
        if (url.pathname === "/api/campus/list") data = [{ id: 1, name: "软件园", open: true, isDefault: true }];
        if (url.pathname === "/api/remote-config") data = { configVersion: 1, flags: {}, params: {}, maintenance: { mode: "NONE" }, announcements: [], versions: {} };
        if (url.pathname.startsWith("/api/recommend/dismiss/")) {
          posts.push([route.request().method(), url.pathname]);
          if (posts.length === 1) return route.fulfill({ json: { code: 40001, message: "操作失败，请重试" } });
          data = null;
        }
        return route.fulfill({ json: { code: 0, data } });
      });
      await p.goto(base + "/?demo=0#/");
      const trigger = p.getByRole("button", { name: "不想吃这家", exact: true });
      const hero = p.locator(".mobile-home-copy h1, .pc-hero-copy h1");
      const dialog = p.getByRole("dialog", { name: "不想吃这家？" });
      const confirm = dialog.getByRole("button", { name: "确认不推荐" });
      await trigger.click();
      await dialog.getByText("接下来 30 天，首页将不再推荐「东北饭庄」及其菜品。").waitFor();
      assert(posts.length === 0, "打开弹窗时已提交");
      await dialog.getByRole("button", { name: "取消", exact: true }).click();
      await dialog.waitFor({ state: "hidden" });
      await trigger.click();
      await p.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
      assert(!posts.length && await hero.innerText() === "锅包肉", "取消后推荐发生变化");

      await trigger.click();
      await confirm.click();
      await dialog.waitFor({ state: "hidden" });
      assert(posts.length === 1 && await hero.innerText() === "锅包肉", "失败后应保留原推荐");
      await trigger.click();
      await confirm.press("Enter");
      await hero.getByText("麻辣香锅", { exact: true }).waitFor();
      assert(posts.length === 2 && posts.every(([method, path]) =>
        method === "POST" && path === "/api/recommend/dismiss/41"), "提交次数或店铺错误");
    } finally {
      await context.close();
    }
  }
  return { widths: [390, 1440], realBackendRequests: 0 };
}
