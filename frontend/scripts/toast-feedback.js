async function verifyToastFeedback(browserPage) {
  const base = "http://127.0.0.1:5173";
  const browser = browserPage.context().browser();
  const checks = [],
    errors = [];
  const assert = (value, message) => {
    if (!value) throw new Error(message);
  };
  async function makePage(width, signedIn) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    if (signedIn)
      await context.addInitScript(() =>
        localStorage.setItem(
          "eatwhat-session",
          JSON.stringify({ tokenName: "x-toast-test", tokenValue: "isolated" }),
        ),
      );
    const p = await context.newPage();
    p.setDefaultTimeout(10000);
    p.on("pageerror", (error) => errors.push(error.message));
    return { context, p };
  }
  const user = {
    id: 90,
    userName: "toast_test",
    displayName: "食友",
    hasUsername: true,
    hasPassword: true,
    verified: true,
    banned: false,
  };
  const shop = { id: 1, name: "校园小馆", address: "软件园校区" };
  const campus = { id: 1, name: "软件园校区", open: true, isDefault: true };
  const food = {
    id: 71,
    name: "测试菜品",
    accountId: 90,
    restaurantId: 1,
    restaurantName: shop.name,
    category: "staple",
    pictureUrl: ["/prototype/assets/photos/sq_luosi.png"],
    pictureKeys: ["foods/toast-photo.png"],
    price: 18,
    mealTimes: ["dinner"],
  };
  async function routes(context, onRequest = () => undefined) {
    await context.route(
      () => true,
      async (route) => {
        const request = route.request(),
          url = new URL(request.url());
        if (url.origin !== base) return route.abort();
        const special = await onRequest(route, url);
        if (special) return;
        if (!url.pathname.startsWith("/api/")) return route.continue();
        const path = url.pathname.slice(4);
        let data = { items: [], currentPage: 1, totalPages: 1 };
        if (path === "/auth/login")
          return route.fulfill({
            json: { code: 30007, msg: "账号或密码不正确", data: null },
          });
        if (path === "/user/info" || path === "/user/userInfo") data = user;
        else if (path === "/campus/list") data = [campus];
        else if (path === "/remote-config") data = {};
        else if (path === "/restaurant/detail/1") data = shop;
        else if (path.startsWith("/restaurant/"))
          data = { items: [shop], currentPage: 1, totalPages: 1 };
        else if (path === "/foods/detail/71") data = food;
        else if (path === "/foods/recommend") data = [];
        else if (path === "/foods/tags/system") data = [];
        else if (path === "/foods/71/tags")
          data = { systemTags: [], myCustomTags: [] };
        else if (path === "/user/activity") data = null;
        await route.fulfill({ json: { code: 0, msg: "ok", data } });
      },
    );
  }
  async function visibleToast(p, message) {
    const toast = p.locator(".app-toast").filter({ hasText: message });
    await toast.waitFor({ state: "visible" });
    const box = await toast.boundingBox();
    const viewport = p.viewportSize();
    assert(
      box.x >= 0 &&
        box.y >= 0 &&
        box.x + box.width <= viewport.width + 1 &&
        box.y + box.height <= viewport.height,
      "Toast outside viewport",
    );
    return toast;
  }
  for (const width of [320, 390, 1440]) {
    const { context, p } = await makePage(width, false);
    try {
      await routes(context);
      await p.goto(
        base + "/?demo=0#/" + (width >= 600 ? "me" : "auth/password"),
      );
      const form =
        width >= 600
          ? p.locator(".ew-login-dialog")
          : p.locator(".mobile-auth-page");
      await form.locator('input[name="username"]').fill("toast_test");
      await form
        .locator('input[name="password"]')
        .fill("isolated-test-password");
      await form.getByRole("button", { name: "登录", exact: true }).click();
      const toast = await visibleToast(p, "账号或密码不正确");
      assert(
        !(await p
          .locator(".pc-secondary-error, .mobile-error-banner, .ew-error")
          .count()),
        "Inline login error remains",
      );
      if (width >= 600) {
        assert(
          (await p.locator(".ew-login-dialog .app-toast").count()) === 1,
          "Toast outside modal's accessible subtree",
        );
        assert(
          await p
            .locator(".app-toast-viewport")
            .evaluate((node) => node.matches(":popover-open")),
          "Toast not in top layer",
        );
      }
      await p.screenshot({
        path: "output/playwright/toast-login-" + width + ".png",
        fullPage: false,
      });
      await toast.getByRole("button", { name: "关闭提示" }).click();
      assert(
        !(await p.locator(".app-toast").count()),
        "Toast dismissal failed",
      );
      await form.getByRole("button", { name: "登录", exact: true }).click();
      await visibleToast(p, "账号或密码不正确");
      checks.push(
        width +
          "px: login error visible, no inline banner, dismissible, identical retry shown",
      );
    } finally {
      await context.close();
    }
  }
  const { context, p } = await makePage(1440, true);
  let failUpload = true,
    puts = 0,
    completes = 0,
    creates = 0,
    createdBody;
  try {
    await routes(context, async (route, url) => {
      const path = url.pathname;
      if (path === "/toast-test-storage/photo") {
        puts++;
        if (failUpload) await route.abort("failed");
        else await route.fulfill({ status: 200, body: "" });
        return true;
      }
      if (path === "/api/upload/presign") {
        await route.fulfill({
          json: {
            code: 0,
            data: {
              key: "foods/toast-photo.png",
              putUrl: base + "/toast-test-storage/photo",
            },
          },
        });
        return true;
      }
      if (path === "/api/upload/complete") {
        completes++;
        await route.fulfill({
          json: { code: 0, data: { key: "foods/toast-photo.png" } },
        });
        return true;
      }
      if (path === "/api/foods/upload") {
        creates++;
        createdBody = route.request().postDataJSON();
        await route.fulfill({ json: { code: 0, data: { id: 71 } } });
        return true;
      }
    });
    await p.goto(base + "/?demo=0#/publish/dish");
    await p
      .getByRole("textbox", { name: "菜名", exact: true })
      .fill("测试菜品");
    await p.getByRole("spinbutton", { name: "价格", exact: true }).fill("18");
    const imageResponse = await p.request.get(
      base + "/prototype/assets/photos/sq_luosi.png",
    );
    await p.locator('input[type="file"]').setInputFiles({
      name: "菜品.png",
      mimeType: "image/png",
      buffer: await imageResponse.body(),
    });
    const publish = p.getByRole("button", { name: "发布这道菜", exact: true });
    const tagEntry = p.getByRole("textbox", { name: "发布个人标签" });
    await tagEntry.fill("包子");
    await tagEntry.press("Enter");
    await p
      .getByRole("button", { name: "移除标签 包子", exact: true })
      .waitFor();
    assert(
      puts === 0 && creates === 0,
      "Tag Enter unexpectedly submitted the publish form",
    );
    await tagEntry.fill("早餐");
    await p.getByRole("button", { name: "添加个人标签", exact: true }).click();
    await p.getByRole("button", { name: "移除标签 包子", exact: true }).click();
    await tagEntry.fill("想再吃");
    await publish.click();
    const initialFeedback = p.locator(".app-toast").last();
    await initialFeedback.waitFor({ state: "visible" });
    assert(
      (await initialFeedback.innerText()).includes("未能连接上传服务"),
      "Unexpected publish feedback: " + (await initialFeedback.innerText()),
    );
    let toast = await visibleToast(p, "未能连接上传服务");
    assert(
      completes === 0 && creates === 0,
      "Failed upload continued to complete or create",
    );
    await p
      .getByRole("button", { name: "移除标签 想再吃", exact: true })
      .waitFor();
    assert(
      (await tagEntry.inputValue()) === "",
      "Pending tag was not committed when publishing",
    );
    assert(
      !(await p.locator(".pc-composer-error").count()),
      "Original publish error banner remains",
    );
    assert(
      (await p
        .getByRole("textbox", { name: "菜名", exact: true })
        .inputValue()) === "测试菜品",
      "Draft lost after failure",
    );
    await p.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    await visibleToast(p, "未能连接上传服务");
    await p.screenshot({
      path: "output/playwright/toast-publish-failure.png",
      fullPage: false,
    });
    await toast.getByRole("button", { name: "关闭提示" }).click();
    await publish.click();
    toast = await visibleToast(p, "未能连接上传服务");
    assert(
      puts === 2 && creates === 0,
      "Upload retry did not behave as expected",
    );
    checks.push(
      "Desktop publish: upload failure stays visible while scrolled; no inline banner; draft retained; repeated failure shown",
    );
    await toast.getByRole("button", { name: "关闭提示" }).click();
    failUpload = false;
    await publish.click();
    await p.waitForURL(/#\/foods\/71$/);
    await visibleToast(p, "这道菜已发布");
    assert(
      completes === 1 && creates === 1,
      "Successful retry did not create exactly once",
    );
    assert(
      JSON.stringify(createdBody.myCustomTagNames) ===
        JSON.stringify(["早餐", "想再吃"]),
      "Committed, removed or pending tags were saved incorrectly",
    );
    checks.push(
      "Personal tag chips: Enter does not publish, add/remove, pending input committed on publish and retained through retry",
    );
    checks.push(
      "Desktop publish: successful retry confirms upload once, creates once and shows success toast after navigation",
    );
    assert(errors.length === 0, errors.join("; "));
    return { checks, errors, realBackendRequests: 0 };
  } catch (error) {
    await p.screenshot({
      path: "output/playwright/toast-check-failure.png",
      fullPage: false,
    });
    throw new Error(
      JSON.stringify({
        error: error.message,
        checks,
        puts,
        completes,
        creates,
        errors,
        invalid: await p
          .locator("form[aria-label='发布菜品表单']")
          .evaluate((form) =>
            Array.from(form.elements)
              .filter((input) => input.willValidate && !input.validity.valid)
              .map((input) => ({
                name: input.name,
                message: input.validationMessage,
              })),
          ),
      }),
    );
  } finally {
    await context.close();
  }
}
