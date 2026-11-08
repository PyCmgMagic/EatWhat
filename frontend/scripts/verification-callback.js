async function validateVerificationCallback(page) {
  const checks = [],
    errors = [];
  const base = "http://127.0.0.1:5173";
  async function setup(width = 390, authenticated = true) {
    const context = await page
      .context()
      .browser()
      .newContext({ viewport: { width, height: 844 } });
    const state = {
      verified: false,
      accountId: 10,
      userReads: 0,
      failResult: false,
      writes: [],
    };
    await context.addInitScript(
      ({ authenticated }) => {
        if (location.hostname === "127.0.0.1" && authenticated)
          localStorage.setItem(
            "eatwhat-session",
            JSON.stringify({
              tokenName: "x-session",
              tokenValue: "isolated-verification-callback",
            }),
          );
      },
      { authenticated },
    );
    context.on("page", (p) => {
      p.setDefaultTimeout(10000);
      p.on("pageerror", (e) => errors.push(e.message));
    });
    await context.route(
      (u) => u.origin !== base,
      (r) => r.abort(),
    );
    await context.route(
      (u) => u.pathname === "/test-school-auth",
      (r) =>
        r.fulfill({
          contentType: "text/html; charset=utf-8",
          body: "<h1>隔离的学校认证测试</h1>",
        }),
    );
    await context.route(
      (u) => u.pathname.startsWith("/api/"),
      (r) => {
        const path = new URL(r.request().url()).pathname;
        let data = [];
        if (path === "/api/user/info") {
          state.userReads++;
          if (state.failResult && state.userReads >= 2)
            return r.fulfill({
              status: 503,
              json: { code: 50001, msg: "认证状态暂时无法读取" },
            });
          data = {
            id: state.accountId,
            displayName: "测试同学",
            verified: state.verified,
            banned: false,
          };
        } else if (path === "/api/auth/sdu") {
          state.writes.push(path);
          data = { url: base + "/test-school-auth", expiresIn: 300 };
        } else if (path === "/api/foods/71/favorite") {
          state.writes.push(path);
          data = null;
        } else if (path === "/api/user/activity") {
          data = { firstUseToday: false, experienceAdded: 0 };
        } else if (r.request().method() !== "GET") {
          errors.push("Unexpected mutation: " + path);
          return r.abort();
        } else if (path === "/api/foods/detail/71")
          data = {
            id: 71,
            name: "招牌牛筋面",
            restaurantId: 9,
            restaurantName: "渔见17码头",
            price: 18.9,
            category: "staple",
            isFavorite: false,
            isLiked: false,
            likesCount: 1,
          };
        else if (path === "/api/restaurant/detail/9")
          data = { id: 9, name: "渔见17码头" };
        else if (path === "/api/campus/list")
          data = [{ id: 1, name: "软件园", open: true, isDefault: true }];
        else if (path === "/api/remote-config")
          data = {
            configVersion: 1,
            flags: {},
            params: {},
            maintenance: { mode: "NONE" },
            announcements: [],
            versions: {},
          };
        else if (path === "/api/notification/unread/count") data = 0;
        else if (path === "/api/auth/verify")
          data = state.verified ? ["verify:sso"] : [];
        else if (path.includes("/tags"))
          data = { systemTags: [], myCustomTags: [] };
        return r.fulfill({ status: 200, json: { code: 0, data } });
      },
    );
    return { context, p: await context.newPage(), state };
  }
  const assert = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  const callback = (result = "success", code = "0") =>
    `${base}/home?result=${result}&code=${code}`;
  for (const width of [390, 1280]) {
    const { context, p, state } = await setup(width);
    try {
      await p.goto(
        base + "/?demo=0#/verify?next=%2Ffoods%2F71%3Ffrom%3Dnearby",
      );
      await p
        .getByRole("button", { name: "获取学校认证入口", exact: true })
        .click();
      const [resultPage] = await Promise.all([
        context.waitForEvent("page"),
        p
          .getByRole("link", { name: "前往学校认证页面 ↗", exact: true })
          .click(),
      ]);
      await resultPage
        .getByRole("heading", { name: "隔离的学校认证测试" })
        .waitFor();
      assert(
        await resultPage.evaluate(() => window.opener === null),
        "School tab unexpectedly has opener access",
      );
      state.verified = true;
      const reads = state.userReads;
      await resultPage.goto(callback());
      await resultPage
        .getByRole("heading", { name: "学生认证成功", exact: true })
        .waitFor();
      assert(
        resultPage.url() === base + "/#/verify?result=success&code=0",
        "Callback fell through to home",
      );
      assert(
        state.userReads >= reads + 2,
        "Result did not independently confirm the account state",
      );
      assert(
        state.writes.length === 1,
        "Callback replayed the original protected action",
      );
      const back = resultPage
        .locator(".verification-result-actions")
        .getByRole("link", { name: "返回原页面", exact: true });
      assert(
        (await back.getAttribute("href")) === "#/foods/71?from=nearby",
        "Noopener callback lost original page/query",
      );
      assert(
        !(await resultPage.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )),
        "Result layout overflow",
      );
      await resultPage.screenshot({
        path: `output/playwright/verification-callback-${width}.png`,
        fullPage: true,
      });
      await resultPage.reload();
      await resultPage
        .getByRole("heading", { name: "学生认证成功", exact: true })
        .waitFor();
      assert(
        (await back.getAttribute("href")) === "#/foods/71?from=nearby",
        "Refreshing the result lost its return destination",
      );
      await back.click();
      await resultPage
        .getByRole("heading", { name: "招牌牛筋面", exact: true })
        .waitFor();
      assert(
        state.writes.length === 1,
        "Returning replayed the original action",
      );
      await resultPage.close();
      await p.bringToFront();
      // Headless Chromium keeps background pages visible and may not emit focus
      // when bringToFront() runs. Exercise the same event a real tab return emits.
      await p.evaluate(() => window.dispatchEvent(new Event("focus")));
      await p.getByText("学生身份已认证", { exact: true }).waitFor();
      checks.push(
        `${width}px: real /home callback, noopener return/query recovery, server-confirmed success, refresh persistence, no action replay, original tab refreshes`,
      );
    } finally {
      await context.close();
    }
  }
  const { context, p, state } = await setup();
  try {
    await p.goto(callback());
    await p
      .getByRole("heading", { name: "暂未确认认证完成", exact: true })
      .waitFor();
    assert(
      (await p
        .getByRole("heading", { name: "学生认证成功", exact: true })
        .count()) === 0,
      "URL alone certified the user",
    );
    await p.goto(callback("failure", "30012"));
    await p
      .getByRole("heading", { name: "本次认证未完成", exact: true })
      .waitFor();
    await p
      .getByText("认证链接已过期或已使用，请重新获取学校认证入口。", {
        exact: true,
      })
      .waitFor();
    assert(
      (await p
        .getByRole("link", { name: "返回认证页", exact: true })
        .getAttribute("href")) === "#/verify?next=%2Fsettings%2Faccount",
      "Failure has no safe restart",
    );
    state.verified = true;
    await p.goto(callback());
    await p
      .getByRole("heading", { name: "学生认证成功", exact: true })
      .waitFor();
    assert(
      (await p
        .locator(".verification-result-actions")
        .getByRole("link", { name: "返回账号与安全", exact: true })
        .getAttribute("href")) === "#/settings/account",
      "Missing origin fell back to home",
    );
    checks.push(
      "Success URL is not trusted; expired callbacks explain failure; missing origin falls back to account settings",
    );
  } finally {
    await context.close();
  }
  for (const mode of ["network", "account", "guest"]) {
    const { context, p, state } = await setup(390, mode !== "guest");
    try {
      if (mode === "network") state.failResult = true;
      if (mode === "account") {
        state.accountId = 20;
        await p.goto(base);
        await p.evaluate(() =>
          localStorage.setItem(
            "eatwhat-verification-return-v1",
            JSON.stringify({
              id: "another-account",
              accountId: 10,
              returnTo: "/foods/71",
              expiresAt: Date.now() + 600000,
            }),
          ),
        );
      }
      await p.goto(callback());
      if (mode === "guest") {
        await p.getByText("登录", { exact: false }).first().waitFor();
        const route = new URL(p.url()).hash.slice(1);
        const loginNext = new URLSearchParams(route.split("?")[1]).get("next");
        assert(
          route === "/verify?result=success&code=0" ||
            loginNext === "/verify?result=success&code=0",
          "Signed-out callback lost result route: " + route,
        );
      } else {
        await p
          .getByRole("heading", {
            name:
              mode === "network" ? "暂时无法确认认证结果" : "登录账号已变化",
            exact: true,
          })
          .waitFor();
        assert(
          (await p
            .getByRole("heading", { name: "学生认证成功", exact: true })
            .count()) === 0,
          "Invalid account state marked successful",
        );
        if (mode === "network") {
          state.failResult = false;
          state.verified = true;
          await p
            .getByRole("button", { name: "刷新认证状态", exact: true })
            .click();
          await p
            .getByRole("heading", { name: "学生认证成功", exact: true })
            .waitFor();
        }
      }
      checks.push(`${mode}: safe result handling and no false success`);
    } finally {
      await context.close();
    }
  }
  assert(errors.length === 0, errors.join("; "));
  return { checks, errors, realBackendRequests: 0 };
}
