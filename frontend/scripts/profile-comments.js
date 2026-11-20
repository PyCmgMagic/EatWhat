async function validateProfileComments(page) {
  const base = new URL(page.url()).origin;
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))
    throw new Error("请在本地开发页面运行");
  const checks = [];
  for (const width of [320, 390, 520]) {
    const context = await page
      .context()
      .browser()
      .newContext({
        viewport: { width, height: 844 },
        isMobile: true,
        hasTouch: true,
        reducedMotion: "reduce",
      });
    const p = await context.newPage();
    const requests = [],
      errors = [];
    const empty = { items: [], totalItems: 0, totalPages: 0, hasNext: false };
    const user = {
      id: 10,
      displayName: "评论入口验证",
      verified: true,
      role: "user",
    };
    p.on("pageerror", (error) => errors.push(error.message));
    p.setDefaultTimeout(10000);
    await context.addInitScript(() => {
      localStorage.setItem(
        "eatwhat-session",
        JSON.stringify({
          tokenName: "x-session",
          tokenValue: "isolated-comments-check",
        }),
      );
    });
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== base) return route.abort();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      let data = empty;
      if (url.pathname === "/api/user/info") data = user;
      if (url.pathname === "/api/user/userInfo")
        data = {
          ...user,
          earnedLikes: 0,
          uploadedFoodsCount: 0,
          fansCount: 0,
          followingsCount: 0,
        };
      if (url.pathname === "/api/campus/list")
        data = [{ id: 1, name: "软件园", open: true, isDefault: true }];
      if (url.pathname === "/api/comments/my") {
        requests.push({
          method: route.request().method(),
          page: url.searchParams.get("page"),
          pageSize: url.searchParams.get("pageSize"),
        });
        if (width !== 320)
          data = {
            ...empty,
            totalItems: 1,
            totalPages: 1,
            items: [
              {
                id: 1,
                foodId: 7,
                rootId: width === 520 ? 2 : null,
                text: "我的用餐评论",
                createdAt: 1794736800000,
                pictureUrls: width === 520 ? ["comments/test.jpg"] : [],
              },
            ],
          };
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ code: 0, msg: "ok", data }),
      });
    });
    try {
      const path = width === 320 ? "/me?tab=comments" : "/me/shares?tab=comments";
      await p.goto(`${base}/?demo=0&view=mobile#${path}`);
      await p.getByRole("heading", { name: "我的评论", exact: true }).waitFor();
      await p
        .getByText(width === 320 ? "还没有评论记录。" : "我的用餐评论", {
          exact: true,
        })
        .waitFor();
      if (width !== 320) {
        await p.getByText("已发布", { exact: true }).waitFor();
        if (width === 520) {
          await p.getByText("回复", { exact: true }).waitFor();
          await p.getByText("1 张图片", { exact: true }).waitFor();
        }
        if (
          (await p
            .getByRole("link", { name: "查看菜品", exact: true })
            .getAttribute("href")) !== "#/foods/7?section=comments"
        )
          throw new Error("评论未关联原菜品");
      }
      if (
        !requests.length ||
        requests.some(
          (request) =>
            JSON.stringify(request) !==
            JSON.stringify({ method: "GET", page: "1", pageSize: "20" }),
        )
      )
        throw new Error(
          `我的评论未正确请求 /comments/my: ${JSON.stringify(requests)}`,
        );
      if (
        await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        )
      )
        throw new Error(`${width}px 页面横向溢出`);
      await p.getByRole("link", { name: "返回我的", exact: true }).click();
      await p
        .getByRole("heading", { name: "还没有分享过菜", exact: true })
        .waitFor();
      await p.getByRole("tab", { name: "足迹", exact: true }).waitFor();
      if (await p.getByRole("tab", { name: "评论", exact: true }).count())
        throw new Error("个人页仍有评论标签");
      if (errors.length) throw new Error(errors.join("\n"));
      checks.push(
        `${width}px: 评论入口、后端 v2 请求路径、${width === 320 ? "空态" : width === 390 ? "已发布评论" : "带图回复"}、返回个人页`,
      );
    } finally {
      await context.close();
    }
  }
  return { checks };
}
