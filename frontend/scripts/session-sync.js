async (page) => {
  const base = new URL(page.url()).origin;
  const context = await page
    .context()
    .browser()
    .newContext({ viewport: { width: 1440, height: 1000 } });
  const checks = [],
    errors = [];
  const first = { tokenName: "x-session", tokenValue: "isolated-account-a" };
  const second = { tokenName: "x-session", tokenValue: "isolated-account-b" };
  let expired = false,
    holdNextIdentity = false,
    releaseIdentity,
    identityPending;
  let holdNextLogout = false,
    releaseLogout,
    logoutPending;
  let logoutRequests = 0;
  context.on("page", (tab) => {
    tab.setDefaultTimeout(10000);
    tab.on("pageerror", (error) => errors.push(error.message));
  });
  // All business requests stay in this isolated browser context.
  await context.route(
    (url) => url.origin !== base,
    (route) => route.abort(),
  );
  await context.route(
    (url) => url.origin === base && url.pathname.startsWith("/api/"),
    async (route) => {
      const path = new URL(route.request().url()).pathname.slice(4);
      let data = null;
      if (path === "/user/info") {
        if (holdNextIdentity) {
          holdNextIdentity = false;
          await new Promise((resolve) => {
            releaseIdentity = resolve;
            identityPending();
          });
          return route.fulfill({
            status: 401,
            json: { code: 401, msg: "Previous session expired" },
          });
        }
        if (expired)
          return route.fulfill({
            status: 401,
            json: { code: 401, msg: "Session expired" },
          });
        const isSecond =
          route.request().headers()["x-session"] ===
          `Bearer ${second.tokenValue}`;
        data = {
          id: isSecond ? 20 : 10,
          displayName: isSecond ? "同步账号乙" : "同步账号甲",
          verified: true,
          banned: false,
          role: "user",
          hasPassword: true,
          hasUsername: true,
          phone: "13812345678",
        };
      } else if (path === "/remote-config") {
        data = {
          configVersion: 1,
          flags: {},
          params: {},
          maintenance: { mode: "NONE" },
          announcements: [],
          versions: {},
        };
      } else if (path === "/campus/list") data = [];
      else if (path === "/notification/cards/unread/count")
        data = { cards: 0, members: 0 };
      else if (path === "/auth/logout") {
        logoutRequests++;
        if (holdNextLogout) {
          holdNextLogout = false;
          await new Promise((resolve) => {
            releaseLogout = resolve;
            logoutPending();
          });
        }
      }
      return route.fulfill({ status: 200, json: { code: 0, data } });
    },
  );
  const assert = (value, message) => {
    if (!value) throw new Error(message);
  };
  const settings = base + "/?demo=0&view=desktop#/settings";
  const write = (tab, session) =>
    tab.evaluate(async (value) => {
      const runtime = await import("/src/app/runtime.ts");
      runtime.writeSession(value);
    }, session);
  const signedOut = (tab) =>
    tab
      .getByRole("banner")
      .getByRole("link", { name: "登录", exact: true })
      .waitFor();
  try {
    const a = await context.newPage();
    await a.addInitScript((value) => {
      if (
        location.search.includes("legacy=1") &&
        sessionStorage.getItem("qa-seeded") === null
      ) {
        sessionStorage.setItem("eatwhat-session", JSON.stringify(value));
        sessionStorage.setItem("qa-seeded", "1");
      }
    }, first);
    await a.goto(base + "/?demo=0&view=desktop&legacy=1#/settings");
    await a.getByRole("heading", { name: "同步账号甲", exact: true }).waitFor();
    assert(
      (await a.evaluate(() => sessionStorage.getItem("eatwhat-session"))) ===
        null,
      "Legacy session was not removed",
    );
    const b = await context.newPage();
    await b.goto(settings);
    await b.getByRole("heading", { name: "同步账号甲", exact: true }).waitFor();
    assert(
      (await b.evaluate(() => sessionStorage.getItem("eatwhat-session"))) ===
        null,
      "New tab unexpectedly depends on sessionStorage",
    );
    checks.push(
      "Existing session migrates; an independently opened tab inherits the login",
    );

    const demo = await context.newPage();
    await demo.goto(base + "/?demo=1&view=desktop#/settings");
    await demo.getByRole("button", { name: "退出登录", exact: true }).waitFor();
    assert(
      (await demo.evaluate(
        async () =>
          (await import("/src/app/runtime.ts")).readSession().tokenValue,
      )) === "isolated-demo-token",
      "Demo reused the real login",
    );
    await write(b, second);
    await a.getByRole("heading", { name: "同步账号乙", exact: true }).waitFor();
    assert(
      (await a
        .getByRole("heading", { name: "同步账号甲", exact: true })
        .count()) === 0,
      "Previous account data remains visible",
    );
    await b.reload();
    await b.getByRole("heading", { name: "同步账号乙", exact: true }).waitFor();
    checks.push(
      "Account switch refreshes the other tab and clears the previous identity",
    );

    await b.getByRole("button", { name: "退出登录", exact: true }).click();
    await b.getByRole("button", { name: "确认退出", exact: true }).click();
    await signedOut(a);
    await signedOut(b);
    assert(
      logoutRequests === 1,
      "Other tabs must not send duplicate logout requests",
    );
    await a.reload();
    await signedOut(a);
    await demo.getByRole("button", { name: "退出登录", exact: true }).waitFor();
    checks.push(
      "UI logout synchronizes without reload, survives refresh and leaves demo signed in",
    );

    await a.evaluate(
      (value) =>
        sessionStorage.setItem("eatwhat-session", JSON.stringify(value)),
      first,
    );
    await a.reload();
    await signedOut(a);
    assert(
      (await a.evaluate(async () =>
        (await import("/src/app/runtime.ts")).readSession(),
      )) === null,
      "Old tab resurrected a logged-out session",
    );
    checks.push("Stale sessionStorage cannot resurrect a shared logout");

    await write(b, first);
    await a
      .getByRole("banner")
      .getByRole("link", { name: "我的主页", exact: true })
      .waitFor();
    await a.goto(settings);
    await a.getByRole("heading", { name: "同步账号甲", exact: true }).waitFor();
    expired = true;
    await b.goto(settings);
    await b.reload();
    await signedOut(a);
    await signedOut(b);
    assert(
      (await b.evaluate(() =>
        JSON.parse(localStorage.getItem("eatwhat-session")),
      )) === null,
      "401 failed to clear shared session",
    );
    expired = false;
    checks.push("Login and authenticated 401 expiry synchronize across tabs");

    await write(a, first);
    await b.goto(settings);
    await b.getByRole("heading", { name: "同步账号甲", exact: true }).waitFor();
    const pending = new Promise((resolve) => {
      identityPending = resolve;
    });
    holdNextIdentity = true;
    await b.reload();
    await pending;
    await write(a, second);
    await b.getByRole("heading", { name: "同步账号乙", exact: true }).waitFor();
    const oldResponse = b.waitForResponse(
      (response) =>
        response.url().endsWith("/api/user/info") && response.status() === 401,
    );
    releaseIdentity();
    releaseIdentity = undefined;
    await oldResponse;
    // A fresh read and rendered identity must both still refer to the new login.
    assert(
      (await b.evaluate(
        async () =>
          (await import("/src/app/runtime.ts")).readSession().tokenValue,
      )) === second.tokenValue,
      "Delayed 401 erased the new account",
    );
    await b.getByRole("heading", { name: "同步账号乙", exact: true }).waitFor();
    checks.push(
      "A delayed 401 from an old account cannot clear the newer shared login",
    );

    const pendingLogout = new Promise((resolve) => {
      logoutPending = resolve;
    });
    holdNextLogout = true;
    await b.getByRole("button", { name: "退出登录", exact: true }).click();
    await b.getByRole("button", { name: "确认退出", exact: true }).click();
    await pendingLogout;
    await write(a, first);
    const logoutResponse = b.waitForResponse((response) =>
      response.url().endsWith("/api/auth/logout"),
    );
    releaseLogout();
    releaseLogout = undefined;
    await logoutResponse;
    await b.waitForURL((url) => url.hash === "#/auth");
    assert(
      (await b.evaluate(
        async () =>
          (await import("/src/app/runtime.ts")).readSession().tokenValue,
      )) === first.tokenValue,
      "Delayed logout erased the newer account",
    );
    await b.goto(settings);
    await b.getByRole("heading", { name: "同步账号甲", exact: true }).waitFor();
    checks.push(
      "An old pending logout cannot erase a newer login from another tab",
    );

    await a.evaluate(() => localStorage.clear());
    await signedOut(b);
    checks.push("Clearing shared storage signs out other tabs");
    assert(errors.length === 0, errors.join("\n"));
    return { checks, pageErrors: errors, realBackendRequests: 0 };
  } catch (error) {
    const tabs = await Promise.all(
      context
        .pages()
        .map(async (tab) => ({
          url: tab.url(),
          text: (await tab.locator("body").innerText()).slice(0, 1500),
        })),
    );
    throw new Error(
      JSON.stringify({
        completed: checks,
        error: String(error),
        tabs,
        pageErrors: errors,
      }),
    );
  } finally {
    releaseIdentity?.();
    releaseLogout?.();
    await context.close();
  }
}
