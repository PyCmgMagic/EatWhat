async function validateProfileReference(page) {
  const base = new URL(page.url()).origin;
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))
    throw new Error("请在本地开发页面运行");
  const context = await page
    .context()
    .browser()
    .newContext({
      viewport: { width: 420, height: 897 },
      reducedMotion: "reduce",
    });
  const p = await context.newPage();
  const errors = [],
    checks = [];
  p.setDefaultTimeout(10000);
  p.on("pageerror", (error) => errors.push(error.message));
  const empty = {
    items: [],
    totalItems: 0,
    currentPage: 1,
    totalPages: 0,
    hasNext: false,
  };
  const user = {
    id: 1,
    displayName: "PyCmg",
    signature: "是啊，吃什么",
    userName: "pycmg",
    hasUsername: true,
    avatar: "/assets/salad.jpg",
    verified: true,
    role: "user",
    level: 3,
  };
  const dish = {
    id: 23,
    name: "锅包肉",
    category: "staple",
    price: 46,
    pictureUrls: ["/assets/chicken.jpg"],
    likeCount: 1,
  };
  const pageOf = (food) => ({
    ...empty,
    items: [food],
    totalItems: 1,
    totalPages: 1,
  });
  await context.addInitScript(() =>
    localStorage.setItem(
      "eatwhat-session",
      JSON.stringify({
        tokenName: "x-session",
        tokenValue: "isolated-profile-reference",
      }),
    ),
  );
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== base) return route.abort();
    if (!url.pathname.startsWith("/api/")) return route.continue();
    let data = empty;
    if (url.pathname === "/api/user/info") data = user;
    if (url.pathname === "/api/user/userInfo")
      data = {
        ...user,
        earnedLikes: 1,
        uploadedFoodsCount: 1,
        fansCount: 0,
        followingsCount: 2,
      };
    if (url.pathname === "/api/user/growth")
      data = { level: 3, totalExperience: 120 };
    if (url.pathname === "/api/foods/my") data = pageOf(dish);
    if (url.pathname === "/api/foods/likes")
      data = pageOf({ ...dish, id: 42, name: "酸汤面", price: 12 });
    if (url.pathname === "/api/campus/list")
      data = [{ id: 1, name: "软件园", open: true, isDefault: true }];
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
  try {
    await p.goto(`${base}/?demo=0&view=mobile#/me`);
    await p
      .getByRole("heading", { name: user.displayName, exact: true })
      .waitFor();
    await p.getByRole("heading", { name: dish.name, exact: true }).waitFor();
    await p.getByText("@pycmg", { exact: true }).waitFor();
    await p.getByRole("link", { name: /我的成长，等级 3/ }).waitFor();
    await p
      .locator('.mobile-profile-cover[data-cover-kind="photo"] img')
      .waitFor();
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: "output/playwright/profile-reference-420.png" });
    for (const [width, height] of [
      [320, 568],
      [390, 844],
      [420, 897],
      [520, 932],
      [568, 320],
    ]) {
      await p.setViewportSize({ width, height });
      await p.waitForFunction(() => {
        const sheet = document.querySelector(".mobile-profile-sheet");
        const stage = document.querySelector(".mobile-profile-stage");
        return (
          sheet &&
          stage &&
          Math.abs(sheet.getBoundingClientRect().top - stage.offsetHeight) < 2
        );
      });
      const measure = await p.evaluate(() => {
        const rect = (selector) => {
          const r = document.querySelector(selector).getBoundingClientRect();
          return {
            top: r.top,
            bottom: r.bottom,
            left: r.left,
            right: r.right,
            width: r.width,
            height: r.height,
          };
        };
        return {
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          identity: rect(".mobile-profile-identity"),
          sheet: rect(".mobile-profile-sheet"),
          name: rect(".mobile-profile-title-row"),
          avatar: rect(".mobile-profile-avatar"),
        };
      });
      if (measure.overflow || measure.identity.bottom > measure.sheet.top + 1)
        throw new Error(
          `${width}px 个人信息溢出或被面板遮挡: ${JSON.stringify(measure)}`,
        );
      await p.getByRole("tab", { name: "上传 1", exact: true }).click();
      await p.getByRole("heading", { name: dish.name, exact: true }).waitFor();
      await p.getByText("¥46", { exact: true }).waitFor();
      if (width === 390)
        await p.screenshot({
          path: "output/playwright/profile-reference-390.png",
        });
      await p.getByRole("tab", { name: "收藏", exact: true }).click();
      await p
        .getByRole("heading", { name: "还没有收藏的菜", exact: true })
        .waitFor();
      await p
        .getByRole("tab", { name: "收藏", exact: true })
        .press("ArrowRight");
      await p.getByRole("heading", { name: "酸汤面", exact: true }).waitFor();
      await p.getByText("¥12", { exact: true }).waitFor();
      await p.getByRole("tab", { name: "评论", exact: true }).click();
      await p
        .getByRole("heading", { name: "还没写过评论", exact: true })
        .waitFor();
      if (
        (await p
          .getByRole("tab", { name: "评论", exact: true })
          .getAttribute("aria-selected")) !== "true"
      )
        throw new Error("评论标签未选中");
      if (
        !(await p
          .getByRole("navigation", { name: "主导航", exact: true })
          .isVisible())
      )
        throw new Error("评论标签隐藏了底栏");
      await p.reload();
      await p
        .getByRole("heading", { name: "还没写过评论", exact: true })
        .waitFor();
      const handle = p.getByRole("button", {
        name: "展开我的内容",
        exact: true,
      });
      await handle.press("ArrowUp");
      await p
        .getByRole("button", { name: "收起我的内容", exact: true })
        .waitFor();
      await p
        .getByRole("button", { name: "收起我的内容", exact: true })
        .press("Escape");
      await handle.waitFor();
      checks.push(
        `${width}×${height}: 比例、数据、上传/收藏/赞过/评论、刷新保留、面板收展、底栏`,
      );
    }
    await p.getByRole("link", { name: "编辑资料", exact: true }).click();
    await p.getByRole("heading", { name: "编辑资料", exact: true }).waitFor();
    await p.goBack();
    await p
      .getByRole("heading", { name: "还没写过评论", exact: true })
      .waitFor();
    checks.push("编辑资料入口和返回时保留评论标签");
    await p.emulateMedia({ colorScheme: "dark" });
    await p.waitForFunction(() => {
      const name = document.querySelector(".mobile-profile-name");
      const history = document.querySelector(".mobile-profile-history");
      return (
        document.documentElement.dataset.theme === "dark" &&
        name &&
        history &&
        getComputedStyle(name).color === getComputedStyle(history).color
      );
    });
    checks.push("深色模式下昵称使用高对比文字颜色");
    if (errors.length) throw new Error(errors.join("\n"));
    return { checks, errors, realBackendRequests: 0 };
  } finally {
    await context.close();
  }
}
