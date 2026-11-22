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
    let rejectCoverSave = true;
    let retryNextPage = true;
    let drawResponse = "shop";
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
      else if (path === "/user/updateInfo") {
        if (rejectCoverSave) {
          rejectCoverSave = false;
          return route.fulfill({ json: { code: 10003, msg: "请稍后重试" } });
        }
        coverFoodId = body.coverFoodId;
      }
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
      else if (path === "/recommend/pick") {
        if (drawResponse === "error") return route.fulfill({ json: { code: 10003, msg: "请稍后重试" } });
        data = { restaurant: drawResponse === "empty" ? null : shop(32), mealTime: "lunch" };
      }
      else if (path === "/restaurant/detail/32") data = shop(32);
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
      await open("/me");
      const trigger = p.getByRole("button", { name: "更换主页封面" });
      const sheet = p.getByRole("dialog", { name: "更换主页封面" });
      const updates = () => calls.filter(c => c.path === "/user/updateInfo");
      await trigger.waitFor();
      assert(await trigger.evaluate(el => !el.textContent.trim() && !el.querySelector("svg, img")), "cover background has a visible edit label");
      await trigger.click({ position: { x: 80, y: 90 } });
      await sheet.getByRole("button", { name: "面条1", pressed: true }).waitFor();
      await p.keyboard.press("Escape");
      await sheet.waitFor({ state: "hidden" });
      assert(updates().length === 0, "closing the sheet saved a cover");
      assert(await trigger.evaluate(el => document.activeElement === el), "cover did not regain keyboard focus");
      await trigger.press("Enter");
      const rect = await sheet.boundingBox();
      assert(rect && Math.abs(900 - rect.y - rect.height) < 2, "cover sheet is not at the bottom");
      await sheet.getByRole("button", { name: "下一页" }).click();
      await sheet.getByRole("button", { name: "番茄盖饭" }).click();
      await sheet.getByRole("alert").waitFor();
      assert(!coverFoodId, "failed save changed the cover");
      await sheet.getByRole("button", { name: "番茄盖饭" }).click();
      await sheet.waitFor({ state: "hidden" });
      assert(coverFoodId === 13, "cover save was not acknowledged");
      assert(updates().every(c => Object.keys(c.body).join() === "coverFoodId"), "cover save changed other profile fields");
      const cover = p.locator(view === "desktop" ? ".profile-overview-cover" : ".mobile-profile-cover");
      await cover.locator('img[src="/assets/noodles.jpg"]').waitFor();
      await p.reload();
      await cover.locator('img[src="/assets/noodles.jpg"]').waitFor();
      await trigger.press("Enter");
      await sheet.getByRole("button", { name: "下一页" }).click();
      await sheet.getByRole("button", { name: "番茄盖饭", pressed: true }).click();
      await sheet.waitFor({ state: "hidden" });
      assert(updates().length === 2, "current cover was written again");
      await p.getByRole("link", { name: "编辑资料" }).click();
      await p.waitForURL(/#\/me\/edit$/);
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
      await p.getByRole("link", { name: "随机选一家" }).click();
      await p.getByRole("heading", { name: "随机选一家" }).waitFor();
      const drawCalls = () => calls.filter((c) => c.path === "/recommend/pick");
      assert(drawCalls().length === 0, "entering the draw page consumed a pick");
      assert(await p.getByLabel("饭点", { exact: true }).inputValue() === "lunch", "did not carry the meal");
      await p.getByRole("button", { name: "抽一张餐牌", exact: true }).dblclick();
      await p.getByRole("link", { name: "去看店铺" }).waitFor();
      assert(drawCalls().length === 1, "a double click consumed multiple picks");
      await p.getByRole("link", { name: "去看店铺" }).click();
      await p.waitForURL(/#\/restaurants\/32$/);
      await p.goBack();
      await p.getByRole("heading", { name: "第二家店" }).waitFor();
      await p.getByRole("link", { name: "返回发现" }).click();
      await p.getByRole("link", { name: "随机选一家" }).click();
      await p.getByRole("button", { name: "抽取左侧餐牌" }).click();
      await p.getByRole("heading", { name: "第二家店" }).waitFor();
      drawResponse = "empty";
      await p.getByRole("button", { name: "再抽一张" }).click();
      await p.getByText("这个范围暂时没有店铺，换个饭点或分类再抽。").waitFor();
      await p.getByLabel("分类", { exact: true }).selectOption("drink");
      await p.waitForFunction(() => document.activeElement?.getAttribute("name") === "kind");
      await p.emulateMedia({ reducedMotion: "reduce" });
      drawResponse = "error";
      await p.getByRole("button", { name: "抽取右侧餐牌" }).press("Enter");
      await p.getByRole("alert").getByText("请稍后重试").waitFor();
      drawResponse = "shop";
      await p.getByRole("button", { name: "抽一张餐牌", exact: true }).press("Enter");
      await p.getByRole("link", { name: "去看店铺" }).waitFor();
      assert(drawCalls().at(-1).q.kind === "drink", "draw ignored changed category");
      await p.getByRole("link", { name: "返回发现" }).click();
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
