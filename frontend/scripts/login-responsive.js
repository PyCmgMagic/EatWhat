async function validateResponsiveLogin(browserPage) {
  const origin = await browserPage.evaluate(() => location.origin);
  const context = await browserPage
    .context()
    .browser()
    .newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const desktop = page.locator(".pc-secondary-auth");
  const landing = page.locator(".mobile-login-landing");
  const mobileForm = page.locator(".mobile-auth-page");
  const account = page.locator('input[name="username"]');
  const password = page.locator('input[name="password"]');
  const suffix = "?next=%2Ffavorites";
  const errors = [];
  let smsRequests = 0;
  page.on("pageerror", (error) => errors.push(error.message));
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const visit = (path, query = "") =>
    page.goto(origin + "/" + query + "#" + path);
  async function resize(width, visible) {
    await page.setViewportSize({ width, height: 844 });
    await visible.waitFor();
  }
  await context.route(
    (url) => url.origin !== origin,
    (route) => route.abort(),
  );
  await context.route(
    (url) => url.pathname.startsWith("/api/"),
    (route) => {
      const path = route.request().url().slice(origin.length).split("?")[0];
      if (path === "/api/auth/captcha/config")
        return route.fulfill({ json: { code: 0, data: { enabled: false } } });
      if (path === "/api/auth/phone/code") {
        smsRequests++;
        return route.fulfill({ json: { code: 0, data: null } });
      }
      return route.abort();
    },
  );
  try {
    await visit("/auth" + suffix);
    await desktop.waitFor();
    const timeOrigin = await page.evaluate(() => performance.timeOrigin);
    await account.fill("responsive-test");
    await password.fill("test-only-password");
    await resize(390, landing);
    assert(
      (await page.locator(".pc-header").count()) === 0,
      "Desktop header is still mounted",
    );
    assert(
      await account.isHidden(),
      "The password form is visible on the mobile landing page",
    );
    assert(
      page.url().endsWith("#/auth" + suffix),
      "Resizing changed the login URL",
    );
    await page.getByRole("link", { name: "登录", exact: true }).click();
    await mobileForm.waitFor();
    assert(
      (await account.inputValue()) === "responsive-test",
      "Resizing lost the account input",
    );
    assert(
      (await password.inputValue()) === "test-only-password",
      "Resizing lost the password input",
    );
    await resize(640, desktop);
    assert(
      page.url().endsWith("#/auth/password" + suffix),
      "Desktop layout changed the login step",
    );
    await resize(639, mobileForm);
    assert(
      (await password.inputValue()) === "test-only-password",
      "Round trip lost the form",
    );
    assert(
      (await page.evaluate(() => performance.timeOrigin)) === timeOrigin,
      "Resize reloaded the document",
    );
    assert(
      await page.evaluate(
        () =>
          !JSON.stringify([localStorage, sessionStorage]).includes(
            "test-only-password",
          ),
      ),
      "Password entered browser storage",
    );
    await page.getByRole("link", { name: "注册", exact: true }).click();

    const phone = page.getByLabel("登录手机号", { exact: true });
    const code = page.getByLabel("登录验证码", { exact: true });
    const resend = page.getByRole("button", { name: /s 后重发/ });
    await phone.fill("13800000000");
    await page.getByRole("button", { name: "获取验证码", exact: true }).click();
    await resend.waitFor();
    await code.fill("123456");
    await resize(1440, desktop);
    await resend.waitFor();
    await resize(390, mobileForm);
    await resend.waitFor();
    assert(
      (await phone.inputValue()) === "13800000000" &&
        (await code.inputValue()) === "123456",
      "Round trip lost the phone login input",
    );
    assert(smsRequests === 1, "Responsive layout resent a verification code");

    await visit("/auth/forgot" + suffix);
    await page
      .getByRole("heading", { name: "找回密码", exact: true })
      .waitFor();
    await resize(640, desktop);
    await resize(
      390,
      page
        .locator(".ew-mobile-feature")
        .getByRole("heading", { name: "找回密码", exact: true }),
    );
    await visit("/auth/consent" + suffix);
    await mobileForm.waitFor();
    await resize(640, desktop);
    assert(
      page.url().endsWith("#/auth/password" + suffix),
      "Retired links did not retain the password step and destination",
    );
    await resize(390, mobileForm);
    await visit("/auth", "?view=desktop");
    await desktop.waitFor();
    await visit("/auth", "?view=mobile");
    await resize(1440, landing);
    assert(errors.length === 0, errors.join("\n"));
    return {
      checks: [
        "390px landing",
        "639/640px round trip without reload",
        "password and SMS form state",
        "password recovery",
        "legacy auth links",
        "explicit preview modes",
      ],
    };
  } catch (error) {
    const state = await page.evaluate(() => ({
      url: location.href,
      width: innerWidth,
      desktop: document.body.classList.contains("desktop-mode"),
      page: document.querySelector(
        "main [data-screen], main [data-pc-secondary]",
      )?.className,
    }));
    throw new Error(JSON.stringify({ state, errors }) + "\n" + error.message);
  } finally {
    await context.close();
  }
}
