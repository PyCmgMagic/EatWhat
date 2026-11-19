async function validateDiscoveryCategoryReturn(page) {
  const base = new URL(page.url()).origin;
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))
    throw new Error("请在本地开发页面运行");
  const checks = [],
    errors = [];
  const categories = [
    ["美食", "food", "铁锅炖大鹅"],
    ["甜点饮品", "drink", "杨枝甘露"],
    ["自助", "buffet", "自助小火锅"],
  ];
  const foods = categories.map(([, kind, name], index) => ({
    id: index + 1,
    name,
    category: kind === "drink" ? "饮品甜品" : "菜",
    restaurantId: index + 1,
    restaurantName: ["东北饭庄", "转角甜品", "校园自助"][index],
    price: [46, 15, 28][index],
    stageColor: "soy",
    pictureUrls: ["/prototype/assets/photos/sq_tieguo.png"],
  }));
  const shops = foods.map((food, index) => ({
    id: food.restaurantId,
    name: food.restaurantName,
    kind: categories[index][1],
    distanceMeters: 540,
    categories: ["米饭炒菜"],
    address: "软件园",
    signatureFoods: [{ ...food, pictureUrl: food.pictureUrls[0] }],
  }));
  const result = (items) => ({
    items,
    currentPage: 1,
    totalItems: items.length,
    totalPages: items.length ? 1 : 0,
    hasNext: false,
  });
  for (const width of [360, 520, 820, 1440]) {
    const context = await page
      .context()
      .browser()
      .newContext({
        viewport: { width, height: 1000 },
        reducedMotion: "reduce",
      });
    const p = await context.newPage();
    p.setDefaultTimeout(10000);
    p.on("pageerror", (error) => errors.push(error.message));
    const requests = [];
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== base) return route.abort();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      let data = result([]);
      if (url.pathname === "/api/recommend") {
        const kind = url.searchParams.get("kind");
        requests.push(kind);
        data = result(shops.filter((shop) => shop.kind === kind));
      }
      if (url.pathname === "/api/foods/list")
        data = result(
          foods.filter(
            (food) =>
              !url.searchParams.has("category") ||
              food.category === url.searchParams.get("category"),
          ),
        );
      if (url.pathname.startsWith("/api/foods/detail/"))
        data = foods.find(
          (food) => food.id === Number(url.pathname.split("/").pop()),
        );
      if (url.pathname.startsWith("/api/restaurant/detail/"))
        data = shops.find(
          (shop) => shop.id === Number(url.pathname.split("/").pop()),
        );
      if (url.pathname === "/api/campus/list")
        data = [{ id: 1, name: "软件园", isDefault: true, open: true }];
      if (url.pathname === "/api/remote-config")
        data = {
          configVersion: 1,
          flags: {},
          params: {},
          maintenance: { mode: "NONE" },
          announcements: [],
          versions: {},
        };
      return route.fulfill({ status: 200, json: { code: 0, data } });
    });
    const assertCategory = async (name, key) => {
      await p.getByRole("tab", { name, exact: true, selected: true }).waitFor();
      if (
        new URLSearchParams(new URL(p.url()).hash.split("?")[1]).get(
          "category",
        ) !== (key === "food" ? null : key)
      )
        throw new Error(`${width}px: ${name}的返回地址缺少分类`);
    };
    const foodLink = (name) =>
      p.locator('[role="tabpanel"] .rec-shop-dish').filter({ hasText: name });
    try {
      await p.goto(`${base}/?demo=0#/`);
      await p.getByRole("tab", { name: "美食", exact: true }).waitFor();
      if (
        (
          await p
            .getByRole("tablist", { name: "店铺分类" })
            .getByRole("tab")
            .allTextContents()
        ).join("/") !== "美食/甜点饮品/自助"
      )
        throw new Error("首页分类数量或顺序有误");
      await foodLink(foods[0].name).waitFor();
      if (requests.join() !== "food")
        throw new Error("默认列表重复请求了美食推荐");
      for (const [name, key, food] of categories) {
        await p.getByRole("tab", { name, exact: true }).click();
        await assertCategory(name, key);
        await foodLink(food).waitFor();
        if (
          (await p.locator(".mobile-home-copy h1, .pc-hero h1").innerText()) !==
          foods[0].name
        )
          throw new Error("切换分类改变了主推荐");
        await foodLink(food).click();
        await p.getByRole("link", { name: "返回", exact: true }).click();
        await assertCategory(name, key);
        await foodLink(food).click();
        await p.getByRole("link", { name: "返回", exact: true }).waitFor();
        await p.goBack();
        await assertCategory(name, key);
        await p.reload();
        await assertCategory(name, key);
        await foodLink(food).waitFor();
        checks.push(
          `${width}px ${name}: 详情返回、浏览器后退、刷新均保留分类及菜品列表`,
        );
      }
      await p.getByRole("tab", { name: "美食", exact: true }).click();
      await assertCategory("美食", "food");
      const first = p.getByRole("tab", { name: "美食", exact: true });
      await first.focus();
      await p.keyboard.press("ArrowRight");
      await assertCategory("甜点饮品", "drink");
      if (width === 520) {
        await p.setViewportSize({ width: 1440, height: 1000 });
        await assertCategory("甜点饮品", "drink");
        await p.setViewportSize({ width: 520, height: 1000 });
        await assertCategory("甜点饮品", "drink");
        checks.push("手机与桌面布局互切保留当前分类");
      }
    } finally {
      await context.close();
    }
  }
  if (errors.length) throw new Error(errors.join("\n"));
  return { checks, errors, realBackendRequests: 0 };
}
