async function validateProfileReturn(page) {
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
    signature: "认真吃饭",
    userName: "test",
    verified: true,
    banned: false,
    role: "user",
  };
  await context.addInitScript(() => {
    if (location.hostname === "127.0.0.1")
      localStorage.setItem(
        "eatwhat-session",
        JSON.stringify({
          tokenName: "x-session",
          tokenValue: "isolated-profile-return",
        }),
      );
  });
  await context.route(
    (u) => u.origin !== "http://127.0.0.1:5173",
    (r) => r.abort(),
  );
  await context.route(
    (u) => u.pathname.startsWith("/api/"),
    (r) => {
      const path = new URL(r.request().url()).pathname;
      if (path === "/api/user/updateInfo" && r.request().method() !== "GET")
        writes.push({ path, body: r.request().postDataJSON() });
      let data = [];
      if (path === "/api/user/info") data = user;
      else if (path === "/api/user/updateInfo") {
        user = { ...user, ...r.request().postDataJSON() };
        data = null;
      } else if (path === "/api/user/userInfo")
        data = {
          ...user,
          earnedLikes: 0,
          uploadedFoodsCount: 0,
          fansCount: 0,
          followingsCount: 0,
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
      else if (path === "/api/notification/unread/count") data = 0;
      else if (path.startsWith("/api/foods/"))
        data = { items: [], totalItems: 0, totalPages: 0, hasNext: false };
      return r.fulfill({ status: 200, json: { code: 0, data } });
    },
  );
  const base = "http://127.0.0.1:5173/?demo=0#";
  const assert = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  const path = () => p.evaluate(() => location.hash.slice(1));
  const enter = async (origin, desktop = false) => {
    await p.goto(base + origin);
    const link = origin.startsWith("/settings/account")
      ? p.locator(
          desktop
            ? ".pc-secondary-identity a"
            : '.mobile-account-row[href="#/me/edit"]',
        )
      : origin.startsWith("/settings")
        ? p.locator(
            desktop ? ".settings-home-edit" : ".mobile-settings-profile",
          )
        : p.getByRole("link", { name: "编辑资料", exact: true });
    await link.click();
    await p.locator("#nick").waitFor();
    assert(
      (await p.evaluate(() => history.state.usr?.returnTo)) === origin,
      "Entry source missing: " + origin,
    );
  };
  try {
    for (const width of [320, 390, 520]) {
      await p.setViewportSize({ width, height: 844 });
      for (const origin of ["/settings", "/settings/account", "/me"]) {
        const previousWrites = writes.length;
        await enter(origin);
        await p.locator("#nick").fill("取消的草稿");
        assert(
          (await p
            .getByRole("link", { name: "取消", exact: true })
            .getAttribute("href")) ===
            "#" + origin,
          "Cancel link points elsewhere",
        );
        await p.getByRole("link", { name: "取消", exact: true }).click();
        assert((await path()) === origin, "Cancel lost origin: " + origin);
        assert(writes.length === previousWrites, "Cancel submitted changes");
        await enter(origin);
        assert(
          (await p.locator("#nick").inputValue()) === user.displayName,
          "Cancelled draft leaked into editor",
        );
        await p.locator("#nick").fill("保存的昵称");
        await p.getByRole("link", { name: "保存", exact: true }).click();
        await p.waitForURL(base + origin);
        assert(
          user.displayName === "保存的昵称" &&
            writes.length === previousWrites + 1,
          "Save did not persist exactly once",
        );
        checks.push(
          `${width}px ${origin}: cancel returns without writes, cancelled draft clears, save returns after update`,
        );
      }
    }
    await p.setViewportSize({ width: 390, height: 844 });
    await enter("/settings?from=me");
    await p.reload();
    await p.locator("#nick").waitFor();
    await p.getByRole("link", { name: "取消", exact: true }).click();
    assert(
      (await path()) === "/settings?from=me",
      "Refresh lost source or query",
    );
    await enter("/settings/account");
    await p.locator("#nick").fill("嵌套页面草稿");
    await p
      .getByRole("link", { name: "性别、生日和家乡", exact: true })
      .click();
    await p.getByRole("heading", { name: "更多资料", exact: true }).waitFor();
    await p.reload();
    await p.getByRole("link", { name: "返回", exact: true }).click();
    await p.locator("#nick").waitFor();
    assert(
      (await p.locator("#nick").inputValue()) === "嵌套页面草稿",
      "Details erased draft",
    );
    await p.getByRole("link", { name: "取消", exact: true }).click();
    assert(
      (await path()) === "/settings/account",
      "Details round trip lost source",
    );
    checks.push(
      "Source/query survives refresh and more-details round trip; draft survives internal navigation",
    );
    await p.goto("about:blank");
    await p.goto(base + "/me/edit");
    await p.locator("#nick").waitFor();
    await p.getByRole("link", { name: "取消", exact: true }).click();
    assert((await path()) === "/me", "Direct editor has no safe fallback");
    checks.push("Direct editor visit falls back to personal center");
    await p.setViewportSize({ width: 1280, height: 900 });
    for (const origin of ["/settings", "/settings/account"]) {
      await enter(origin, true);
      await p.reload();
      await p.getByRole("button", { name: "返回设置", exact: true }).click();
      assert((await path()) === origin, "Desktop return lost origin");
      await enter(origin, true);
      await p.locator("#nick").fill("未保存的昵称");
      await p.getByRole("button", { name: "返回设置", exact: true }).click();
      await p
        .getByRole("dialog", { name: "还有修改未保存", exact: true })
        .waitFor();
      await p.getByRole("button", { name: "继续编辑", exact: true }).click();
      await p.getByRole("dialog").waitFor({ state: "detached" });
      assert((await path()) === "/me/edit", "Continue editing navigated");
      await p.getByRole("button", { name: "返回设置", exact: true }).click();
      await p
        .getByRole("button", { name: "放弃修改并离开", exact: true })
        .click();
      assert((await path()) === origin, "Discard lost original destination");
      checks.push(
        `Desktop ${origin}: source survives refresh and unsaved-change confirmation`,
      );
    }
    assert(!errors.length, errors.join("\n"));
    return {
      checks,
      errors,
      mockedSaves: writes.length,
      realBackendRequests: 0,
    };
  } catch (error) {
    await p.screenshot({
      path: "output/playwright/profile-return-failure.png",
      fullPage: true,
    });
    throw new Error(
      JSON.stringify({
        error: String(error),
        checks,
        errors,
        url: p.url(),
        text: (await p.locator("body").innerText()).slice(0, 1300),
      }),
    );
  } finally {
    await context.close();
  }
}
