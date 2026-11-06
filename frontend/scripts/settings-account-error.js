async (page) => {
  const origin = new URL(page.url()).origin;
  if (!/^https?:\/\//.test(origin)) {
    throw new Error("请先打开当前项目页面，再运行账号错误验收。");
  }
  const browser = page.context().browser();
  if (!browser) throw new Error("当前页面没有可创建隔离上下文的浏览器。");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
    serviceWorkers: "block",
  });
  const checks = [];
  const unexpected = [];
  const pageErrors = [];
  let fixture = "500";
  let apiRequests = 0;
  let accountRequests = 0;
  let blockedExternal = 0;
  let blockedWrites = 0;
  const failureMessage = "账号读取验收：服务暂时不可用";
  const user = {
    id: 7105,
    displayName: "账号重试验收同学",
    userName: "settings_qa",
    hasUsername: true,
    hasPassword: false,
    phone: "13800138000",
    avatar: null,
    email: null,
    verified: false,
    method: null,
    role: "user",
    banned: false,
    banReason: null,
    signature: "隔离的账号读取失败验收",
  };
  const emptyPage = {
    items: [],
    currentPage: 1,
    totalItems: 0,
    totalPages: 0,
    hasNext: false,
  };
  const json = (route, data, status = 200, msg = "ok") =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify({ code: status === 200 ? 0 : "QA_FAILURE", msg, data }),
    });
  const isAccountResponse = (response) => {
    const url = new URL(response.url());
    return url.origin === origin && url.pathname === "/api/user/info";
  };
  async function assertNoVerificationGate(testPage, label) {
    if (await testPage.locator(".ew-access").count()) {
      throw new Error(label + "：账号资料错误被误显示为登录或学生认证拦截。");
    }
    if (
      await testPage
        .getByRole("link", { name: "去完成学生认证", exact: true })
        .count()
    ) {
      throw new Error(label + "：出现不应存在的学生认证操作。");
    }
  }
  try {
    await context.addInitScript(() => {
      sessionStorage.setItem(
        "eatwhat-session",
        JSON.stringify({ tokenName: "x-settings-qa", tokenValue: "isolated-account-error" }),
      );
    });
    await context.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== origin) {
        blockedExternal += 1;
        return route.abort();
      }
      if (url.pathname !== "/api" && !url.pathname.startsWith("/api/")) {
        return route.continue();
      }
      apiRequests += 1;
      const path = url.pathname.slice(4);
      if (request.method() !== "GET") {
        blockedWrites += 1;
        unexpected.push(request.method() + " " + path);
        return json(route, null, 503, "验收禁止业务写入");
      }
      if (path === "/user/info") {
        accountRequests += 1;
        return fixture === "500"
          ? json(route, null, 500, failureMessage)
          : json(route, fixture === "null" ? null : user);
      }
      if (path === "/campus/list") return json(route, []);
      if (path === "/remote-config") {
        return json(route, {
          configVersion: 1,
          flags: {},
          params: {},
          maintenance: { mode: "NONE", message: null, until: null },
          announcements: [],
          update: null,
        });
      }
      if (path === "/notification/cards/unread/count") {
        return json(route, { cards: 0, members: 0 });
      }
      if (path === "/notification/unread/count") return json(route, 0);
      if (["/foods/my", "/foods/favorites", "/foods/tags/my"].includes(path)) {
        return json(route, emptyPage);
      }
      if (path === "/user/userInfo") {
        return json(route, {
          ...user,
          fansCount: 0,
          followingsCount: 0,
          fansVisible: true,
          followingsVisible: true,
          uploadedFoodsCount: 0,
          favoriteFoodsCount: 0,
          earnedLikes: 0,
        });
      }
      unexpected.push(request.method() + " " + path);
      return json(route, null, 503, "未配置的隔离验收接口：" + path);
    });

    for (const scenario of [
      { path: "/me", mode: "500", message: failureMessage },
      { path: "/me", mode: "null", message: "服务未返回所需数据，请稍后重试。" },
      { path: "/settings", mode: "500", message: failureMessage },
    ]) {
      fixture = scenario.mode;
      const testPage = await context.newPage();
      testPage.setDefaultTimeout(15_000);
      testPage.on("pageerror", (error) => pageErrors.push(error.message));
      try {
        const initialResponse = testPage.waitForResponse(isAccountResponse);
        await testPage.goto(origin + "/?demo=0&view=mobile#" + scenario.path, {
          waitUntil: "domcontentloaded",
        });
        const response = await initialResponse;
        const expectedStatus = scenario.mode === "500" ? 500 : 200;
        if (response.status() !== expectedStatus) {
          throw new Error("未命中预期的账号接口 fixture：" + scenario.mode);
        }
        const errorContainer = testPage.locator(
          scenario.path === "/me"
            ? '.mobile-canvas > .mobile-status[role="alert"]'
            : '.ew-mobile-feature > .error-state[role="alert"]',
        );
        await errorContainer.waitFor();
        await errorContainer.getByText(scenario.message, { exact: true }).waitFor();
        if (scenario.path === "/me") {
          await errorContainer
            .getByRole("heading", { name: "暂时没能读取账号", exact: true })
            .waitFor();
        }
        const retry = errorContainer.getByRole("button", {
          name: scenario.path === "/me" ? "重新加载账号" : "重新加载",
          exact: true,
        });
        await retry.waitFor();
        await assertNoVerificationGate(testPage, scenario.path + " " + scenario.mode);

        fixture = "success";
        const [recoveredResponse] = await Promise.all([
          testPage.waitForResponse(isAccountResponse),
          retry.click(),
        ]);
        const recovered = await recoveredResponse.json();
        if (recoveredResponse.status() !== 200 || recovered.data?.id !== user.id) {
          throw new Error("重试没有读取成功 fixture。");
        }
        if (scenario.path === "/settings") {
          await testPage
            .locator(".settings-home-identity")
            .getByRole("heading", { level: 2, name: user.displayName, exact: true })
            .waitFor();
        } else {
          await testPage
            .locator(".mobile-canvas")
            .getByRole("heading", { level: 1, name: user.displayName, exact: true })
            .waitFor();
          await testPage.locator(".mobile-canvas h1.mobile-profile-name").waitFor();
        }
        await errorContainer.waitFor({ state: "hidden" });
        await assertNoVerificationGate(testPage, scenario.path + " 重试成功");
        if (new URL(testPage.url()).hash !== "#" + scenario.path) {
          throw new Error("重试后离开了原页面：" + testPage.url());
        }
        checks.push({ route: scenario.path, fixture: scenario.mode, recovered: true });
      } finally {
        await testPage.close();
      }
    }
    if (unexpected.length) throw new Error("未配置的 API 或写请求：" + unexpected.join(", "));
    if (pageErrors.length) throw new Error("页面异常：" + pageErrors.join(" | "));
    return {
      checks,
      apiRequests,
      accountRequests,
      blockedExternal,
      blockedWrites,
      realBackendRequests: 0,
    };
  } finally {
    await context.close();
  }
}
