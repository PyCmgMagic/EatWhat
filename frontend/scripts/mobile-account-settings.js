async function validateAccountSettings(page) {
  const origin = new URL(page.url()).origin;
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))
    throw new Error("请在本地开发页面运行");
  const context = await page
    .context()
    .browser()
    .newContext({ viewport: { width: 390, height: 844 } });
  const p = await context.newPage(),
    errors = [],
    writes = [],
    checks = [];
  p.setDefaultTimeout(10000);
  await p.emulateMedia({ reducedMotion: "reduce" });
  p.on("pageerror", (e) => errors.push(e.message));
  let user = {
    id: 10,
    displayName: "PyCmg",
    userName: "",
    hasUsername: false,
    hasPassword: true,
    phone: "18712344033",
    verified: false,
    banned: false,
    role: "user",
  };
  await context.addInitScript(() => {
    if (location.hostname === "127.0.0.1")
      localStorage.setItem(
        "eatwhat-session",
        JSON.stringify({
          tokenName: "x-session",
          tokenValue: "isolated-account-style-test",
        }),
      );
  });
  await context.route(
    (u) => u.origin !== origin,
    (r) => r.abort(),
  );
  await context.route(
    (u) => u.pathname.startsWith("/api/"),
    (r) => {
      const path = new URL(r.request().url()).pathname;
      if (
        r.request().method() !== "GET" &&
        !["/api/device/register", "/api/user/activity"].includes(path)
      )
        writes.push(path);
      let data = [];
      if (path === "/api/user/info") data = user;
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
      else if (path === "/api/auth/consent")
        data = {
          status: "ACTIVE",
          identityReady: true,
          policyVersion: "qa-v1",
        };
      else if (path === "/api/auth/consent/policy")
        data = { version: "qa-v1", url: "/api/qa-policy" };
      else if (path === "/api/qa-policy")
        return r.fulfill({
          status: 200,
          contentType: "text/html",
          body: "<p>测试授权政策 qa-v1</p>",
        });
      return r.fulfill({ status: 200, json: { code: 0, data } });
    },
  );
  const base = origin + "/?demo=0#/settings/account";
  const assert = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  const targets = [
    "/verify",
    "/settings/username",
    "/settings/phone",
    "/settings/password",
    "/settings/devices",
    "/settings/delete",
  ];
  const checkLayout = async (width) => {
    const layout = await p
      .locator(".mobile-account-settings")
      .evaluate((el) => {
        const rect = el.getBoundingClientRect(),
          heading = el.querySelector("h1");
        const rows = [...el.querySelectorAll(".mobile-account-row")];
        return {
          width: rect.width,
          x: rect.x,
          bg: getComputedStyle(el).backgroundColor,
          title: getComputedStyle(heading).fontSize,
          rows: rows.every(
            (row) =>
              row.getBoundingClientRect().height >= 55 &&
              row.scrollWidth <= row.clientWidth + 1,
          ),
          labels: rows.every(
            (row) =>
              getComputedStyle(row.querySelector(".mobile-account-label"))
                .fontSize === "16px",
          ),
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
        };
      });
    assert(
      layout.width === width &&
        layout.x === 0 &&
        layout.bg === "rgb(255, 255, 255)" &&
        parseFloat(layout.title) >= 24 &&
        layout.rows &&
        layout.labels &&
        !layout.overflow,
      JSON.stringify(layout),
    );
  };
  try {
    for (const width of [320, 390, 440, 520]) {
      await p.setViewportSize({ width, height: 844 });
      await p.goto(base);
      await p
        .getByRole("link", { name: "学生认证 去认证", exact: true })
        .waitFor();
      await p.evaluate(() => document.fonts.ready);
      await checkLayout(width);
      assert(
        (await p.locator(".mobile-account-row").count()) === targets.length,
        "Account settings contains unrelated or duplicate rows",
      );
      for (const target of targets)
        assert(
          (await p
            .locator(`.mobile-account-row[href="#${target}"]`)
            .count()) === 1,
          "Missing action " + target,
        );
      assert(
        (await p
          .getByRole("link", { name: "手机号 187 **** 4033", exact: true })
          .count()) === 1,
        "Phone not masked",
      );
      assert(
        (await p
          .locator(".mobile-account-settings .pc-secondary-section")
          .count()) === 0,
        "Desktop card leaked into mobile",
      );
      const nav = p.getByRole("navigation", { name: "主导航", exact: true });
      assert((await nav.count()) === 1, "Duplicate navigation");
      assert(
        (await nav
          .getByRole("link", { name: "我的", exact: true })
          .getAttribute("aria-current")) === "page",
        "Lost profile navigation state",
      );
      if (width === 390 || width === 440)
        await p.screenshot({
          path: `output/playwright/account-settings-${width}.png`,
        });
      const last = p.getByRole("link", {
        name: "注销账号",
        exact: true,
      });
      await p.evaluate(() =>
        window.scrollTo(0, document.documentElement.scrollHeight),
      );
      assert(
        await last.evaluate((el) => {
          const r = el.getBoundingClientRect();
          const hit = document.elementFromPoint(
            r.x + r.width / 2,
            r.y + r.height / 2,
          );
          return hit === el || el.contains(hit);
        }),
        "Navigation covers the last action",
      );
      assert(
        (await p.getByRole("button", { name: "跨站授权与同步" }).count()) === 0,
        "Retired authorization entry remains",
      );
      await p.getByRole("link", { name: "返回设置", exact: true }).click();
      await p.getByRole("heading", { name: "设置", exact: true }).waitFor();
      await p.getByRole("link", { name: "账号与安全", exact: true }).click();
      await p
        .getByRole("heading", { name: "账号与安全", exact: true })
        .waitFor();
      checks.push(
        `${width}px: six account actions, masked phone, back navigation, no unrelated entries or horizontal overflow`,
      );
    }
    user = {
      ...user,
      displayName: "这是一段很长很长的昵称测试",
      userName: "very_long_username_for_mobile_layout_123456",
      hasUsername: true,
      hasPassword: false,
      phone: "",
      verified: true,
    };
    await p.setViewportSize({ width: 320, height: 700 });
    await p.goto(base);
    await p.reload();
    await p
      .getByRole("link", { name: "学生认证 已认证", exact: true })
      .waitFor();
    await checkLayout(320);
    assert(
      (await p
        .getByRole("link", { name: "手机号 去绑定", exact: true })
        .getAttribute("href")) === "#/settings/bind-phone",
      "Missing bind-phone branch",
    );
    assert(
      (await p.getByRole("link", { name: "设置密码", exact: true }).count()) ===
        1,
      "Wrong password state",
    );
    assert(
      (await p
        .locator('.mobile-account-row[href="#/settings/username"]')
        .count()) === 0,
      "Existing username still editable",
    );
    checks.push(
      "Long account values wrap; verified, unbound phone and unset password states use real account fields",
    );
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto(origin + "/?demo=0#/settings/privacy");
    await p.getByRole("link", { name: "使用统计授权", exact: true }).waitFor();
    assert(
      (await p
        .getByRole("link", { name: "使用统计授权", exact: true })
        .getAttribute("href")) === "#/settings/telemetry",
      "Statistics authorization is missing from privacy settings",
    );
    await p.goto(origin + "/?demo=0#/settings/about");
    const about = p.getByRole("navigation", { name: "关于栏目" });
    await about.getByRole("link", { name: "开发团队", exact: true }).click();
    await p.getByRole("heading", { name: "开发团队", level: 1 }).waitFor();
    await p.getByRole("link", { name: "返回关于", exact: true }).click();
    await about.getByRole("link", { name: "关于我们", exact: true }).click();
    await p.getByRole("link", { name: "数据存放说明", exact: true }).click();
    await p
      .getByRole("heading", { name: "数据存放说明", exact: true })
      .waitFor();
    assert(
      (await p
        .getByRole("link", { name: "返回关于我们", exact: true })
        .getAttribute("href")) === "#/settings/about/us",
      "Data notice lost its About return destination",
    );
    checks.push(
      "Privacy retains statistics authorization; About retains the data notice and its return destination",
    );
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.goto(base);
    await p.locator(".pc-settings-account").waitFor();
    assert(
      (await p.locator(".mobile-account-settings").count()) === 0,
      "Mobile view replaced desktop",
    );
    assert(
      (await p.locator(".pc-settings-account .pc-secondary-row").count()) ===
        targets.length,
      "Desktop account settings still contains unrelated rows",
    );
    checks.push("Desktop account layout preserved");
    assert(
      errors.length === 0 && writes.length === 0,
      JSON.stringify({ errors, writes }),
    );
    return { checks, errors, writes, realBackendRequests: 0 };
  } catch (error) {
    await p.screenshot({
      path: "output/playwright/account-settings-failure.png",
      fullPage: true,
    });
    throw new Error(
      JSON.stringify({
        error: String(error),
        checks,
        errors,
        url: p.url(),
        text: (await p.locator("body").innerText()).slice(0, 1400),
      }),
    );
  } finally {
    await context.close();
  }
}
