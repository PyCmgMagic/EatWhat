async (page) => {
  const c = await page
      .context()
      .browser()
      .newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      }),
    p = await c.newPage(),
    checks = [],
    errors = [],
    remote = [];
  p.setDefaultTimeout(8000);
  p.on("pageerror", (e) => errors.push(e.message));
  await c.addInitScript(() => {
    if (
      location.hostname === "127.0.0.1" &&
      localStorage.getItem("eatwhat-demo-session") === null
    )
      localStorage.setItem("eatwhat-demo-session", "null");
  });
  await c.route(
    (u) => u.hostname !== "127.0.0.1" || u.pathname.startsWith("/api/"),
    (r) => {
      remote.push(r.request().url());
      return r.abort();
    },
  );
  const base = "http://127.0.0.1:5173/?demo=1#";
  const pass = async () => {
    await p.locator(".ew-demo-captcha [data-result=pass]").click();
    await p.locator(".ew-demo-captcha").waitFor({ state: "detached" });
  };
  try {
    await p.goto(base + "/auth/register");
    await p.getByLabel("登录手机号", { exact: true }).fill("13800000000");
    await p
      .getByRole("checkbox", { name: "我已阅读并同意跨站同步授权政策" })
      .check();
    await p.getByRole("button", { name: "获取验证码", exact: true }).click();
    await p.locator(".ew-demo-captcha").waitFor();
    await p.screenshot({ path: "output/playwright/api-v2-mobile-captcha.png" });
    await pass();
    await p.getByRole("button", { name: /s 后重发/ }).waitFor();
    await p.getByLabel("登录验证码", { exact: true }).fill("123456");
    await p.getByRole("button", { name: "登录 / 注册", exact: true }).click();
    await p.waitForURL("**#/settings/username?first=1");
    checks.push(
      "手机验证码登录/注册：政策同意、人机验证、成功倒计时、新账号登录名引导",
    );
    await p.locator("input[name=userName]").fill("mobile_1");
    await p.getByRole("button", { name: "获取验证码", exact: true }).click();
    await pass();
    await p.getByRole("button", { name: /s 后重发/ }).waitFor();
    await p.locator("input[name=code]").fill("123456");
    await p.locator("input[name=newPassword]").fill("mobile-password");
    await p.locator("input[name=confirm]").fill("mobile-password");
    await p
      .getByRole("button", { name: "保存并重新登录", exact: true })
      .click();
    await p.waitForURL("**#/auth/password");
    await p.locator('.design-screen[data-screen="G-PasswordLogin"]').waitFor();
    const account = p
      .locator(".design-screen input")
      .filter({ visible: true })
      .first();
    if ((await account.inputValue()) !== "mobile_1")
      throw new Error("mobile login name not prefilled");
    checks.push("手机首设登录名后清会话，密码登录页预填新登录名");
    await p
      .getByRole("checkbox", { name: "我已阅读并同意跨站同步授权政策" })
      .check();
    await p
      .locator(".design-screen input[type=password]")
      .fill("mobile-password");
    await p.getByRole("button", { name: "登录", exact: true }).click();
    await p.waitForURL("**#/");
    await p.locator(".design-food-tile").first().waitFor();
    await p.goto(base + "/users/21");
    await p.locator(".ew-v2-foods .ew-food-card").first().waitFor();
    await p.getByRole("button", { name: "屏蔽这位食友", exact: true }).click();
    await p
      .getByRole("dialog")
      .getByRole("button", { name: "屏蔽食友", exact: true })
      .click();
    await p
      .getByRole("button", { name: "已屏蔽 · 解除", exact: true })
      .waitFor();
    await p.goto(base + "/settings/blocked");
    await p.getByRole("button", { name: "解除屏蔽", exact: true }).click();
    await p
      .getByRole("heading", { name: "目前没有屏蔽的食友", exact: true })
      .waitFor();
    checks.push("手机登录后首页推荐、食友分享、屏蔽及解除正常");
    await p.goto(base + "/settings/privacy");
    const setting = p.getByRole("switch", { name: "个性化推荐", exact: true });
    await setting.uncheck();
    await p.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem("eatwhat-demo-prototype-v3"))
          .personalized === false,
    );
    await p.screenshot({ path: "output/playwright/api-v2-mobile-privacy.png" });
    checks.push("手机个性化推荐开关可保存");
    if (remote.length) throw new Error("mock accessed network");
    return { checks, errors, remoteRequests: remote.length };
  } catch (error) {
    await p.screenshot({ path: "output/playwright/api-v2-mobile-failure.png" });
    return {
      checks,
      errors,
      failure: String(error),
      url: p.url(),
      text: (await p.locator("body").innerText()).slice(-2000),
      remoteRequests: remote.length,
    };
  } finally {
    await c.close();
  }
}
