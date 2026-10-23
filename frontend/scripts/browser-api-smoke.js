async (page) => {
  const origin = "http://127.0.0.1:5173",
    calls = [],
    checks = [];
  let loginMode = "consent",
    favoriteMode = "empty",
    createCount = 0,
    storageToken = "";
  const ok = (data) => ({
    code: 0,
    msg: "success",
    data,
    timestamp: Date.now(),
  });
  await page.route(
    (url) => url.origin === origin && url.pathname.startsWith("/api/"),
    async (route) => {
      const request = route.request(),
        url = new URL(request.url()),
        path = url.pathname.slice(4);
      calls.push({
        path,
        method: request.method(),
        token: request.headers()["x-eatwhat-test"],
      });
      let status = 200,
        result;
      if (path === "/auth/login")
        result =
          loginMode === "consent"
            ? {
                code: 20005,
                msg: "需要完成授权",
                data: {
                  consentProof: "test-proof",
                  status: "PENDING",
                  policyVersion: "test-v1",
                },
              }
            : ok({
                tokenName: "x-eatwhat-test",
                tokenValue: "test-session-only",
                isLogin: true,
              });
      else if (path === "/auth/consent/policy")
        result = ok({
          policyVersion: "test-v1",
          siteMode: "EXTERNAL",
          temporaryAuthenticationRelay: true,
          ordinarySessionRequiresAuthorization: true,
        });
      else if (path === "/user/info")
        result = ok({
          id: 123,
          userName: "测试食友",
          role: "user",
          verified: true,
          banned: false,
        });
      else if (path === "/notification/unread/count") result = ok(0);
      else if (path === "/foods/favorites") {
        if (favoriteMode === "empty")
          result = ok({
            items: [],
            currentPage: 1,
            totalPages: 0,
            totalItems: 0,
            hasNext: false,
          });
        else if (favoriteMode === "business")
          result = { code: 777, msg: "验收：业务失败应显示错误", data: null };
        else {
          status = 401;
          result = { code: 401, msg: "验收：会话已过期", data: null };
        }
      } else if (path === "/foods/tags/my")
        result = ok({
          items: [],
          currentPage: 1,
          totalPages: 0,
          totalItems: 0,
          hasNext: false,
        });
      else if (path === "/foods/detail/9") {
        status = 403;
        result = { code: 403, msg: "验收：无权访问此菜品", data: null };
      } else if (path === "/restaurant/detail/1")
        result = ok({
          id: 1,
          name: "测试餐厅",
          address: "测试地址",
          gcjLng: 117,
          gcjLat: 36,
        });
      else if (path === "/upload/presign")
        result = ok({
          putUrl: "https://storage.invalid/test-put",
          key: "foods/test-key.png",
          expireAt: Date.now() + 60000,
        });
      else if (path === "/upload/complete")
        result = ok({
          key: "foods/test-key.png",
          fileId: "12345678-1234-1234-1234-123456789012",
          revision: 1,
          size: 70,
        });
      else if (path === "/foods/upload") {
        createCount++;
        await route.abort("timedout");
        return;
      } else throw new Error("Unexpected real-mode endpoint " + path);
      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(result),
      });
    },
  );
  await page.route("https://storage.invalid/test-put", async (route) => {
    storageToken =
      route.request().headers()["x-eatwhat-test"] ||
      route.request().headers().satoken ||
      "";
    await route.fulfill({ status: 200, body: "" });
  });
  await page.goto(origin + "/?demo=0#/favorites");
  await page.getByRole("link", { name: "登录 / 注册", exact: true }).waitFor();
  if (calls.length) throw new Error("Guest requested protected API");
  await page.getByRole("link", { name: "登录 / 注册", exact: true }).click();
  await page
    .getByRole("textbox", { name: "账号", exact: true })
    .fill("ui_test");
  await page.getByLabel("密码", { exact: true }).fill("not-a-real-password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page
    .getByRole("heading", { name: "跨站同步与身份授权", exact: true })
    .waitFor();
  await page
    .getByText("平台尚未配置授权政策全文，请联系管理员完成配置后继续。", {
      exact: true,
    })
    .waitFor();
  if (await page.evaluate(() => sessionStorage.getItem("eatwhat-session")))
    throw new Error("Consent proof stored as session");
  if (
    !(await page
      .getByRole("button", { name: "确认授权并继续", exact: true })
      .isDisabled())
  )
    throw new Error("Missing policy accepted");
  checks.push(
    "guest does not request protected data; consent proof is not a session; missing policy blocks consent",
  );
  await page.getByRole("button", { name: "返回登录", exact: true }).click();
  loginMode = "session";
  await page
    .getByRole("textbox", { name: "账号", exact: true })
    .fill("ui_test");
  await page.getByLabel("密码", { exact: true }).fill("not-a-real-password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page
    .getByRole("heading", { name: "想吃清单，等一份心动", exact: true })
    .waitFor();
  if (!page.url().endsWith("#/favorites"))
    throw new Error("Login target was not restored");
  if (
    !calls.some(
      (c) =>
        c.path === "/foods/favorites" && c.token === "Bearer test-session-only",
    )
  )
    throw new Error("Returned tokenName was not used");
  checks.push("dynamic session header and login target restoration");
  favoriteMode = "business";
  await page.reload();
  await page.getByText("验收：业务失败应显示错误", { exact: true }).waitFor();
  await page.goto(origin + "/?demo=0#/foods/9");
  await page.getByText("验收：无权访问此菜品", { exact: true }).waitFor();
  if (!(await page.evaluate(() => sessionStorage.getItem("eatwhat-session"))))
    throw new Error("403 incorrectly cleared session");
  checks.push(
    "HTTP 200 business failure and 403 permission failure stay distinct",
  );
  favoriteMode = "expired";
  await page.goto(origin + "/?demo=0#/favorites");
  await page.getByRole("link", { name: "登录 / 注册", exact: true }).waitFor();
  if (await page.evaluate(() => sessionStorage.getItem("eatwhat-session")))
    throw new Error("401 did not clear session");
  checks.push("HTTP 401 clears the expired session");
  await page.goto(origin + "/?demo=0#/auth?next=%2Fpublish%3FrestaurantId%3D1");
  await page
    .getByRole("textbox", { name: "账号", exact: true })
    .fill("ui_test");
  await page.getByLabel("密码", { exact: true }).fill("not-a-real-password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.getByRole("button", { name: "测试餐厅", exact: true }).waitFor();
  await page
    .getByRole("textbox", { name: "菜品名称", exact: true })
    .fill("测试超时结果");
  await page
    .getByLabel("选择菜品图片", { exact: true })
    .setInputFiles({
      name: "test.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK0kAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  await page
    .getByRole("button", { name: "分享这份好味道", exact: true })
    .click();
  await page
    .getByText("提交结果暂时不确定。请先在“我的分享”中核实，避免重复发布。", {
      exact: true,
    })
    .waitFor();
  if (
    !(await page
      .getByRole("button", { name: "分享这份好味道", exact: true })
      .isDisabled())
  )
    throw new Error("Uncertain creation can be duplicated");
  if (createCount !== 1) throw new Error("Creation was automatically retried");
  if (storageToken) throw new Error("Application session leaked to storage");
  checks.push(
    "live upload sequence; no session in PUT; uncertain creation cannot auto-retry",
  );
  await page.evaluate(() => sessionStorage.removeItem("eatwhat-session"));
  await page.unrouteAll({ behavior: "wait" });
  await page.goto(origin + "/?demo=1");
  return {
    passed: checks,
    backendRequestsSent: 0,
    interceptedCalls: calls.length,
  };
}
