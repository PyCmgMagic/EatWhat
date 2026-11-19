async function validateAdminWorkspace(page) {
  const base = new URL(page.url()).origin;
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))
    throw new Error("Local preview required.");
  const checks = [],
    screenshots = [],
    errors = [],
    backendRequests = [];
  const assert = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  const modules = [
    ["/admin", "数据概览"],
    ["/admin/engagement", "活跃统计"],
    ["/admin/foods", "菜品管理"],
    ["/admin/restaurants", "餐厅管理"],
    ["/admin/tags", "公共标签"],
    ["/admin/hubs", "区域管理"],
    ["/admin/topics", "校园专题"],
    ["/admin/moderation", "内容审核"],
    ["/admin/comments", "评论审核"],
    ["/admin/feedback", "反馈举报"],
    ["/admin/users", "用户管理"],
    ["/admin/security", "账号安全复核"],
    ["/admin/announcements", "公告管理"],
    ["/admin/config", "远程配置"],
    ["/admin/versions", "版本管理"],
    ["/admin/audit", "配置审计"],
  ];
  const settle = (p) =>
    p.waitForFunction(
      () => !document.querySelector('.admin-content [aria-busy="true"]'),
    );
  for (const width of [360, 390, 768, 1280, 1440]) {
    const c = await page
      .context()
      .browser()
      .newContext({
        viewport: { width, height: 960 },
        reducedMotion: "reduce",
      });
    const p = await c.newPage(),
      mobile = width <= 760;
    p.setDefaultTimeout(10000);
    p.on("pageerror", (e) => errors.push(e.message));
    await c.route("**/*", (route) => {
      const u = new URL(route.request().url());
      if (u.origin !== base) return route.abort();
      if (u.pathname.startsWith("/api/")) {
        backendRequests.push(u.pathname);
        return route.abort();
      }
      return route.continue();
    });
    const address = (path) =>
      `${base}/?demo=1&persona=admin&view=${width < 600 ? "mobile" : "desktop"}#${path}`;
    await p.goto(
      address(mobile && width < 600 ? "/me" : "/foods/1?section=comments"),
    );
    const frontSwitch =
      mobile && width < 600
        ? p.getByRole("link", { name: "切换到管理后台", exact: true })
        : p
            .locator(".pc-header-actions")
            .getByRole("link", { name: "切换到管理后台", exact: true });
    await frontSwitch.waitFor();
    if (mobile && width < 600)
      await frontSwitch.getByText("管理后台", { exact: true }).waitFor();
    const original = await p.evaluate(() => location.hash),
      session = await p.evaluate(() =>
        localStorage.getItem("eatwhat-demo-session"),
      );
    await frontSwitch.click();
    await p.getByRole("heading", { name: "数据概览", exact: true }).waitFor();
    await settle(p);
    assert(
      (await p
        .locator(".pc-header,.pc-footer,.mobile-main-navigation")
        .count()) === 0,
      `Frontend chrome leaked into backend at ${width}`,
    );
    assert(
      (await p.locator(".admin-sidebar nav a").count()) === 16,
      "Missing unified admin modules",
    );
    assert(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `Overview overflow at ${width}`,
    );
    await p.evaluate(() => document.fonts.ready);
    const shot = `output/playwright/admin-standalone-overview-${width}.png`;
    await p.screenshot({ path: shot, fullPage: mobile });
    screenshots.push(shot);
    checks.push(`${width}px independent shell and role-only frontend entry`);

    if (mobile) {
      await p
        .getByRole("button", { name: "打开管理菜单", exact: true })
        .click();
      await p
        .getByRole("navigation", { name: "管理模块", exact: true })
        .getByRole("link", { name: "评论审核", exact: true })
        .click();
    } else
      await p
        .getByRole("navigation", { name: "管理模块", exact: true })
        .getByRole("link", { name: "评论审核", exact: true })
        .click();
    await p.getByRole("heading", { name: "评论审核", exact: true }).waitFor();
    await settle(p);
    assert(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `Comments overflow at ${width}`,
    );
    await p.getByRole("link", { name: "切换到前台", exact: true }).click();
    await p.waitForFunction((hash) => location.hash === hash, original);
    assert(
      (await p.locator(".admin-app").count()) === 0,
      "Admin shell stayed mounted on frontend",
    );
    await frontSwitch.click();
    await p.getByRole("heading", { name: "评论审核", exact: true }).waitFor();
    await settle(p);
    assert(
      (await p.evaluate(() => localStorage.getItem("eatwhat-demo-session"))) ===
        session,
      "Workspace switch changed login",
    );
    checks.push(
      `${width}px round-trip preserves frontend location, backend module and session`,
    );
    const commentsShot = `output/playwright/admin-standalone-comments-${width}.png`;
    await p.screenshot({ path: commentsShot, fullPage: mobile });
    screenshots.push(commentsShot);

    if (width === 390) {
      await p
        .getByRole("button", { name: "打开管理菜单", exact: true })
        .click();
      await p.keyboard.press("Escape");
      assert(
        (await p
          .getByRole("button", { name: "打开管理菜单", exact: true })
          .getAttribute("aria-expanded")) === "false",
        "Escape did not close drawer",
      );
      await p
        .getByRole("button", { name: "打开管理菜单", exact: true })
        .click();
      await p.setViewportSize({ width: 900, height: 960 });
      await p.waitForFunction(
        () => !document.querySelector(".admin-workspace").inert,
      );
      await p.setViewportSize({ width, height: 960 });
      checks.push("mobile drawer navigation, Escape focus and resize recovery");
    }
    if (width === 1440) {
      for (const [path, title] of modules) {
        await p.goto(address(path));
        await p.getByRole("heading", { name: title, exact: true }).waitFor();
        await settle(p);
        const alerts = await p
          .locator('.admin-content [role="alert"]')
          .allTextContents();
        assert(!alerts.length, `${path}: ${alerts.join("; ")}`);
        assert(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          `${path}: horizontal overflow`,
        );
      }
      checks.push("all 16 management modules render without errors");
      await p.goto(address("/admin?tab=restaurants&keyword=云"));
      await p.waitForFunction(() =>
        location.hash.startsWith("#/admin/restaurants?keyword="),
      );
      const search = p.getByRole("textbox", {
        name: "管理员查找餐厅",
        exact: true,
      });
      await search.fill("云饺");
      await search.press("Enter");
      await settle(p);
      await p.getByRole("link", { name: "切换到前台", exact: true }).click();
      await frontSwitch.waitFor();
      await frontSwitch.click();
      assert(
        (await search.inputValue()) === "云饺",
        "Admin list filter lost after switching",
      );
      await p.goto(address("/admin/v4?tab=topics"));
      await p.getByRole("heading", { name: "校园专题", exact: true }).waitFor();
      await settle(p);
      assert(
        await p.evaluate(() => location.hash === "#/admin/topics"),
        "Legacy operations route was not migrated",
      );
      const name = p.getByRole("textbox", { name: "专题名称", exact: true });
      await name.fill("后台切换保留的草稿");
      await p.getByRole("link", { name: "切换到前台", exact: true }).click();
      await frontSwitch.waitFor();
      await frontSwitch.click();
      assert(
        (await name.inputValue()) === "后台切换保留的草稿",
        "Topic draft lost after switching",
      );
      checks.push(
        "legacy links, list filters and campus-scoped topic draft preserved",
      );
      await p.screenshot({
        path: "output/playwright/admin-standalone-topics-1440.png",
      });
      screenshots.push("output/playwright/admin-standalone-topics-1440.png");
    }
    await c.close();
  }
  for (const persona of ["user", "guest"]) {
    const c = await page
      .context()
      .browser()
      .newContext({ viewport: { width: 1280, height: 900 } });
    const p = await c.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    await c.route("**/*", (route) =>
      new URL(route.request().url()).origin === base
        ? route.continue()
        : route.abort(),
    );
    if (persona === "guest")
      await c.addInitScript(() =>
        localStorage.setItem("eatwhat-demo-session", "null"),
      );
    await p.goto(`${base}/?demo=1&view=desktop#/admin/comments`);
    await p
      .getByRole("heading", {
        name: persona === "guest" ? "登录管理后台" : "需要管理员身份",
        exact: true,
      })
      .waitFor();
    assert(
      (await p.locator(".admin-sidebar").count()) === 0,
      "Unauthorized user saw admin navigation",
    );
    assert(
      (await p.locator(".workspace-switch").count()) === 0,
      "Unauthorized user saw workspace switch",
    );
    await c.close();
  }
  checks.push("guest login and regular-user backend access denial");
  assert(!errors.length, errors.join("; "));
  assert(!backendRequests.length, backendRequests.join("; "));
  return {
    checks,
    screenshots,
    browserErrors: errors,
    realBackendRequests: backendRequests.length,
  };
}
