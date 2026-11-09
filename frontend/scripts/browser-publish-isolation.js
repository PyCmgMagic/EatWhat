async (page) => {
  const base = "http://127.0.0.1:5173";
  const browser = page.context().browser();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const tab = await context.newPage();
  tab.setDefaultTimeout(10000);
  const title = tab.getByRole("textbox", { name: "菜名", exact: true });
  const selectPhoto = async name => {
    const photo = await tab.request.get(base + "/prototype/assets/photos/" + name);
    await tab.locator("input[type=file]").setInputFiles({
      name, mimeType: "image/png", buffer: await photo.body(),
    });
  };
  const writes = [];
  const errors = [];
  tab.on("pageerror", (error) => errors.push(error.message));
  let releasePut;
  const held = new Promise((resolve) => {
    releasePut = resolve;
  });
  const check = (value, message) => {
    if (!value) throw Error(message);
  };

  await context.route(
    (url) => url.origin !== base,
    (route) => route.abort(),
  );
  await context.route(base + "/mock-storage", async (route) => {
    await held;
    await route.fulfill({ status: 200, body: "" });
  });
  await context.route(
    (url) => url.origin === base && url.pathname.startsWith("/api/"),
    (route) => {
      const request = route.request(),
        path = new URL(request.url()).pathname;
      const owner = request.headers()["x-review"];
      const shop = { id: 1, name: "测试食堂" };
      let data = [];
      if (request.method() !== "GET")
        writes.push({ path, owner, body: request.postDataJSON() });
      if (path === "/api/user/info")
        data = {
          id: owner === "Bearer A" ? 21 : 22,
          displayName: "测试食友",
          role: "user",
          verified: true,
        };
      if (path === "/api/notification/unread/count") data = 0;
      if (
        path === "/api/restaurant/browse" ||
        path === "/api/restaurant/search"
      )
        data = { items: [shop], hasNext: false, totalItems: 1 };
      if (path === "/api/restaurant/detail/1") data = shop;
      if (path === "/api/foods/detail/71")
        data = {
          id: 71,
          accountId: 21,
          restaurantId: 1,
          name: "测试菜品",
          price: 2,
          mealTimes: [],
          category: null,
          stageColor: null,
          stageAlternates: null,
          pictureUrl: [],
        };
      if (path === "/api/upload/presign")
        data = { key: "foods/test.jpg", putUrl: base + "/mock-storage" };
      if (path === "/api/upload/complete") data = { key: "foods/test.jpg" };
      if (path === "/api/foods/upload") data = { id: 71 };
      return route.fulfill({ json: { code: 0, data } });
    },
  );
  try {
    const loginTab = await context.newPage();
    await loginTab.goto(base + "/prototype/assets/icons/edit.svg");
    const login = (token) =>
      loginTab.evaluate((value) => {
        localStorage.setItem(
          "eatwhat-session",
          JSON.stringify({ tokenName: "x-review", tokenValue: value }),
        );
      }, token);
    await login("A");
    await tab.bringToFront();
    await tab.goto(base + "/?view=desktop#/foods/71/edit");
    await tab.getByLabel("推荐理由").fill("只修改说明");
    await tab.getByRole("button", { name: "保存菜品修改" }).click();
    await tab.waitForURL("**#/foods/71");
    await tab.locator(".pc-dish-info h1").waitFor();
    const edit = writes.find((w) => w.path === "/api/foods/my/71");
    check(
      JSON.stringify(edit?.body) ===
        JSON.stringify({ description: "只修改说明" }),
      "Edit sent untouched fields",
    );
    // Reopen an unsaved draft written by the previous form, then explicitly
    // choose the previously implied dinner value. Only this user choice is sent.
    await tab.evaluate(() =>
      sessionStorage.setItem(
        "eatwhat:live:draft:food:21:71",
        JSON.stringify({
          description: "暂存的说明",
          category: "other",
          stage: "broth",
          meals: ["dinner"],
        }),
      ),
    );
    await tab.goto(base + "/?view=desktop#/foods/71/edit");
    await tab.reload();
    const dinner = tab.getByLabel("晚饭", { exact: true });
    check(
      !(await dinner.isChecked()),
      "Old display default was treated as a user edit",
    );
    check(
      (await tab.getByLabel("推荐理由").inputValue()) === "暂存的说明",
      "Legacy description did not load",
    );
    await dinner.check();
    await tab.getByRole("button", { name: "保存菜品修改" }).click();
    await tab.waitForURL("**#/foods/71");
    const resumed = writes
      .filter((w) => w.path === "/api/foods/my/71")
      .at(-1).body;
    check(
      resumed.description === "暂存的说明" &&
        resumed.mealTimes?.join() === "dinner" &&
        Object.keys(resumed).length === 2,
      "Resumed draft lost an explicit change: " + JSON.stringify(resumed),
    );

    await tab.goto(base + "/?view=desktop#/publish");
    await tab.getByRole("radio", { name: /测试食堂/ }).click();
    await title.fill("账号A的草稿");
    await tab.getByLabel("价格", { exact: true }).fill("2");
    await selectPhoto("sq_luosi.png");
    await tab.locator(".pc-composer-submit button[type=submit]:enabled").waitFor();
    const putting = tab.waitForRequest(
      (req) => req.url() === base + "/mock-storage",
    );
    await tab.getByRole("button", { name: "发布这道菜" }).click();
    await putting;
    const switched = tab.waitForResponse(
      (res) =>
        res.url().endsWith("/api/user/info") &&
        res.request().headers()["x-review"] === "Bearer B",
    );
    await login("B");
    await switched;
    await tab.bringToFront();
    await tab.waitForFunction(
      () => document.querySelector('input[name="name"]')?.value === "",
    );
    await title.fill("账号B自己的草稿");
    releasePut();
    await tab.getByRole("radio", { name: /测试食堂/ }).click();
    await tab.getByLabel("价格", { exact: true }).fill("4");
    check(
      !(await tab.getByRole("button", { name: "发布这道菜" }).isEnabled()),
      "A's photos leaked into B's editor",
    );
    await selectPhoto("sq_tieguo.png");
    await tab.getByRole("button", { name: "发布这道菜" }).click();
    await tab.waitForURL("**#/foods/71");
    const created = writes.filter((w) => w.path === "/api/foods/upload");
    const confirmed = writes.filter((w) => w.path === "/api/upload/complete");
    check(
      confirmed.length === 1 && confirmed[0].owner === "Bearer B",
      "Old upload continued after account switch",
    );
    check(
      created.length === 1 &&
        created[0].owner === "Bearer B" &&
        created[0].body.name === "账号B自己的草稿",
      "Wrong account or stale draft was published",
    );
    return {
      engine: browser.browserType().name(),
      editedFields: Object.keys(edit.body),
      published: created[0].body.name,
    };
  } catch (error) {
    throw new Error(
      error.message +
        " " +
        JSON.stringify({
          writes,
          errors,
          page: (await tab.locator("body").innerText()).slice(-1000),
        }),
    );
  } finally {
    releasePut();
    await context.close();
  }
}
