async (page) => {
  const context = await page
      .context()
      .browser()
      .newContext({ viewport: { width: 1440, height: 1000 } }),
    p = await context.newPage(),
    errors = [],
    remote = [],
    checks = [],
    issues = [];
  p.setDefaultTimeout(8000);
  p.on("pageerror", (e) => errors.push(e.message));
  await context.route(
    (u) => u.hostname !== "127.0.0.1" || u.pathname.startsWith("/api/"),
    (r) => {
      remote.push(r.request().url());
      return r.abort();
    },
  );
  await context.addInitScript(() => (window.__v2calls = []));
  await context.route("**/src/demo/transport.ts*", async (r) => {
    const response = await r.fetch(),
      original = await response.text();
    const body = original.replace(
      "if (options.signal?.aborted)",
      'window.__v2calls.push({path,method:options.method || "GET"}); if (path === "/admin/consent/policy" && options.method === "PUT" && window.__forcePolicyConflict) { window.__forcePolicyConflict=false; throw new ApiError("政策配置已变更，请重新读取后比较。", "REVISION_CONFLICT", 409); } if (options.signal?.aborted)',
    );
    await r.fulfill({ response, body });
  });
  const root = "http://127.0.0.1:5173/?demo=1&persona=admin";
  try {
    await p.goto(root + "#/admin");
    await p.getByRole("button", { name: "授权政策", exact: true }).click();
    await p.getByLabel("政策版本", { exact: true }).fill("demo-policy-v2");
    await p
      .getByLabel("完整政策正文地址", { exact: true })
      .fill("/api/policies/demo-policy-v2.html");
    await p.evaluate(() => (window.__forcePolicyConflict = true));
    await p.getByRole("button", { name: "保存政策配置", exact: true }).click();
    await p
      .getByText("政策配置已变更，请重新读取后比较。", { exact: true })
      .waitFor();
    if (
      (await p.getByLabel("政策版本", { exact: true }).inputValue()) !==
      "demo-policy-v2"
    )
      throw new Error("policy draft lost");
    if (
      (await p.evaluate(
        () =>
          window.__v2calls.filter(
            (c) => c.path === "/admin/consent/policy" && c.method === "PUT",
          ).length,
      )) !== 1
    )
      throw new Error("policy auto-retried");
    await p
      .getByRole("button", { name: "重新读取并比较", exact: true })
      .click();
    await p
      .getByText("已读取最新配置，输入已保留。请展开服务端配置核对后再保存。", {
        exact: true,
      })
      .waitFor();
    await p.getByRole("button", { name: "保存政策配置", exact: true }).click();
    await p.getByText("政策配置已保存。", { exact: true }).waitFor();
    checks.push("政策管理：409保留草稿、无自动重试、重新读取比较后可保存");
    await p.getByRole("button", { name: "账号安全复核", exact: true }).click();
    await p.getByRole("button", { name: "驳回事件", exact: true }).click();
    await p
      .getByRole("dialog")
      .getByRole("button", { name: "确认驳回", exact: true })
      .click();
    await p
      .getByRole("heading", { name: "没有待复核的账号事件", exact: true })
      .waitFor();
    checks.push("账号安全复核：按事件UUID确认驳回");
    await p.getByRole("button", { name: "用户管理", exact: true }).click();
    await p
      .getByRole("button", { name: "重置密码冲突", exact: true })
      .first()
      .click();
    const dialog = p.getByRole("dialog");
    await dialog.getByLabel("新密码", { exact: true }).fill("reset-test-123");
    await dialog
      .getByLabel("确认新密码", { exact: true })
      .fill("reset-test-123");
    await dialog.getByRole("checkbox").check();
    await dialog
      .getByRole("button", { name: "确认重置密码冲突", exact: true })
      .click();
    await dialog.waitFor({ state: "detached" });
    if (
      !(await p.evaluate(() =>
        window.__v2calls.some(
          (c) =>
            c.path ===
            "/auth/security/account-reviews/password-conflicts/10/reset",
        ),
      ))
    )
      throw new Error("reset did not use numeric user ID");
    checks.push("用户管理：数字用户编号重置密码冲突");
    await p.getByRole("button", { name: "跨站同步", exact: true }).click();
    await p.getByRole("button", { name: "资料冲突", exact: true }).click();
    await p.locator(".sync-record").first().click();
    await p
      .getByText(
        "新版候选内容可在上方查看。当前读取和裁决协议尚未统一，暂不能提交资料裁决；待后端协议统一后开放。",
        { exact: true },
      )
      .waitFor();
    if (await p.locator(".sync-editor form").count())
      throw new Error("unsafe profile resolution form visible");
    checks.push("新版资料候选可读，缺少统一裁决契约时无提交表单");
    await p.screenshot({
      path: "output/playwright/api-v2-admin-profile-protected.png",
    });
    const routes = [
      "/",
      "/nearby",
      "/me",
      "/me/edit",
      "/users/21",
      "/history",
      "/settings/account",
      "/settings/privacy",
      "/settings/blocked",
      "/settings/username",
      "/settings/bind-phone",
      "/settings/password",
      "/auth/register",
      "/auth/forgot",
      "/auth/password-conflict/reset",
      "/search",
      "/foods/1",
      "/publish/dish",
    ];
    await p.emulateMedia({ reducedMotion: "reduce" });
    let count = 0;
    for (const [width, height] of [
      [320, 720],
      [390, 844],
      [600, 960],
      [820, 1180],
      [1024, 768],
      [1440, 1000],
    ]) {
      await p.setViewportSize({ width, height });
      for (const route of routes) {
        await p.goto(root + "#" + route);
        await p
          .locator(
            ".pc-app,.ew-mobile-feature,.mobile-viewport,.mobile-page-native",
          )
          .first()
          .waitFor();
        await p
          .waitForFunction(
            () =>
              !document.querySelector(
                '[aria-label="正在加载内容"],[aria-label="正在加载页面"],.mobile-status,.pc-status',
              ) || !/正在/.test(document.body.innerText),
            { timeout: 2500 },
          )
          .catch(() => {});
        await p.evaluate(() => document.fonts.ready);
        const measure = await p.evaluate(() => ({
          width: innerWidth,
          scroll: document.documentElement.scrollWidth,
          fatal: !!document.querySelector(".fatal-error"),
          tiny: [
            ...document.querySelectorAll(
              "main input:not([type=checkbox]):not([type=file]):not([type=hidden]),.ew-mobile-feature input:not([type=checkbox]):not([type=file]):not([type=hidden])",
            ),
          ]
            .filter(
              (e) =>
                e.checkVisibility() && e.getBoundingClientRect().width < 70,
            )
            .map((e) => e.outerHTML.slice(0, 160)),
        }));
        if (measure.scroll > width + 1 || measure.fatal || measure.tiny.length)
          issues.push({ route, width, ...measure });
        count++;
        if (
          [390, 820, 1440].includes(width) &&
          ["/users/21", "/settings/privacy", "/settings/username"].includes(
            route,
          )
        )
          await p.screenshot({
            path: `output/playwright/api-v2-${width}-${route.replace(/\W+/g, "-")}.png`,
            fullPage: true,
          });
      }
    }
    return {
      checks,
      responsiveChecks: count,
      issues,
      errors,
      remoteRequests: remote.length,
    };
  } catch (error) {
    await p.screenshot({ path: "output/playwright/api-v2-admin-failure.png" });
    return {
      checks,
      issues,
      errors,
      failure: String(error),
      url: p.url(),
      text: (await p.locator("body").innerText()).slice(-2500),
      remoteRequests: remote.length,
    };
  } finally {
    await context.close();
  }
}
