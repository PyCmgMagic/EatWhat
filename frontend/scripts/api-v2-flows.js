async (page) => {
  const context = await page
    .context()
    .browser()
    .newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await context.newPage(),
    checks = [],
    errors = [],
    remote = [];
  p.setDefaultTimeout(8000);
  p.on("pageerror", (e) => errors.push(e.message));
  await context.route(
    (u) => u.hostname !== "127.0.0.1" && u.hostname !== "localhost",
    (r) => {
      remote.push(r.request().url().split("?")[0]);
      return r.abort();
    },
  );
  await context.route(
    (u) => u.pathname.startsWith("/api/"),
    (r) => {
      remote.push(r.request().url());
      return r.abort();
    },
  );
  await context.addInitScript(() => {
    window.__v2calls = [];
  });
  await context.route("**/src/demo/transport.ts*", async (r) => {
    const response = await r.fetch(),
      original = await response.text();
    const body = original.replace(
      "if (options.signal?.aborted)",
      'window.__v2calls.push({path,method:options.method || "GET",headers:!!options.headers,body:options.body,query:options.query}); if (options.signal?.aborted)',
    );
    if (body === original) throw new Error("instrumentation not matched");
    await r.fulfill({ response, body });
  });
  const base = "http://127.0.0.1:5173/?demo=1&view=desktop#";
  const visit = async (path) => {
    await p.goto(base + path);
    await p.locator("main").waitFor();
  };
  const captcha = async (result) => {
    await p.locator(".ew-demo-captcha").waitFor();
    await p.locator(`.ew-demo-captcha [data-result=${result}]`).click();
    await p.locator(".ew-demo-captcha").waitFor({ state: "detached" });
  };
  const confirm = async (text) => {
    const dialog = p.getByRole("dialog");
    await dialog.waitFor();
    if (!(await p.locator(".pc-app").evaluate(e => e.inert))) throw new Error("modal did not lock the background");
    await dialog.getByRole("button", { name: text, exact: true }).click();
    await dialog.waitFor({ state: "detached" });
    await p.waitForFunction(() => !document.querySelector(".pc-app")?.inert);
  };
  const callCount = (path) =>
    p.evaluate(
      (path) => window.__v2calls.filter((c) => c.path === path).length,
      path,
    );
  try {
    await visit("/settings/account");
    await p.getByText("设置后可使用登录名登录", { exact: true }).waitFor();
    await p.getByRole("link", { name: "去绑定", exact: true }).click();
    await p.getByLabel("手机号", { exact: true }).fill("13800000000");
    await p.getByRole("button", { name: "发送验证码", exact: true }).click();
    await captcha("cancel");
    if (await callCount("/user/getCode"))
      throw new Error("cancel sent binding SMS");
    await p.getByRole("button", { name: "发送验证码", exact: true }).click();
    await captcha("fail");
    if (await callCount("/user/getCode"))
      throw new Error("failure sent binding SMS");
    await p.getByRole("button", { name: "发送验证码", exact: true }).click();
    await captcha("pass");
    await p.getByRole("button", { name: /s 后重发/ }).waitFor();
    await p.getByLabel("6 位验证码", { exact: true }).fill("123456");
    await p
      .getByRole("button", { name: "确认绑定手机号", exact: true })
      .click();
    await p.getByText("当前手机号：138****0000").waitFor();
    checks.push("绑定手机：取消、失败均不发送；验证成功后倒计时并可绑定");
    await visit("/settings/username");
    await p.locator("input[name=userName]").fill("student_1");
    await p.getByRole("button", { name: "获取验证码", exact: true }).click();
    await captcha("pass");
    await p.getByRole("button", { name: /s 后重发/ }).waitFor();
    await p.locator("input[name=code]").fill("123456");
    await p.locator("input[name=newPassword]").fill("newpassword1");
    await p.locator("input[name=confirm]").fill("newpassword1");
    await p
      .getByRole("button", { name: "保存并重新登录", exact: true })
      .click();
    await p.waitForURL("**#/auth/password");
    await p.locator("input[name=username]").waitFor();
    if ((await p.locator("input[name=username]").inputValue()) !== "student_1")
      throw new Error("username not prefilled");
    if (
      (await p.evaluate(() =>
        sessionStorage.getItem("eatwhat-demo-session"),
      )) !== "null"
    )
      throw new Error("old session retained");
    await p
      .getByRole("checkbox", { name: "我已阅读并同意跨站同步授权政策" })
      .check();
    await p.locator("input[name=password]").fill("newpassword1");
    await p.getByRole("button", { name: "登录", exact: true }).click();
    await p.waitForURL("**#/");
    checks.push(
      "首次设置登录名：短信验证、初始密码、本地会话清空、新登录名预填及重新登录",
    );
    await visit("/users/21");
    await p.locator(".ew-v2-foods .ew-food-card").first().waitFor();
    await p.getByRole("button", { name: "屏蔽这位食友", exact: true }).click();
    await confirm("屏蔽食友");
    await p
      .getByRole("button", { name: "已屏蔽 · 解除", exact: true })
      .waitFor();
    await visit("/settings/blocked");
    await p.getByRole("button", { name: "解除屏蔽", exact: true }).click();
    await p
      .getByRole("heading", { name: "目前没有屏蔽的食友", exact: true })
      .waitFor();
    checks.push("食友分享列表与屏蔽/解除：页面、状态和列表同步");
    await visit("/settings/privacy");
    const setting = p.getByRole("switch", { name: "个性化推荐", exact: true });
    await setting.waitFor();
    await setting.uncheck();
    await p.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem("eatwhat-demo-prototype-v3"))
          .personalized === false,
    );
    await p.reload();
    await setting.waitFor();
    if (await setting.isChecked())
      throw new Error("personalized did not persist");
    checks.push("个性化推荐关闭后刷新保持设置");
    await visit("/foods/1");
    await p
      .getByRole("heading", { name: "鲜虾蟹籽云吞", exact: true })
      .waitFor();
    await visit("/restaurants/1");
    await p.locator(".pc-restaurant-hero").waitFor();
    await visit("/history");
    await p.getByRole("button", { name: "清空足迹", exact: true }).click();
    await confirm("确认清空");
    await p
      .getByRole("heading", { name: "还没有浏览过的菜品", exact: true })
      .waitFor();
    await p.getByRole("tab", { name: "浏览的店铺", exact: true }).click();
    await p.locator(".pc-history-content a").first().waitFor();
    await p.getByLabel("清空足迹范围").selectOption("all");
    await p.getByRole("button", { name: "清空足迹", exact: true }).click();
    await confirm("确认清空");
    await p
      .getByRole("heading", { name: "还没有浏览过的店铺", exact: true })
      .waitFor();
    checks.push("足迹按分类/全部清空，保留其他分类并刷新缓存");
    await visit("/auth/forgot");
    await p.getByLabel("账号标识", { exact: true }).fill("student_1");
    await p.getByRole("button", { name: "发送恢复邮件", exact: true }).click();
    await captcha("pass");
    await p
      .getByText("本地演示恢复令牌：demo-recovery-token（不发送邮件）")
      .waitFor();
    await visit("/auth/password-conflict/reset?token=demo-recovery-token");
    await p.getByLabel("恢复令牌", { exact: true }).waitFor();
    await p.waitForURL("**#/auth/password-conflict/reset");
    await p.locator("input[name=password]").fill("recovered1");
    await p.locator("input[name=confirm]").fill("recovered1");
    await p.getByRole("button", { name: "重置密码", exact: true }).click();
    await p.getByRole("heading", { name: "密码已重置", exact: true }).waitFor();
    checks.push("恢复邮件模拟、链接令牌读取、URL清理、一次性密码重置");
    await p.screenshot({ path: "output/playwright/api-v2-password-reset.png" });
    if (remote.length)
      throw new Error("unexpected remote request: " + remote.join(","));
    return { checks, errors, remoteRequests: remote.length };
  } catch (error) {
    await p.screenshot({ path: "output/playwright/api-v2-flow-failure.png" });
    return {
      checks,
      errors,
      remoteRequests: remote.length,
      failure: String(error),
      debug: await p.evaluate(() => ({
        inert: [...document.querySelectorAll("[inert]")].map(
          (e) => e.className,
        ),
        buttons: [...document.querySelectorAll(".ew-v2-row button")].map(
          (e) => {
            const r = e.getBoundingClientRect();
            return {
              style: getComputedStyle(e).pointerEvents,
              ancestors: [
                e.parentElement,
                e.parentElement.parentElement,
                e.parentElement.parentElement.parentElement,
              ].map((x) => ({
                cls: x.className,
                inert: x.inert,
                pointer: getComputedStyle(x).pointerEvents,
              })),
              hit: document
                .elementsFromPoint(r.x + r.width / 2, r.y + r.height / 2)
                .map((x) => x.tagName + "." + x.className),
            };
          },
        ),
      })),
      url: p.url(),
      text: (await p.locator("body").innerText()).slice(-3500),
    };
  } finally {
    await context.close();
  }
}
