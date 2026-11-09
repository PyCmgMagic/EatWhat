async function validateSingleSiteAuth(page) {
  const base = "http://127.0.0.1:5173",
    checks = [],
    errors = [];
  const assert = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  for (const width of [320, 390, 1440]) {
    const context = await page
      .context()
      .browser()
      .newContext({
        viewport: { width, height: 900 },
        reducedMotion: "reduce",
      });
    const p = await context.newPage(),
      requests = [];
    p.setDefaultTimeout(10000);
    p.on("pageerror", (e) => errors.push(e.message));
    await context.addInitScript(() => {
      window.TencentCaptcha = class {};
    });
    const user = {
      id: 10,
      userName: "Student10",
      displayName: "校园食友",
      hasUsername: true,
      hasPassword: true,
      phone: "13800000000",
      verified: true,
      banned: false,
      role: "admin",
    };
    let legacy = false,
      newUser = false;
    await context.route(
      () => true,
      async (route) => {
        const req = route.request(),
          url = new URL(req.url()),
          path = url.pathname;
        if (url.origin !== base) return route.abort();
        if (!path.startsWith("/api/")) return route.continue();
        requests.push({ path, method: req.method(), body: req.postDataJSON() });
        const reply = (data, code = 0) =>
          route.fulfill({ json: { code, data } });
        if (path.includes("/consent") || path.includes("/sync"))
          return route.fulfill({
            status: 503,
            json: { code: 503, msg: "Retired endpoint" },
          });
        if (
          [
            "/api/auth/login",
            "/api/auth/phone/login",
          ].includes(path)
        ) {
          if (legacy)
            return reply(
              {
                consentProof: "legacy-proof",
                registrationAccepted: true,
                identityReady: false,
              },
              20005,
            );
          return reply({
            isLogin: true,
            tokenName: "x-single-site",
            tokenValue: "isolated-test",
            newUser,
          });
        }
        if (path === "/api/user/info") return reply(user);
        if (path === "/api/user/userInfo")
          return reply({
            ...user,
            fansCount: 0,
            followingsCount: 0,
            uploadedFoodsCount: 0,
            earnedLikes: 0,
          });
        if (path === "/api/auth/captcha/config")
          return reply({ enabled: false });
        if (["/api/auth/checkUsername", "/api/auth/phone/code"].includes(path))
          return reply(null);
        if (path === "/api/auth/verify") return reply(["verify:sso"]);
        if (path === "/api/campus/list")
          return reply([
            { id: 1, name: "软件园", open: true, isDefault: true },
          ]);
        if (path === "/api/remote-config")
          return reply({ flags: {}, maintenance: { mode: "NONE" } });
        if (path === "/api/notification/unread/count") return reply(0);
        if (path === "/api/foods/recommend") return reply([]);
        if (path === "/api/admin/summary") return reply({});
        return reply({
          items: [],
          totalItems: 0,
          totalPages: 0,
          hasNext: false,
        });
      },
    );
    const visit = async (path) => {
      await p.goto(base + "/?demo=0#" + path);
      await p.locator("h1, h2").first().waitFor();
    };
    const signedOut = async () => {
      await p.evaluate(() => {
        localStorage.setItem("eatwhat-session", "null");
      });
      await p.reload();
    };
    const session = () =>
      p.evaluate(() =>
        JSON.parse(localStorage.getItem("eatwhat-session") || "null"),
      );
    const clean = async () => {
      assert(
        !/跨站|跨境|撤回同步授权|重新确认授权/.test(
          await p.locator("body").innerText(),
        ),
        "Retired cross-site UI remains",
      );
      assert(
        (await p
          .locator(".ew-consent, .ew-policy-dialog, .mobile-account-consent")
          .count()) === 0,
        "Consent controls remain",
      );
      assert(
        !(await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        )),
        "Horizontal overflow",
      );
    };
    try {
      await visit("/auth");
      if (width < 1000) {
        await p.locator(".mobile-login-primary").click();
        await p.waitForURL(width < 600 ? /#\/auth\/password$/ : /#\/auth$/);
      }
      await p.locator('input[name="username"]').fill("Student10");
      await p.locator('input[name="password"]').fill("test-password");
      await clean();
      await p
        .locator("form")
        .getByRole("button", { name: "登录", exact: true })
        .click();
      await p.waitForFunction(
        () =>
          !!JSON.parse(localStorage.getItem("eatwhat-session") || "null")
            ?.tokenValue,
      );
      checks.push(
        `${width}px: password login works without policy requests or agreement`,
      );

      await signedOut();
      await visit("/auth/username-register");
      await p.waitForURL(/#\/auth\/register$/);
      await p.getByLabel("登录手机号", { exact: true }).waitFor();
      assert(await p.locator('input[name="confirm"]').count() === 0, "Obsolete username registration form remains");
      assert(!requests.some(request => request.path === "/api/auth/register"), "Obsolete registration endpoint was called");
      checks.push(
        `${width}px: old username registration bookmarks redirect to SMS registration`,
      );

      await signedOut();
      newUser = true;
      await visit("/auth/register");
      await p.getByLabel("登录手机号", { exact: true }).fill("13800000000");
      await p.getByRole("button", { name: "获取验证码", exact: true }).click();
      await p.getByRole("button", { name: /s 后重发/ }).waitFor();
      await p.getByLabel("登录验证码", { exact: true }).fill("123456");
      await p.getByRole("button", { name: "登录 / 注册", exact: true }).click();
      await p.waitForURL(/#\/settings\/username\?first=1$/);
      assert(!!(await session()), "Phone login did not establish session");
      newUser = false;
      checks.push(
        `${width}px: SMS request, countdown and new-user login remain functional`,
      );

      for (const path of [
        "/settings",
        "/settings/account",
        "/features",
        "/admin?tab=sync",
        "/admin?tab=policy",
      ]) {
        await visit(path);
        await clean();
        if (path.startsWith("/admin"))
          await p.getByRole("button", { name: "概览", exact: true }).waitFor();
      }
      await p.screenshot({
        path: `output/playwright/single-site-admin-${width}.png`,
        fullPage: true,
      });
      checks.push(
        `${width}px: settings, features and old admin tabs no longer expose cross-site features`,
      );

      for (const path of [
        "/auth/consent",
        "/auth/consent-offer",
        "/auth/withdraw-consent/",
      ]) {
        await visit(path);
        await p.waitForURL(/#\/settings\/account$/);
        await clean();
      }
      await p.screenshot({
        path: `output/playwright/single-site-account-${width}.png`,
        fullPage: true,
      });
      checks.push(
        `${width}px: signed-in obsolete bookmarks return to account settings`,
      );
      await signedOut();
      for (const path of [
        "/auth/consent",
        "/auth/consent-offer",
        "/auth/withdraw-consent",
      ]) {
        await visit(path);
        await p.waitForURL(width < 600 ? /#\/auth\/password$/ : /#\/auth$/);
        await clean();
      }
      legacy = true;
      await p.locator('input[name="username"]').fill("Student10");
      await p.locator('input[name="password"]').fill("test-password");
      await p
        .locator("form")
        .getByRole("button", { name: "登录", exact: true })
        .click();
      await p
        .getByText("账号暂时无法登录，请稍后重试或联系管理员检查账号状态。", {
          exact: true,
        })
        .waitFor();
      assert(!(await session()), "Legacy proof became a session");
      assert(
        p.url().endsWith(width < 600 ? "#/auth/password" : "#/auth"),
        "Legacy proof navigated to retired authorization flow",
      );
      await p.screenshot({
        path: `output/playwright/single-site-login-${width}.png`,
        fullPage: true,
      });
      checks.push(
        `${width}px: guest obsolete bookmarks and legacy proof fail safely without redirect loops`,
      );
      if (width >= 600) {
        legacy = false;
        await visit("/me");
        const dialog = p.locator(".ew-login-dialog");
        await dialog.waitFor();
        await clean();
        await dialog.locator('input[name="username"]').fill("Student10");
        await dialog.locator('input[name="password"]').fill("test-password");
        await dialog.getByRole("button", { name: "登录", exact: true }).click();
        await dialog.waitFor({ state: "detached" });
        assert(p.url().endsWith("#/me"), "Modal login lost its source page");
        checks.push(
          `${width}px: real desktop login dialog returns to the original page without consent`,
        );
      }
      const obsolete = requests.filter((r) => /\/consent|\/sync/.test(r.path));
      assert(obsolete.length === 0, JSON.stringify(obsolete));
      for (const request of requests.filter((r) =>
        ["/api/auth/register", "/api/auth/phone/login"].includes(r.path),
      )) {
        assert(
          !("crossBorderConsent" in request.body) &&
            !("consentPolicyVersion" in request.body),
          "Invented consent submitted",
        );
      }
    } catch (e) {
      await p.screenshot({
        path: `output/playwright/single-site-failure-${width}.png`,
        fullPage: true,
      });
      throw new Error(
        `${width}px: ${e.message}; ${p.url()}; errors ${errors.join("; ")}`,
      );
    } finally {
      await context.close();
    }
  }
  assert(errors.length === 0, errors.join("; "));
  return { checks, errors, realBackendRequests: 0 };
}
