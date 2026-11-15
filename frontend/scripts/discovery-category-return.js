async function validateDiscoveryCategoryReturn(page) {
  const base = new URL(page.url()).origin;
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))
    throw new Error("请在本地开发页面运行");
  const checks = [],
    errors = [];
  const categories = [
    ["主食", "staple", "鲜虾蟹籽云吞"],
    ["菜", "side_dish", "铁锅炖大鹅"],
    ["小吃", "snack", "粘豆包"],
    ["饮品甜品", "drink", "杨枝甘露"],
    ["汤", "soup", "紫菜蛋花汤"],
  ];
  const foods = categories.map(([category, , name], index) => ({
    id: index + 1,
    name,
    category,
    restaurantId: 1,
    restaurantName: "回归测试餐厅",
    price: 15,
    pictureUrls: ["/prototype/assets/photos/sq_luosi.png"],
  }));
  const shop = {
    id: 1,
    name: "回归测试餐厅",
    address: "软件园",
    signatureFoods: foods.map((food) => ({
      ...food,
      pictureUrl: food.pictureUrls[0],
    })),
  };
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
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== base) return route.abort();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      let data = result([]);
      if (url.pathname === "/api/recommend") data = result([shop]);
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
      if (url.pathname === "/api/restaurant/detail/1") data = shop;
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
      const tab = p.getByRole("tab", { name, exact: true });
      await tab.waitFor();
      if ((await tab.getAttribute("aria-selected")) !== "true")
        throw new Error(
          `${width}px: 从${name}分类的菜品返回后，分类被重置为今日推荐`,
        );
      if (
        new URLSearchParams(new URL(p.url()).hash.split("?")[1]).get(
          "category",
        ) !== key
      )
        throw new Error(`${width}px: ${name}的返回地址缺少分类`);
    };
    const foodLink = (name) =>
      p.getByRole("link").filter({
        has: p.getByRole("heading", { name, level: 3, exact: true }),
      });
    try {
      await p.goto(`${base}/?demo=0#/`);
      for (const [name, key, food] of categories) {
        if (width < 640 && key === "soup") continue;
        await p.getByRole("tab", { name, exact: true }).click();
        await assertCategory(name, key);
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
      await p.getByRole("tab", { name: "今日推荐", exact: true }).click();
      if (
        new URLSearchParams(new URL(p.url()).hash.split("?")[1]).has("category")
      )
        throw new Error("切回今日推荐后未清除分类");
      checks.push(`${width}px: 可切回今日推荐`);
      if (width === 520) {
        await p.getByRole("tab", { name: "主食", exact: true }).click();
        await p.setViewportSize({ width: 1440, height: 1000 });
        await assertCategory("主食", "staple");
        await p.setViewportSize({ width: 520, height: 1000 });
        await assertCategory("主食", "staple");
        checks.push("手机与桌面布局互切保留当前分类");
      }
    } finally {
      await context.close();
    }
  }
  if (errors.length) throw new Error(errors.join("\n"));
  return { checks, errors, realBackendRequests: 0 };
}
