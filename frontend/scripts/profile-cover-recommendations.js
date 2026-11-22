// Run against the local Vite app. Every API request uses the fixture below.
async (page) => {
  const base = await page.evaluate(() => location.origin);
  const results = [];
  for (const width of [1440, 390]) {
    const view = width === 390 ? "mobile" : "desktop";
    const context = await page.context().browser().newContext({ viewport: { width, height: 900 } });
    const p = await context.newPage();
    p.setDefaultTimeout(10000);
    const errors = [];
    p.on("pageerror", (error) => errors.push(error.message));
    const calls = [];
    let coverFoodId = null;
    let retryNextPage = true;
    let keys = ["foods/fixture/a", "foods/fixture/b"];
    const images = { "foods/fixture/a": "/assets/noodles.jpg", "foods/fixture/b": "/assets/rice.jpg" };
    const dish = (id) => ({
      id, accountId: 1, restaurantId: 3, restaurantName: "食堂", category: "主食",
      name: id === 13 ? "番茄盖饭" : "面条" + id, price: 8,
      pictureKeys: id === 13 ? keys : ["foods/fixture/other"], pictureUrls: id === 13 ? keys.map((k) => images[k]) : ["/assets/dumplings.jpg"],
    });
    const envelope = (items, hasNext = false) => ({ items, hasNext, totalItems: items.length });
    const shop = (id) => ({ id, name: id === 31 ? "第一家店" : "第二家店",
      signatureFoods: [{ id: 1 + id, name: "手工面", pictureUrl: "/assets/noodles.jpg" }] });
    await context.addInitScript(() => localStorage.setItem("eatwhat-session",
      JSON.stringify({ tokenName: "satoken", tokenValue: "fixture-local" })));
    await context.route("**/*", async (route) => {
      const url = route.request().url();
      if (!url.startsWith(base + "/")) return route.abort();
      if (!url.startsWith(base + "/api/")) return route.continue();
      const [path, search = ""] = url.slice(base.length + 4).split("?");
      const q = new Map(search.split("&").filter(Boolean).map((pair) => pair.split("=")));
      const body = route.request().postDataJSON();
      calls.push({ path, q: Object.fromEntries(q), body });
      let data = null;
      if (path === "/user/info") data = { id: 1, displayName: "测试食友", role: "admin", verified: true, coverFoodId };
      else if (path === "/user/updateInfo") { coverFoodId = body.coverFoodId; }
      else if (path === "/foods/my") data = q.has("foodId") ? envelope([dish(Number(q.get("foodId")))])
        : q.get("page") === "2" ? envelope([dish(13)]) : envelope([dish(1)], true);
      else if (path === "/user/userInfo") data = { id: 1, displayName: "测试食友" };
      else if (path === "/recommend") {
        const next = q.get("page") === "2";
        if (next && retryNextPage) {
          retryNextPage = false;
          return route.fulfill({ json: { code: 10003, msg: "请稍后重试" } });
        }
        data = { ...envelope(next ? [shop(31), shop(32)] : [shop(31)], !next), mealTime: "lunch" };
      }
      else if (path === "/recommend/pick") data = { restaurant: shop(32), mealTime: "lunch" };
      else if (path === "/foods/detail/13") data = dish(13);
      else if (path === "/foods/edit/13") { keys = body.pictures; data = { id: 13, revisionId: 9, pictureKeys: keys }; }
      else if (path === "/admin/foods/list") data = envelope([{ ...dish(13), uploaderName: "山大厨娘" }]);
      else if (path === "/campus/list") data = [{ id: 1, name: "软件园", isDefault: true }];
      else if (path === "/remote-config") data = { flags: {}, params: {} };
      else data = envelope([]);
      return route.fulfill({ json: { code: 0, data } });
    });
    const open = (path) => p.goto(base + "/?demo=0&view=" + view + "#" + path, { waitUntil: "domcontentloaded", timeout: 15000 });
    const assert = (condition, message) => { if (!condition) throw Error(message); };
    try {
      await open("/me/edit");
      await p.getByRole("button", { name: /主页封面/ }).click();
      await p.getByRole("navigation", { name: "封面菜品分页" }).getByRole("button", { name: "下一页" }).click();
      await p.getByRole("button", { name: "番茄盖饭" }).click();
      await Promise.all([
        p.waitForResponse((res) => res.url().endsWith("/user/updateInfo")),
        p.getByRole("button", { name: view === "desktop" ? "保存修改" : "保存", exact: true }).click(),
      ]);
      assert(coverFoodId === 13, "cover save was not acknowledged");
      await open("/me");
      await p.reload();
      const cover = p.locator(view === "desktop" ? ".profile-overview-cover" : ".mobile-profile-cover");
      await cover.locator('img[src="/assets/noodles.jpg"]').waitFor();
      assert(calls.some((call) => call.path === "/foods/my" && call.q.foodId === "13"), "saved cover did not use the ID filter");
      assert(!calls.some((call) => call.path === "/foods/detail/13"), "cover lookup created a browsing entry");
      await open("/");
      await p.getByRole("button", { name: "加载更多店铺" }).click();
      await p.getByRole("button", { name: "重试加载更多" }).waitFor();
      assert(await p.locator(".rec-shop-card").count() === 1, "page two failure removed the first page");
      await p.getByRole("button", { name: "重试加载更多" }).click();
      await p.getByText("已看完本轮推荐", { exact: true }).waitFor();
      assert(calls.some((call) => call.path === "/recommend" && call.q.page === "2" && call.q.mealTime === "lunch"), "wrong continuation");
      assert(await p.locator(".rec-shop-card").count() === 2, "appending lost a recommendation");
      await p.getByRole("button", { name: "随机选一家" }).click();
      await p.locator('.discovery-pick a[href="#/restaurants/32"]').waitFor();
      const pageCount = calls.filter((call) => call.path === "/recommend" && call.q.page === "2").length;
      await p.getByRole("button", { name: "换一批推荐", exact: true }).click();
      await p.getByRole("button", { name: "加载更多店铺" }).waitFor();
      assert(calls.filter((call) => call.path === "/recommend" && call.q.page === "2").length === pageCount, "refresh replayed page two");
      await open("/foods/13/edit");
      if (view === "desktop") {
        await p.getByRole("button", { name: "预览第 2 张照片" }).click();
        await p.getByRole("button", { name: "设为封面", exact: true }).click();
        await p.keyboard.press("Escape");
      } else {
        const grip = p.getByRole("button", { name: "调整第 2 张照片的顺序" });
        await grip.focus();
        await grip.press("Enter");
        await p.getByRole("button", { name: "调整第 1 张照片的顺序" }).press("Enter");
      }
      await p.getByRole("button", { name: view === "desktop" ? "保存菜品修改" : "保存修改", exact: true }).click();
      await p.waitForURL(/#\/foods\/13$/);
      assert(keys.join(",") === "foods/fixture/b,foods/fixture/a", "stored photo keys were not reordered");
      await open("/admin/foods");
      await p.getByRole("cell", { name: "山大厨娘" }).waitFor();
      assert(!calls.some((call) => call.path.includes("leaderboard")), "unexpected leaderboard request");
      assert(errors.length === 0, errors.join("\n"));
      results.push({ view, width, coverFoodId, firstPhoto: keys[0], passed: true });
    } catch (error) {
      const content = await p.locator("body").innerText({ timeout: 1000 }).catch(() => "");
      throw Error(view + " " + p.url() + ": " + error.message + "\n" + content.slice(-1100) + "\n" + JSON.stringify(calls.slice(-6)));
    } finally {
      await context.close();
    }
  }
  return results;
}
