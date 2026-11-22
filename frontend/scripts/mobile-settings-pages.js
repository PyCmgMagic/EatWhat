async function validateSettingsPages(page) {
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
  const user = {
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
  let privacy = { followingsVisible: true, fansVisible: true },
    personalized = true;
  let preferences = { likedTags: ["清淡"], dislikedTags: ["太甜"] };
  let telemetryEnabled = false;
  const notifications = [
    { category: "COMMENTS", enabled: true, revision: 1 },
    { category: "LIKES_AND_FAVORITES", enabled: false, revision: 2 },
  ];
  await context.addInitScript(() => {
    if (location.hostname === "127.0.0.1")
      localStorage.setItem(
        "eatwhat-session",
        JSON.stringify({
          tokenName: "x-session",
          tokenValue: "isolated-settings-test",
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
      const path = new URL(r.request().url()).pathname,
        method = r.request().method(),
        body = r.request().postDataJSON();
      if (method !== "GET") writes.push({ path, method, body });
      let data = [];
      if (path === "/api/user/info") data = user;
      else if (path === "/api/user/userInfo") data = { ...user, ...privacy };
      else if (path === "/api/user/changePrivacy") {
        privacy = {
          followingsVisible: body.following,
          fansVisible: body.follower,
        };
        data = null;
      } else if (path === "/api/user/recommendation-settings") {
        if (method === "PUT") personalized = body.personalized;
        data = { personalized };
      } else if (path === "/api/user/recommendation-profile/preferences") {
        if (method === "PUT") preferences = body;
        data = preferences;
      } else if (path === "/api/user/blocks")
        data = {
          items: [{ userId: 21, displayName: "测试食友" }],
          totalItems: 1,
          totalPages: 1,
          hasNext: false,
        };
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
      else if (path === "/api/auth/sessions")
        data = {
          devices: [
            {
              sessionId: "mock-session",
              device: "当前手机",
              current: true,
              lastSeenAt: "2026-11-07T12:00:00Z",
              expiresAt: "2026-12-07T12:00:00Z",
            },
          ],
        };
      else if (path === "/api/push/settings") data = notifications;
      else if (path === "/api/push/settings/disable") {
        const n = notifications.find((x) => x.category === body.category);
        n.enabled = false;
        n.revision++;
        data = { state: "APPLIED" };
      } else if (path === "/api/telemetry/consent") {
        if (method === "PUT") telemetryEnabled = true;
        if (method === "DELETE") telemetryEnabled = false;
        data = { enabled: telemetryEnabled, retentionDays: 30 };
      } else if (path === "/api/telemetry/events") data = { accepted: 1 };
      else if (path === "/api/auth/verify") data = ["EMAIL"];
      return r.fulfill({ status: 200, json: { code: 0, data } });
    },
  );
  const base = origin + "/?demo=0#";
  const paths = [
    "/settings/privacy",
    "/settings/password",
    "/settings/bind-phone",
    "/settings/username",
    "/settings/blocked",
    "/settings/devices",
    "/settings/phone",
    "/settings/delete",
    "/settings/preferences",
    "/verify",
    "/data-notice",
  ];
  const assert = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  const open = async (path) => {
    await p.goto(base + path);
    await p.locator(".mobile-settings-page").waitFor();
    await p.waitForLoadState("networkidle");
    await p.evaluate(() => document.fonts.ready);
  };
  try {
    for (const width of [390, 320, 440, 520]) {
      await p.setViewportSize({ width, height: 844 });
      await p.goto(base + "/settings/about");
      const about = p.getByRole("navigation", { name: "关于栏目" });
      await about.waitFor();
      assert(
        (await about.getByRole("link").allTextContents()).join("|") ===
          "反馈问题反馈与建议|我的反馈提交记录与处理结果|隐私政策|用户协议|开发团队|开源声明",
        "About links must follow the two reference groups",
      );
      await p.evaluate(() => document.fonts.ready);
      assert(
        await about.locator(".about-row-detail").evaluateAll((labels) =>
          labels.every((label) =>
            label.getBoundingClientRect().height <= parseFloat(getComputedStyle(label).lineHeight) + 1
          ),
        ),
        `About feedback descriptions wrap at ${width}px`,
      );
      if (width === 390) {
        await about.getByRole("link", { name: "开源声明" }).click();
        const react = p.locator("details").filter({ has: p.locator("summary", { hasText: /^react\s/ }) });
        await react.locator("summary").click();
        assert((await react.locator("pre").innerText()).includes("MIT"), "React license text is missing");
        await p.getByRole("link", { name: "返回关于" }).click();
        await about.getByRole("link", { name: "开发团队", exact: true }).waitFor();
      }
      for (const path of paths) {
        await open(path);
        const layout = await p.evaluate(() => {
          const page = document.querySelector(".mobile-settings-page"),
            h = page.querySelector(":scope > .settings-page-head h1"),
            rect = page.getBoundingClientRect();
          const controls = [
            ...page.querySelectorAll("input, textarea, select, button"),
          ].filter(
            (el) => el.getBoundingClientRect().width && !el.closest("[hidden]"),
          );
          return {
            x: rect.x,
            width: rect.width,
            title: getComputedStyle(h).fontSize,
            bg: getComputedStyle(page).backgroundColor,
            scroll: document.documentElement.scrollWidth,
            controls: controls
              .filter((el) => {
                const b = el.getBoundingClientRect();
                return b.left < -1 || b.right > innerWidth + 1;
              })
              .map((el) => el.outerHTML.slice(0, 180)),
          };
        });
        assert(
          layout.x === 0 &&
            layout.width === width &&
            layout.title === "28px" &&
            layout.bg === "rgb(255, 255, 255)" &&
            layout.scroll <= width + 1 &&
            !layout.controls.length,
          `${width}px ${path}: ${JSON.stringify(layout)}`,
        );
        assert(
          (await p.getByRole("heading", { level: 1 }).count()) === 1,
          "Duplicate page headings: " + path,
        );
        assert(
          await p
            .locator(".mobile-settings-page > .settings-page-head a.settings-page-back")
            .getAttribute("href")
            ?.then((h) => h?.startsWith("#/")),
          "Missing back target",
        );
        if (
          width === 390 &&
          [
            "/settings/privacy",
            "/settings/password",
            "/settings/phone",
          ].includes(path)
        )
          await p.screenshot({
            path: `output/playwright/settings-${path.split("/").pop()}-390.png`,
          });
        checks.push(
          `${width}px ${path}: consistent frame, title, back and control bounds`,
        );
      }
    }
    await p.setViewportSize({ width: 390, height: 844 });
    await open("/settings/privacy");
    const following = p.getByRole("switch", { name: /公开我的关注列表/ });
    await following.uncheck();
    await p.getByRole("button", { name: "保存可见性", exact: true }).click();
    await p.waitForFunction(() =>
      document.body.innerText.includes("隐私设置已保存"),
    );
    assert(
      !privacy.followingsVisible && privacy.fansVisible,
      "Visibility save changed the wrong preference",
    );
    await p.getByRole("switch", { name: "个性化推荐", exact: true }).uncheck();
    await p.waitForFunction(() =>
      document.body.innerText.includes("推荐设置已更新"),
    );
    assert(!personalized, "Personalization did not persist");
    await open("/settings/password");
    await p
      .locator('.password-settings-form input[name="old"]')
      .fill("mock-old-password");
    await p
      .locator('.password-settings-form input[name="password"]')
      .fill("mock-new-password");
    await p
      .locator('.password-settings-form input[name="confirm"]')
      .fill("mock-other-password");
    await p.getByRole("button", { name: "更新密码", exact: true }).click();
    await p.getByText("两次输入的新密码不一致。", { exact: true }).waitFor();
    assert(
      !writes.some((x) => x.path.includes("changePassword")),
      "Invalid password form submitted",
    );
    await p.goto(base + "/settings/notifications");
    await p.waitForURL("**#/settings");
    assert(
      !writes.some((x) => x.path.startsWith("/api/push/")),
      "Unreleased notifications sent a write",
    );
    await p.getByRole("link", { name: "个性化", exact: true }).click();
    await p.getByRole("link", { name: "口味偏好", exact: true }).click();
    await p
      .getByRole("group", { name: "喜欢的口味", exact: true })
      .getByText("甜", { exact: true })
      .click();
    await p.getByRole("button", { name: "保存口味偏好", exact: true }).click();
    await p.waitForFunction(() =>
      document.body.innerText.includes("口味偏好已更新"),
    );
    assert(preferences.likedTags.includes("甜") && preferences.likedTags.includes("清淡"), "Preferences did not save");
    await p.getByRole("link", { name: "返回个性化", exact: true }).click();
    await p.getByRole("heading", { name: "个性化", exact: true }).waitFor();
    await open("/settings/delete");
    assert(
      await p
        .getByRole("button", { name: "申请注销", exact: true })
        .isDisabled(),
      "Cancellation confirmation bypassed",
    );
    await open("/settings/telemetry");
    await p.waitForURL("**#/settings/privacy");
    const sharing = p.getByRole("switch", { name: "分享使用统计", exact: true });
    await sharing.waitFor();
    assert(!(await sharing.isChecked()), "Opening privacy settings enabled statistics");
    await sharing.press("Space");
    await p.getByText("使用统计已开启", { exact: true }).waitFor();
    await p.reload();
    assert(await sharing.isChecked(), "Statistics consent did not survive reload");
    await sharing.press("Space");
    const confirm = p.getByRole("dialog", { name: "关闭使用统计？" });
    await confirm.getByRole("button", { name: "取消", exact: true }).click();
    assert(telemetryEnabled && await sharing.isChecked(), "Cancel disabled statistics");
    await sharing.press("Space");
    await confirm.getByRole("button", { name: "关闭并删除统计" }).click();
    await p.getByText("使用统计已关闭", { exact: true }).waitFor();
    assert(!(await sharing.isChecked()), "Statistics still enabled after confirmation");
    await open("/verify?next=%2Ffoods%2F71");
    assert(
      (await p
        .getByRole("link", { name: "返回原页面", exact: true })
        .getAttribute("href")) === "#/foods/71",
      "Verification return target lost",
    );
    checks.push(
      "Mocked interactions: visibility/personalization/preferences save, retired notification route, password validation, cancellation gate, verification return",
    );
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.goto(base + "/settings/privacy");
    await p.getByRole("switch", { name: "公开我的关注列表", exact: true }).waitFor();
    assert(
      (await p.locator(".mobile-settings-page").count()) === 0,
      "Desktop layout replaced",
    );
    assert(errors.length === 0, errors.join("\n"));
    assert(
      JSON.stringify(writes.filter((write) => write.path !== "/api/device/register").map((write) => write.path)) ===
        JSON.stringify(["/api/user/changePrivacy", "/api/user/recommendation-settings", "/api/user/recommendation-profile/preferences", "/api/telemetry/consent", "/api/telemetry/events", "/api/telemetry/consent"]),
      "Unexpected API writes: " + JSON.stringify(writes),
    );
    return {
      checks: checks.length,
      details: checks,
      errors,
      mockedWrites: writes,
      realBackendRequests: 0,
    };
  } catch (error) {
    await p.screenshot({
      path: "output/playwright/settings-pages-failure.png",
      fullPage: true,
    });
    throw new Error(
      JSON.stringify({
        error: String(error),
        checks: checks.length,
        errors,
        url: p.url(),
        text: (await p.locator("body").innerText()).slice(0, 1400),
      }),
    );
  } finally {
    await context.close();
  }
}
