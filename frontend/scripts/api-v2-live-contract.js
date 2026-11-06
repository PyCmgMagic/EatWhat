async (page) => {
  const context = await page
      .context()
      .browser()
      .newContext({ viewport: { width: 1440, height: 1000 } }),
    p = await context.newPage(),
    checks = [],
    errors = [],
    outside = [],
    requests = [];
  p.setDefaultTimeout(8000);
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("request", (r) => requests.push(r.url()));
  await context.addInitScript(() => {
    if (location.hostname !== "127.0.0.1") return;
    if (!sessionStorage.getItem("v2-test-logged-out"))
      sessionStorage.setItem(
        "eatwhat-session",
        JSON.stringify({ tokenName: "x-session", tokenValue: "isolated-test" }),
      );
  });
  let version = "test-policy-v1",
    documentAvailable = true,
    featureAvailable = false;
  const reply = (r, data, status = 200) =>
    r.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(
        status === 200
          ? { code: 0, data }
          : { code: status, msg: "当前站点未部署" },
      ),
    });
  await context.route(
    (u) => u.hostname !== "127.0.0.1",
    (r) => {
      outside.push(r.request().url());
      return r.abort();
    },
  );
  await context.route(
    (u) => u.pathname.startsWith("/api/"),
    async (r) => {
      const url = new URL(r.request().url()),
        path = url.pathname;
      if (path === "/api/user/info")
        return reply(r, {
          id: 10,
          displayName: "接口测试食友",
          userName: null,
          hasUsername: false,
          hasPassword: false,
          role: "user",
          verified: true,
          banned: false,
          phone: "13800000000",
        });
      if (path === "/api/notification/unread/count") return reply(r, 0);
      if (path === "/api/auth/consent/policy")
        return reply(r, { version, url: `/api/policies/${version}.html` });
      if (path.startsWith("/api/policies/"))
        return r.fulfill({
          status: documentAvailable ? 200 : 503,
          contentType: "text/html",
          body: documentAvailable
            ? `<!doctype html><main><h1>授权政策 ${version}</h1><p>用于测试当前版本政策正文，不产生真实授权。</p></main>`
            : "不可用",
        });
      if (path === "/api/user/blocks")
        return featureAvailable
          ? reply(r, {
              items: [],
              currentPage: 1,
              hasNext: false,
              totalPages: 0,
              totalItems: 0,
            })
          : reply(r, null, 404);
      if (path === "/api/user/recommendation-settings")
        return reply(r, { personalized: false });
      if (path === "/api/user/userInfo")
        return reply(r, {
          displayName: "接口测试食友",
          fansVisible: true,
          followingsVisible: true,
        });
      if (path === "/api/auth/password-conflict/reset") {
        if (r.request().headers()["x-session"])
          throw new Error("public reset forwarded session");
        return reply(r, null, 501);
      }
      return reply(r, []);
    },
  );
  const root = "http://127.0.0.1:5173/?demo=0&view=desktop#";
  try {
    await p.goto(root + "/settings/blocked");
    await p
      .getByText("当前站点暂未开放这项功能，请稍后重试。", { exact: true })
      .waitFor();
    if (
      await p
        .getByRole("heading", { name: "目前没有屏蔽的食友", exact: true })
        .count()
    )
      throw new Error("404 rendered fake empty success");
    featureAvailable = true;
    await p.getByRole("button", { name: "重新加载", exact: true }).click();
    await p
      .getByRole("heading", { name: "目前没有屏蔽的食友", exact: true })
      .waitFor();
    checks.push("真实模式：404明确不可用，重试后读取真实返回，不回退Mock");
    await p.evaluate(() => {
      sessionStorage.removeItem("eatwhat-session");
      sessionStorage.setItem("v2-test-logged-out", "true");
    });
    await p.goto("about:blank");
    await p.goto(root + "/auth/password");
    const choice = p.getByRole("checkbox", {
      name: "我已阅读并同意跨站同步授权政策",
    });
    await choice.waitFor();
    await choice.check();
    await p
      .getByRole("button", { name: "《跨站同步授权政策》", exact: true })
      .click();
    await p.getByRole("article", { name: "完整跨站同步授权政策" }).waitFor();
    await p.getByRole("button", { name: "关闭政策", exact: true }).click();
    version = "test-policy-v2";
    await p.locator("input[name=username]").fill("student_1");
    await p.locator("input[name=password]").fill("password1");
    await p.getByRole("button", { name: "登录", exact: true }).click();
    await p
      .getByText("政策版本已更新，请重新阅读并勾选同意。", { exact: true })
      .waitFor();
    if (await choice.isChecked())
      throw new Error("new policy remained accepted");
    checks.push("仅version/url时正文可读，提交时版本变化强制重新勾选");
    documentAvailable = false;
    version = "test-policy-v3";
    await p.reload();
    await p
      .getByText("政策正文加载失败（HTTP 503），请重试。", { exact: false })
      .waitFor();
    if (await choice.isEnabled())
      throw new Error("failed document allowed agreement");
    checks.push("政策正文加载失败时保留重试入口并禁止同意");
    await p.goto(root + "/auth/password-conflict/reset");
    await p.getByLabel("恢复令牌", { exact: true }).fill("test-token");
    await p.getByLabel("新密码", { exact: true }).fill("password1");
    await p.getByLabel("确认新密码", { exact: true }).fill("password1");
    await p.getByRole("button", { name: "重置密码", exact: true }).click();
    await p
      .getByText("当前站点暂未开放这项功能，请稍后重试。", { exact: true })
      .waitFor();
    checks.push("恢复接口501无成功假象；公开恢复请求不带旧会话");
    if (requests.some((u) => u.includes("/src/demo/transport")))
      throw new Error("live imported Mock");
    if (outside.length) throw new Error("unexpected live network access");
    return { checks, errors, outsideRequests: outside.length };
  } catch (error) {
    return {
      checks,
      errors,
      failure: String(error),
      url: p.url(),
      text: (await p.locator("body").innerText()).slice(-2000),
    };
  } finally {
    await context.close();
  }
}
