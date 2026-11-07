async function validateVerificationGuide(page) {
  const context = await page
    .context()
    .browser()
    .newContext({ viewport: { width: 390, height: 844 } });
  const p = await context.newPage(),
    errors = [],
    requests = [],
    checks = [];
  let verified = false,
    method = "verify:school_email",
    bothMethods = false,
    methodError = false;
  p.setDefaultTimeout(10000);
  p.on("pageerror", (e) => errors.push(e.message));
  await context.addInitScript(() => {
    if (location.hostname !== "127.0.0.1") return;
    localStorage.setItem(
      "eatwhat-session",
      JSON.stringify({
        tokenName: "x-session",
        tokenValue: "isolated-verification-guide",
      }),
    );
    window.TencentCaptcha = class {};
  });
  await context.route(
    (u) => u.origin !== "http://127.0.0.1:5173",
    (r) => r.abort(),
  );
  await context.route(
    (u) => u.pathname.startsWith("/api/"),
    (r) => {
      const url = new URL(r.request().url()),
        path = url.pathname;
      let data = [];
      if (path === "/api/user/info")
        data = { id: 10, displayName: "测试同学", verified, banned: false };
      else if (path === "/api/auth/verify") {
        if (methodError)
          return r.fulfill({
            status: 503,
            json: { code: 50000, msg: "认证记录暂时无法读取" },
          });
        data = verified
          ? bothMethods
            ? ["verify:sso", "verify:school_email"]
            : [method]
          : [];
      } else if (path === "/api/auth/sdu") {
        requests.push(path);
        data = { url: "https://sso.example.test/verify", expiresIn: 300 };
      } else if (path === "/api/auth/sendEmail") {
        requests.push(path);
        data = null;
      } else if (path === "/api/auth/captcha/config") data = { enabled: false };
      else if (r.request().method() !== "GET") {
        errors.push("Unexpected mutation: " + path);
        return r.abort();
      } else if (path === "/api/campus/list")
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
      return r.fulfill({ status: 200, json: { code: 0, data } });
    },
  );
  const base = "http://127.0.0.1:5173/?demo=0#/verify?next=%2Ffoods%2F71";
  const assert = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  const open = async () => {
    await p.goto(base);
    await p.reload();
    await p
      .getByRole("heading", { name: "学校统一认证", exact: true })
      .waitFor();
    await p.evaluate(() => document.fonts.ready);
  };
  try {
    for (const width of [320, 390, 520, 1280]) {
      await p.setViewportSize({ width, height: 844 });
      await open();
      await p
        .getByText("以下两种方式任选其一，无需全部完成。", { exact: true })
        .waitFor();
      const layout = await p
        .locator(".student-verification")
        .evaluate((root) => {
          const options = Array.from(
            root.querySelectorAll(".verification-option"),
          );
          return {
            overflow: document.documentElement.scrollWidth > innerWidth,
            options: options.map((el) => el.getBoundingClientRect().toJSON()),
            intro: root
              .querySelector(".pc-secondary-verification")
              .getBoundingClientRect()
              .toJSON(),
            divider: root
              .querySelector(".verification-or")
              .getBoundingClientRect()
              .toJSON(),
          };
        });
      assert(!layout.overflow, "Horizontal overflow at " + width);
      assert(
        layout.options.length === 2 &&
          layout.options[0].bottom < layout.divider.y &&
          layout.divider.bottom < layout.options[1].y,
        "Options are not visibly separated",
      );
      assert(
        layout.intro.bottom < (width < 768 ? 400 : 600),
        "Choice explanation hidden below the fold",
      );
      assert(
        (await p
          .getByRole("button", { name: "刷新认证状态", exact: true })
          .count()) === 1,
        "Refresh action missing or duplicated",
      );
      assert(
        (await p.locator(".ew-verification-methods").count()) === 0,
        "Unverified user sees an irrelevant completed-method list",
      );
      assert(
        (await p
          .locator(".verification-option")
          .first()
          .locator("input")
          .count()) === 0,
        "SSO unnecessarily requires an email",
      );
      if (width === 390 || width === 1280)
        await p.screenshot({
          path: `output/playwright/verification-guide-${width}.png`,
          fullPage: true,
        });
      checks.push(
        `${width}px: explicit either/or, separate options, one refresh action, no overflow`,
      );
    }
    await p.setViewportSize({ width: 390, height: 844 });
    await open();
    await p
      .getByRole("button", { name: "获取学校认证入口", exact: true })
      .click();
    const sso = p.getByRole("link", {
      name: "前往学校认证页面 ↗",
      exact: true,
    });
    await sso.waitFor();
    assert(
      (await sso.getAttribute("href")) === "https://sso.example.test/verify",
      "SSO destination incorrect",
    );
    assert(
      requests.length === 1 && requests[0] === "/api/auth/sdu",
      "SSO triggered an email request",
    );
    verified = true;
    method = "verify:sso";
    await p.getByRole("button", { name: "刷新认证状态", exact: true }).click();
    await p.getByText("学生身份已认证", { exact: true }).waitFor();
    await p.getByText("山东大学统一认证", { exact: true }).waitFor();
    assert(
      (await p.locator(".verification-option").count()) === 0,
      "SSO completion still asks for email verification",
    );
    checks.push(
      "SSO alone completes verification; no email or repeated authentication required",
    );
    verified = false;
    method = "verify:school_email";
    await open();
    const previous = requests.length;
    await p
      .getByRole("textbox", { name: /学校邮箱地址/ })
      .fill("test@sdu.edu.cn");
    await p.getByRole("button", { name: "发送认证邮件", exact: true }).click();
    await p.locator(".verification-email-sent").waitFor();
    assert(
      (await p.locator(".verification-email-sent").innerText()).includes(
        "还差最后一步",
      ),
      "Email sent state implies certification is complete",
    );
    assert(
      requests.length === previous + 1 &&
        requests.at(-1) === "/api/auth/sendEmail",
      "Email flow also started SSO",
    );
    assert(
      (await p.getByText("学生身份已认证", { exact: true }).count()) === 0,
      "Sending email prematurely verified the user",
    );
    verified = true;
    await p.getByRole("button", { name: "刷新认证状态", exact: true }).click();
    await p.getByText("学生身份已认证", { exact: true }).waitFor();
    await p
      .locator(".ew-method-badge")
      .getByText("学校邮箱认证", { exact: true })
      .waitFor();
    assert(
      (await p.locator(".verification-option").count()) === 0,
      "Email completion still asks for SSO",
    );
    const back = p
      .locator(".verification-complete-actions")
      .getByRole("link", { name: "返回原页面", exact: true });
    assert(
      (await back.getAttribute("href")) === "#/foods/71",
      "Completed verification lost its return destination",
    );
    await p.screenshot({
      path: "output/playwright/verification-guide-complete.png",
      fullPage: true,
    });
    checks.push(
      "Email alone completes verification; sent/verified states are distinct and return destination preserved",
    );
    method = "verify:sso";
    for (const width of [320, 390, 520, 1280]) {
      bothMethods = width === 320;
      await p.setViewportSize({ width, height: 844 });
      await p.goto(base);
      await p.reload();
      await p.getByText("山东大学统一认证", { exact: true }).waitFor();
      await p.evaluate(() => document.fonts.ready);
      const layout = await p
        .locator(".verification-complete")
        .evaluate((root) => {
          const box = (selector) =>
            root.querySelector(selector).getBoundingClientRect().toJSON();
          return {
            overflow: document.documentElement.scrollWidth > innerWidth,
            status: box(".pc-secondary-verification"),
            primary: box(".verification-complete-actions .pc-button"),
            secondary: box(".verification-discover"),
            records: box(".ew-verification-methods"),
            recordTitle: box(".ew-verification-methods-heading h3"),
            refresh: box(".ew-verification-methods-heading button"),
          };
        });
      assert(!layout.overflow, "Completed layout overflows at " + width);
      assert(
        layout.status.bottom < layout.primary.y &&
          layout.primary.bottom <= layout.secondary.y &&
          layout.secondary.bottom < layout.records.y,
        "Status, actions and records are not separated at " + width,
      );
      assert(
        layout.recordTitle.right < layout.refresh.x &&
          layout.refresh.height >= 44,
        "Records heading overlaps refresh, or touch target is too small",
      );
      assert(
        (await p.locator(".ew-method-badge").count()) === (bothMethods ? 2 : 1),
        "Completed methods missing",
      );
      assert(
        (await p
          .getByRole("heading", { name: "认证后可以", exact: true })
          .count()) === 0,
        "Completed page repeats verification benefits",
      );
      await p.screenshot({
        path: `output/playwright/verification-complete-${width}.png`,
        fullPage: true,
      });
      checks.push(
        `${width}px: completed status/actions/records aligned; single and multiple records fit`,
      );
    }
    await p.setViewportSize({ width: 390, height: 844 });
    methodError = true;
    await p.getByRole("button", { name: "刷新认证记录", exact: true }).click();
    await p.getByText("认证记录暂时无法读取", { exact: true }).waitFor();
    assert(await back.isVisible(), "Record failure blocked the return action");
    methodError = false;
    await p
      .getByRole("button", { name: "重新读取认证记录", exact: true })
      .click();
    await p.getByText("山东大学统一认证", { exact: true }).waitFor();
    checks.push(
      "Record refresh can recover from failure without hiding verified status or return action",
    );
    assert(errors.length === 0, errors.join("; "));
    return { checks, errors, mockedRequests: requests, realBackendRequests: 0 };
  } catch (error) {
    await p.screenshot({
      path: "output/playwright/verification-guide-failure.png",
      fullPage: true,
    });
    return {
      failure: String(error),
      checks,
      errors,
      requests,
      text: await p.locator("body").innerText(),
    };
  } finally {
    await context.close();
  }
}
