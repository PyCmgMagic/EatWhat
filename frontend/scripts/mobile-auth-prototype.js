async function validateMobileAuthPrototype(page) {
  const context = await page
    .context()
    .browser()
    .newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
    });
  const p = await context.newPage();
  p.setDefaultTimeout(10000);
  const checks = [],
    errors = [],
    writes = [],
    outside = [];
  p.on("pageerror", (error) => errors.push(error.message));
  const user = {
    id: 10,
    displayName: "PyCmg",
    signature: "认真吃饭，认真生活。",
    verified: true,
    banned: false,
    role: "user",
  };
  const paged = (items) => ({
    items,
    currentPage: 1,
    totalItems: items.length,
    totalPages: items.length ? 1 : 0,
    hasNext: false,
  });
  const reply = (r, data) =>
    r.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ code: 0, data }),
    });
  await context.route(
    (url) => url.hostname !== "127.0.0.1",
    (r) => {
      outside.push(r.request().url());
      return r.abort();
    },
  );
  await context.route(
    (url) => url.pathname.startsWith("/api/"),
    (r) => {
      const url = new URL(r.request().url()),
        path = url.pathname;
      if (r.request().method() !== "GET") writes.push(path);
      if (path === "/api/auth/consent/policy")
        return reply(r, { version: "qa-v1", url: "/api/qa-policy" });
      if (path === "/api/qa-policy")
        return r.fulfill({
          contentType: "text/html",
          body: "<main><h1>测试政策 qa-v1</h1><p>用于隔离的本地界面回归测试。</p></main>",
        });
      if (path === "/api/auth/login")
        return reply(r, {
          isLogin: true,
          tokenName: "x-qa-session",
          tokenValue: "isolated-test",
        });
      if (path === "/api/user/info") return reply(r, user);
      if (path === "/api/user/userInfo")
        return reply(r, {
          ...user,
          earnedLikes: 0,
          uploadedFoodsCount: 0,
          fansCount: 0,
          followingsCount: 0,
        });
      if (path === "/api/campus/list")
        return reply(r, [
          { id: 1, name: "软件园", open: true, isDefault: true },
        ]);
      if (path === "/api/notification/unread/count") return reply(r, 0);
      if (path === "/api/foods/tags/my")
        return reply(r, paged([{ id: 9, name: "想吃", usageCount: 2 }]));
      if (path === "/api/history/browse") {
        const restaurant = url.searchParams.get("targetType") === "restaurant";
        return reply(
          r,
          paged([
            {
              targetId: 8,
              targetType: restaurant ? "restaurant" : "food",
              viewedAt: new Date().toISOString(),
              ...(restaurant
                ? { restaurant: { id: 8, name: "测试餐厅" } }
                : { food: { id: 8, name: "测试菜品" } }),
            },
          ]),
        );
      }
      if (["/api/foods/my", "/api/foods/favorites"].includes(path))
        return reply(r, paged([]));
      return reply(r, []);
    },
  );
  const base = "http://127.0.0.1:5173/?view=mobile#";
  try {
    await p.goto(base + "/me");
    await p.locator('[data-screen="G-Login"]').waitFor();
    if (!p.url().endsWith("/auth?next=%2Fme"))
      throw new Error("Protected page lost its login destination");
    if (await p.getByRole("dialog").count())
      throw new Error("Mobile unexpectedly opened a desktop login dialog");
    for (const width of [320, 390, 520]) {
      await p.setViewportSize({ width, height: 844 });
      await p
        .getByRole("link", { name: "登录", exact: true })
        .scrollIntoViewIfNeeded();
      if (
        await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )
      )
        throw new Error(`Login overflow at ${width}`);
    }
    await p.setViewportSize({ width: 390, height: 844 });
    await p.screenshot({
      path: "output/playwright/mobile-prototype-login-390.png",
      fullPage: true,
    });
    await p.getByRole("link", { name: "登录", exact: true }).click();
    await p.locator('[data-screen="G-PasswordLogin"]').waitFor();
    await p.getByRole("link", { name: "使用验证码登录", exact: true }).click();
    await p.locator('[data-screen="G-PhoneLogin"]').waitFor();
    await p.screenshot({
      path: "output/playwright/mobile-prototype-phone-390.png",
      fullPage: true,
    });
    await p
      .getByRole("link", { name: "已有账号，去登录", exact: true })
      .click();
    await p.locator('[data-screen="G-PasswordLogin"]').waitFor();
    if (!p.url().endsWith("/auth/password?next=%2Fme"))
      throw new Error("Auth mode switch lost its return destination");
    await p.screenshot({
      path: "output/playwright/mobile-prototype-password-390.png",
      fullPage: true,
    });
    await p.locator('input[name="username"]').fill("mobile_qa");
    await p.locator('input[name="password"]').fill("isolated-test-password");
    await p.getByRole("button", { name: "登录", exact: true }).click();
    await p
      .getByRole("heading", { name: user.displayName, exact: true })
      .waitFor();
    if (!p.url().endsWith("#/me"))
      throw new Error("Login did not return to the profile");
    checks.push(
      "Mobile protected route, single-site login, password/phone switching and successful return (isolated API mocks)",
    );
    if ((await p.getByRole("tab", { selected: true }).count()) !== 1)
      throw new Error("Profile selected more than one tab");
    await p.getByRole("tab", { name: "收藏", exact: true }).click();
    await p
      .getByRole("heading", { name: "还没有收藏的菜", exact: true })
      .waitFor();
    await p.getByRole("tab", { name: "上传 0", exact: true }).click();
    await p
      .getByRole("heading", { name: "还没有分享过菜", exact: true })
      .waitFor();
    await p.screenshot({
      path: "output/playwright/mobile-prototype-profile-390.png",
      fullPage: true,
    });
    await p.getByRole("link", { name: /我的标签/ }).click();
    await p.locator('[data-screen="G-MyTags"]').waitFor();
    await p.getByText("想吃", { exact: true }).waitFor();
    await p.getByRole("link", { name: /想吃/ }).click();
    if (!p.url().endsWith("/favorites?tag=9"))
      throw new Error("Tag selection lost its filter");
    await p.goto(base + "/history");
    await p.locator('[data-screen="G-History"]').waitFor();
    await p.getByText("测试菜品", { exact: true }).waitFor();
    await p.getByRole("tab", { name: "店", exact: true }).click();
    await p.getByText("测试餐厅", { exact: true }).waitFor();
    checks.push(
      "Prototype profile tabs, tags and history use API data and preserve navigation",
    );
    if (errors.length || outside.length)
      throw new Error("Runtime errors or unexpected remote access");
    if (writes.join(",") !== "/api/auth/login")
      throw new Error(
        "Unexpected write during validation: " + writes.join(","),
      );
    return {
      checks,
      errors,
      outsideRequests: outside.length,
      mockedWrites: writes,
    };
  } catch (error) {
    return {
      checks,
      errors,
      failure: String(error),
      url: p.url(),
      snapshot: await p.locator("body").innerText(),
    };
  } finally {
    await context.close();
  }
}
